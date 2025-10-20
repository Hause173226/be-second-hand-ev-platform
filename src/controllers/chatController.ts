// src/controllers/chatController.ts
import { Request, Response, NextFunction } from "express";
import Chat from "../models/Chat";
import Message from "../models/Message";
import { Types } from "mongoose";
import { WebSocketService } from "../services/websocketService";

/**
 * Lấy hoặc tạo chat giữa người mua và người bán cho một listing
 * @param req - Request object chứa listingId trong params
 * @param res - Response object để trả về kết quả
 * @param next - NextFunction cho middleware
 */
export const getOrCreateChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { listingId } = req.params;
        const buyerId = (req as any).user.userId;

        // Tìm listing để lấy sellerId
        const Listing = (await import("../models/Listing")).default;
        const listing = await Listing.findById(listingId);
        if (!listing) {
            res.status(404).json({ error: "Không tìm thấy listing" });
            return;
        }

        // Kiểm tra xem chat đã tồn tại chưa
        let chat = await Chat.findOne({
            listingId: new Types.ObjectId(listingId),
            buyerId: new Types.ObjectId(buyerId),
            sellerId: listing.sellerId,
            isActive: true,
        }).populate("buyerId sellerId listingId", "fullName phone email make model year");

        if (!chat) {
            // Tạo chat mới
            chat = new Chat({
                listingId: new Types.ObjectId(listingId),
                buyerId: new Types.ObjectId(buyerId),
                sellerId: listing.sellerId,
                isActive: true,
            });
            await chat.save();
            await chat.populate("buyerId sellerId listingId", "fullName phone email make model year");
        }

        res.json(chat);
    } catch (error) {
        console.error("Lỗi trong getOrCreateChat:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

/**
 * Lấy tất cả chat của một user
 * @param req - Request object chứa page và limit trong query
 * @param res - Response object để trả về danh sách chat
 * @param next - NextFunction cho middleware
 */
export const getUserChats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = (req as any).user.userId;
        const { page = 1, limit = 20 } = req.query;

        // Tìm tất cả chat mà user tham gia (là buyer hoặc seller)
        const chats = await Chat.find({
            $or: [{ buyerId: userId }, { sellerId: userId }],
            isActive: true,
        })
            .populate("buyerId sellerId listingId", "fullName phone email make model year priceListed photos")
            .sort({ updatedAt: -1 })
            .limit(Number(limit) * 1)
            .skip((Number(page) - 1) * Number(limit));

        // Đếm tổng số chat
        const total = await Chat.countDocuments({
            $or: [{ buyerId: userId }, { sellerId: userId }],
            isActive: true,
        });

        res.json({
            chats,
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: Number(page),
            total,
        });
    } catch (error) {
        console.error("Lỗi trong getUserChats:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

/**
 * Lấy tin nhắn của một chat cụ thể
 * @param req - Request object chứa chatId trong params và page, limit trong query
 * @param res - Response object để trả về danh sách tin nhắn
 * @param next - NextFunction cho middleware
 */
export const getChatMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { chatId } = req.params;
        const { page = 1, limit = 50 } = req.query;
        const userId = (req as any).user.userId;

        // Kiểm tra user có quyền truy cập chat này không
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ error: "Không tìm thấy chat" });
            return;
        }

        if (!chat.buyerId.equals(userId) && !chat.sellerId.equals(userId)) {
            res.status(403).json({ error: "Không có quyền truy cập" });
            return;
        }

        // Lấy tin nhắn với phân trang
        const messages = await Message.find({ chatId })
            .populate("senderId", "fullName")
            .sort({ createdAt: -1 })
            .limit(Number(limit) * 1)
            .skip((Number(page) - 1) * Number(limit));

        const total = await Message.countDocuments({ chatId });

        res.json({
            messages: messages.reverse(), // Trả về theo thứ tự thời gian
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: Number(page),
            total,
        });
    } catch (error) {
        console.error("Lỗi trong getChatMessages:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

/**
 * Gửi tin nhắn trong chat
 * @param req - Request object chứa chatId trong params và content, messageType, metadata trong body
 * @param res - Response object để trả về tin nhắn đã tạo
 * @param next - NextFunction cho middleware
 */
export const sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { chatId } = req.params;
        const { content, messageType = "text", metadata } = req.body;
        const senderId = (req as any).user.userId;

        if (!content) {
            res.status(400).json({ error: "Nội dung tin nhắn là bắt buộc" });
            return;
        }

        // Kiểm tra user có quyền truy cập chat này không
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ error: "Không tìm thấy chat" });
            return;
        }

        if (!chat.buyerId.equals(senderId) && !chat.sellerId.equals(senderId)) {
            res.status(403).json({ error: "Không có quyền truy cập" });
            return;
        }

        // Tạo tin nhắn mới
        const messageDoc = new Message({
            chatId: new Types.ObjectId(chatId),
            senderId: new Types.ObjectId(senderId),
            content,
            messageType,
            metadata,
        });

        await messageDoc.save();

        // Cập nhật tin nhắn cuối cùng của chat
        chat.lastMessage = {
            content,
            senderId: new Types.ObjectId(senderId),
            timestamp: new Date(),
        };
        await chat.save();

        // Lấy thông tin người gửi
        await messageDoc.populate("senderId", "fullName");

        // Gửi real-time notification qua WebSocket
        try {
            const wsService = WebSocketService.getInstance();
            wsService.broadcastMessage(chatId, {
                _id: messageDoc._id,
                chatId: messageDoc.chatId,
                content: messageDoc.content,
                messageType: messageDoc.messageType,
                metadata: messageDoc.metadata,
                senderId: {
                    _id: (messageDoc.senderId as any)._id,
                    fullName: (messageDoc.senderId as any).fullName
                },
                isRead: messageDoc.isRead,
                createdAt: messageDoc.createdAt,
                timestamp: messageDoc.createdAt,
            });

            // Gửi notification cho user khác
            wsService.sendMessageNotification(chatId, senderId, content);
        } catch (error) {
            console.error("Lỗi gửi WebSocket notification:", error);
            // Không throw error vì tin nhắn đã được lưu thành công
        }

        res.status(201).json(messageDoc);
    } catch (error) {
        console.error("Lỗi trong sendMessage:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

/**
 * Đánh dấu tin nhắn đã đọc
 * @param req - Request object chứa chatId trong params
 * @param res - Response object để trả về kết quả
 * @param next - NextFunction cho middleware
 */
export const markMessagesAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { chatId } = req.params;
        const userId = (req as any).user.userId;

        // Kiểm tra user có quyền truy cập chat này không
        const chat = await Chat.findById(chatId);
        if (!chat) {
            res.status(404).json({ error: "Không tìm thấy chat" });
            return;
        }

        if (!chat.buyerId.equals(userId) && !chat.sellerId.equals(userId)) {
            res.status(403).json({ error: "Không có quyền truy cập" });
            return;
        }

        // Đánh dấu tất cả tin nhắn chưa đọc là đã đọc
        await Message.updateMany(
            { chatId, senderId: { $ne: userId }, isRead: false },
            { isRead: true }
        );

        res.json({ message: "Đã đánh dấu tin nhắn là đã đọc" });
    } catch (error) {
        console.error("Lỗi trong markMessagesAsRead:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

/**
 * Lấy số lượng tin nhắn chưa đọc của user
 * @param req - Request object
 * @param res - Response object để trả về số lượng tin nhắn chưa đọc
 * @param next - NextFunction cho middleware
 */
export const getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = (req as any).user.userId;

        // Lấy tất cả chat mà user tham gia
        const chats = await Chat.find({
            $or: [{ buyerId: userId }, { sellerId: userId }],
            isActive: true,
        }).select("_id");

        const chatIds = chats.map(chat => chat._id);

        // Đếm tin nhắn chưa đọc
        const unreadCount = await Message.countDocuments({
            chatId: { $in: chatIds },
            senderId: { $ne: userId },
            isRead: false,
        });

        res.json({ unreadCount });
    } catch (error) {
        console.error("Lỗi trong getUnreadCount:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};
