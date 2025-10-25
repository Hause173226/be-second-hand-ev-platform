// src/controllers/offerController.ts
import { Request, Response, NextFunction } from "express";
import Offer from "../models/Offer";
import Chat from "../models/Chat";
import { Types } from "mongoose";
import { WebSocketService } from "../services/websocketService";

/**
 * Tạo offer mới
 * @param req - Request object chứa listingId, chatId, offeredPrice, message, expiresInDays trong body
 * @param res - Response object để trả về offer đã tạo
 * @param next - NextFunction cho middleware
 */
export const createOffer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { listingId, chatId, offeredPrice, message, expiresInDays = 7 } = req.body;
        const buyerId = (req as any).user.userId;

        // Kiểm tra các trường bắt buộc
        if (!listingId || !chatId || !offeredPrice) {
            res.status(400).json({ error: "Thiếu các trường bắt buộc" });
            return;
        }

        if (offeredPrice <= 0) {
            res.status(400).json({ error: "Giá đề nghị phải lớn hơn 0" });
            return;
        }

        // Kiểm tra chat tồn tại và user có quyền truy cập
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ error: "Không tìm thấy chat" });
            return;
        }

        if (!chat.buyerId.equals(buyerId) && !chat.sellerId.equals(buyerId)) {
            res.status(403).json({ error: "Không có quyền truy cập" });
            return;
        }

        // Kiểm tra xem đã có offer pending cho listing này chưa
        const existingOffer = await Offer.findOne({
            listingId: new Types.ObjectId(listingId),
            buyerId: new Types.ObjectId(buyerId),
            status: "pending",
        });

        if (existingOffer) {
            res.status(400).json({ error: "Bạn đã có offer đang chờ cho listing này" });
            return;
        }

        // Tính toán ngày hết hạn
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);

        // Tạo offer mới
        const offer = new Offer({
            listingId: new Types.ObjectId(listingId),
            buyerId: new Types.ObjectId(buyerId),
            sellerId: chat.sellerId,
            chatId: new Types.ObjectId(chatId),
            offeredPrice,
            message,
            status: "pending",
            expiresAt,
        });

        await offer.save();

        // Tạo tin nhắn trong chat về offer
        const Message = (await import("../models/Message")).default;
        const messageContent = `Đã đề nghị giá ${offeredPrice.toLocaleString('vi-VN')} VNĐ${message ? ` - ${message}` : ''}`;
        const messageDoc = new Message({
            chatId: new Types.ObjectId(chatId),
            senderId: new Types.ObjectId(buyerId),
            content: messageContent,
            messageType: "offer",
            metadata: {
                offerId: offer._id,
            },
        });

        await messageDoc.save();

        // Cập nhật tin nhắn cuối cùng của chat
        chat.lastMessage = {
            content: messageContent,
            senderId: new Types.ObjectId(buyerId),
            timestamp: new Date(),
        };
        await chat.save();

        await offer.populate("buyerId sellerId listingId", "fullName phone email make model year priceListed");

        // Gửi real-time notification qua WebSocket
        try {
            const wsService = WebSocketService.getInstance();
            wsService.broadcastOffer(chatId, {
                _id: offer._id,
                listingId: offer.listingId,
                chatId: offer.chatId,
                buyerId: offer.buyerId,
                offeredPrice: offer.offeredPrice,
                message: offer.message,
                status: offer.status,
                expiresAt: offer.expiresAt,
                createdAt: offer.createdAt,
            });
        } catch (error) {
            console.error("Lỗi gửi WebSocket notification:", error);
        }

        res.status(201).json(offer);
    } catch (error) {
        console.error("Lỗi trong createOffer:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

/**
 * Lấy danh sách offers của user
 * @param req - Request object chứa type, status, page, limit trong query
 * @param res - Response object để trả về danh sách offers
 * @param next - NextFunction cho middleware
 */
export const getUserOffers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = (req as any).user.userId;
        const { status, type = "all", page = 1, limit = 20 } = req.query;

        let filter: any = {};

        // Xác định loại offers (gửi đi, nhận về, hoặc tất cả)
        if (type === "sent") {
            filter.buyerId = userId;
        } else if (type === "received") {
            filter.sellerId = userId;
        } else {
            filter.$or = [{ buyerId: userId }, { sellerId: userId }];
        }

        // Lọc theo trạng thái nếu có
        if (status) {
            filter.status = status;
        }

        // Lấy offers với phân trang
        const offers = await Offer.find(filter)
            .populate("buyerId sellerId listingId", "fullName phone email make model year priceListed photos")
            .sort({ createdAt: -1 })
            .limit(Number(limit) * 1)
            .skip((Number(page) - 1) * Number(limit));

        const total = await Offer.countDocuments(filter);

        res.json({
            offers,
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: Number(page),
            total,
        });
    } catch (error) {
        console.error("Lỗi trong getUserOffers:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

/**
 * Phản hồi offer (chấp nhận, từ chối, hoặc counter offer)
 * @param req - Request object chứa offerId trong params và action, counterPrice, message trong body
 * @param res - Response object để trả về kết quả
 * @param next - NextFunction cho middleware
 */
export const respondToOffer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { offerId } = req.params;
        const { action, counterPrice, message } = req.body;
        const userId = (req as any).user.userId;

        // Kiểm tra action có hợp lệ không
        if (!action) {
            res.status(400).json({ error: "Action là bắt buộc" });
            return;
        }

        const validActions = ["accept", "reject", "counter"];
        if (!validActions.includes(action)) {
            res.status(400).json({ error: "Action không hợp lệ" });
            return;
        }

        // Tìm offer
        const offer = await Offer.findById(offerId);
        if (!offer) {
            res.status(404).json({ error: "Không tìm thấy offer" });
            return;
        }

        // Chỉ seller mới có thể phản hồi offers
        if (!offer.sellerId.equals(userId)) {
            res.status(403).json({ error: "Không có quyền truy cập" });
            return;
        }

        if (offer.status !== "pending") {
            res.status(400).json({ error: "Offer không còn pending" });
            return;
        }

        // Kiểm tra offer đã hết hạn chưa
        if (offer.expiresAt && offer.expiresAt < new Date()) {
            offer.status = "expired";
            await offer.save();
            res.status(400).json({ error: "Offer đã hết hạn" });
            return;
        }

        let messageContent = "";
        let newStatus = "";

        // Xử lý các action khác nhau
        switch (action) {
            case "accept":
                offer.status = "accepted";
                messageContent = `Đã chấp nhận đề nghị giá ${offer.offeredPrice.toLocaleString('vi-VN')} VNĐ`;
                break;
            case "reject":
                offer.status = "rejected";
                messageContent = `Đã từ chối đề nghị giá ${offer.offeredPrice.toLocaleString('vi-VN')} VNĐ`;
                break;
            case "counter":
                if (!counterPrice || counterPrice <= 0) {
                    res.status(400).json({ error: "Giá counter là bắt buộc và phải lớn hơn 0" });
                    return;
                }
                offer.status = "countered";
                offer.counterOffer = {
                    price: counterPrice,
                    message: message || "",
                    offeredBy: new Types.ObjectId(userId),
                    offeredAt: new Date(),
                };
                messageContent = `Đã trả giá ${counterPrice.toLocaleString('vi-VN')} VNĐ${message ? ` - ${message}` : ''}`;
                break;
        }

        await offer.save();

        // Tạo tin nhắn trong chat về phản hồi
        const Message = (await import("../models/Message")).default;
        const messageDoc = new Message({
            chatId: offer.chatId,
            senderId: new Types.ObjectId(userId),
            content: messageContent,
            messageType: "offer",
            metadata: {
                offerId: offer._id,
            },
        });

        await messageDoc.save();

        // Cập nhật tin nhắn cuối cùng của chat
        const chat = await Chat.findById(offer.chatId);
        if (chat) {
            chat.lastMessage = {
                content: messageContent,
                senderId: new Types.ObjectId(userId),
                timestamp: new Date(),
            };
            await chat.save();
        }

        await offer.populate("buyerId sellerId listingId", "fullName phone email make model year priceListed");

        res.json(offer);
    } catch (error) {
        console.error("Lỗi trong respondToOffer:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

/**
 * Phản hồi counter offer
 * @param req - Request object chứa offerId trong params và action, message trong body
 * @param res - Response object để trả về kết quả
 * @param next - NextFunction cho middleware
 */
export const respondToCounterOffer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { offerId } = req.params;
        const { action } = req.body;
        const userId = (req as any).user.userId;

        // Kiểm tra action có hợp lệ không
        if (!action) {
            res.status(400).json({ error: "Action là bắt buộc" });
            return;
        }

        const validActions = ["accept", "reject"];
        if (!validActions.includes(action)) {
            res.status(400).json({ error: "Action không hợp lệ" });
            return;
        }

        // Tìm offer
        const offer = await Offer.findById(offerId);
        if (!offer) {
            res.status(404).json({ error: "Không tìm thấy offer" });
            return;
        }

        // Chỉ buyer mới có thể phản hồi counter offers
        if (!offer.buyerId.equals(userId)) {
            res.status(403).json({ error: "Không có quyền truy cập" });
            return;
        }

        if (offer.status !== "countered") {
            res.status(400).json({ error: "Không có counter offer để phản hồi" });
            return;
        }

        let messageContent = "";
        let newStatus = "";

        // Xử lý phản hồi counter offer
        if (action === "accept") {
            offer.status = "accepted";
            messageContent = `Đã chấp nhận giá trả ${offer.counterOffer?.price.toLocaleString('vi-VN')} VNĐ`;
        } else {
            offer.status = "rejected";
            messageContent = `Đã từ chối giá trả ${offer.counterOffer?.price.toLocaleString('vi-VN')} VNĐ`;
        }

        await offer.save();

        // Tạo tin nhắn trong chat về phản hồi
        const Message = (await import("../models/Message")).default;
        const messageDoc = new Message({
            chatId: offer.chatId,
            senderId: new Types.ObjectId(userId),
            content: messageContent,
            messageType: "offer",
            metadata: {
                offerId: offer._id,
            },
        });

        await messageDoc.save();

        // Update chat's last message
        const chat = await Chat.findById(offer.chatId);
        if (chat) {
            chat.lastMessage = {
                content: messageContent,
                senderId: new Types.ObjectId(userId),
                timestamp: new Date(),
            };
            await chat.save();
        }

        await offer.populate("buyerId sellerId listingId", "fullName phone email make model year priceListed");

        res.json(offer);
    } catch (error) {
        console.error("Lỗi trong respondToCounterOffer:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

/**
 * Lấy offer theo ID
 * @param req - Request object chứa offerId trong params
 * @param res - Response object để trả về offer
 * @param next - NextFunction cho middleware
 */
export const getOfferById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { offerId } = req.params;
        const userId = (req as any).user.userId;

        const offer = await Offer.findById(offerId)
            .populate("buyerId sellerId listingId", "fullName phone email make model year priceListed photos");

        if (!offer) {
            res.status(404).json({ error: "Không tìm thấy offer" });
            return;
        }

        // Kiểm tra quyền truy cập
        if (!offer.buyerId.equals(userId) && !offer.sellerId.equals(userId)) {
            res.status(403).json({ error: "Không có quyền truy cập" });
            return;
        }

        res.json(offer);
    } catch (error) {
        console.error("Lỗi trong getOfferById:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

/**
 * Hủy offer
 * @param req - Request object chứa offerId trong params
 * @param res - Response object để trả về kết quả
 * @param next - NextFunction cho middleware
 */
export const cancelOffer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { offerId } = req.params;
        const userId = (req as any).user.userId;

        const offer = await Offer.findById(offerId);
        if (!offer) {
            res.status(404).json({ error: "Không tìm thấy offer" });
            return;
        }

        // Chỉ buyer mới có thể hủy offers
        if (!offer.buyerId.equals(userId)) {
            res.status(403).json({ error: "Không có quyền truy cập" });
            return;
        }

        // Chỉ có thể hủy offers đang pending hoặc countered
        if (offer.status !== "pending" && offer.status !== "countered") {
            res.status(400).json({ error: "Chỉ có thể hủy offers đang pending hoặc countered" });
            return;
        }

        offer.status = "rejected";
        await offer.save();

        res.json({ message: "Hủy offer thành công" });
    } catch (error) {
        console.error("Lỗi trong cancelOffer:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};
