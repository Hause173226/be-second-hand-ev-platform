// src/controllers/offerController.ts
import { Request, Response, NextFunction } from "express";
import Offer from "../models/Offer";
import Chat from "../models/Chat";
import { Types } from "mongoose";
import { WebSocketService } from "../services/websocketService";
import offerService from "../services/offerService";

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

        // Sử dụng offerService
        const offer = await offerService.createOffer({
            listingId,
            buyerId,
            offerPrice: offeredPrice,
            message
        });

        res.status(201).json(offer);
    } catch (error) {
        console.error("Lỗi trong createOffer:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Lỗi máy chủ nội bộ" });
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
        const { status, type = "all" } = req.query;

        // Sử dụng offerService dựa trên type
        let offers;
        if (type === "buyer") {
            offers = await offerService.getBuyerOffers(userId, status as string);
        } else if (type === "seller") {
            offers = await offerService.getSellerOffers(userId, status as string);
        } else {
            // Lấy cả buyer và seller offers
            const buyerOffers = await offerService.getBuyerOffers(userId, status as string);
            const sellerOffers = await offerService.getSellerOffers(userId, status as string);
            offers = [...buyerOffers, ...sellerOffers];
        }

        res.json({ offers });
    } catch (error) {
        console.error("Lỗi trong getUserOffers:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Lỗi máy chủ nội bộ" });
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

        const validActions = ["accepted", "rejected", "countered"];
        if (!validActions.includes(action)) {
            res.status(400).json({ error: "Action không hợp lệ" });
            return;
        }

        // Sử dụng offerService
        const offer = await offerService.respondToOffer(
            offerId,
            userId,
            action as "accepted" | "rejected" | "countered",
            counterPrice,
            message
        );

        res.json(offer);
    } catch (error) {
        console.error("Lỗi trong respondToOffer:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Lỗi máy chủ nội bộ" });
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

        // Sử dụng offerService
        await offerService.cancelOffer(offerId, userId);

        res.json({ message: "Hủy offer thành công" });
    } catch (error) {
        console.error("Lỗi trong cancelOffer:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Lỗi máy chủ nội bộ" });
    }
};
