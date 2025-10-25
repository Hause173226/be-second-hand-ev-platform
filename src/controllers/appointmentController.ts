// src/controllers/appointmentController.ts
import { Request, Response, NextFunction } from "express";
import Appointment from "../models/Appointment";
import Chat from "../models/Chat";
import { Types } from "mongoose";
import { WebSocketService } from "../services/websocketService";

/**
 * Tạo appointment mới
 * @param req - Request object chứa listingId, chatId, scheduledDate, location, notes trong body
 * @param res - Response object để trả về appointment đã tạo
 * @param next - NextFunction cho middleware
 */
export const createAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { listingId, chatId, scheduledDate, location, notes } = req.body;
        const buyerId = (req as any).user.userId;

        // Kiểm tra các trường bắt buộc
        if (!listingId || !chatId || !scheduledDate || !location) {
            res.status(400).json({ error: "Thiếu các trường bắt buộc" });
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

        // Kiểm tra ngày appointment phải trong tương lai
        const appointmentDate = new Date(scheduledDate);
        if (appointmentDate <= new Date()) {
            res.status(400).json({ error: "Ngày appointment phải trong tương lai" });
            return;
        }

        // Tạo appointment mới
        const appointment = new Appointment({
            listingId: new Types.ObjectId(listingId),
            buyerId: new Types.ObjectId(buyerId),
            sellerId: chat.sellerId,
            chatId: new Types.ObjectId(chatId),
            scheduledDate: appointmentDate,
            location,
            notes,
            status: "pending",
        });

        await appointment.save();

        // Tạo tin nhắn trong chat về appointment
        const Message = (await import("../models/Message")).default;
        const messageDoc = new Message({
            chatId: new Types.ObjectId(chatId),
            senderId: new Types.ObjectId(buyerId),
            content: `Đã đặt lịch xem xe vào ${appointmentDate.toLocaleString('vi-VN')} tại ${location.address}`,
            messageType: "appointment",
            metadata: {
                appointmentId: appointment._id,
            },
        });

        await messageDoc.save();

        // Cập nhật tin nhắn cuối cùng của chat
        chat.lastMessage = {
            content: messageDoc.content,
            senderId: new Types.ObjectId(buyerId),
            timestamp: new Date(),
        };
        await chat.save();

        await appointment.populate("buyerId sellerId listingId", "fullName phone email make model year");

        // Gửi real-time notification qua WebSocket
        try {
            const wsService = WebSocketService.getInstance();
            wsService.broadcastAppointment(chatId, {
                _id: appointment._id,
                listingId: appointment.listingId,
                chatId: appointment.chatId,
                buyerId: appointment.buyerId,
                scheduledDate: appointment.scheduledDate,
                location: appointment.location,
                notes: appointment.notes,
                status: appointment.status,
                createdAt: appointment.createdAt,
            });
        } catch (error) {
            console.error("Lỗi gửi WebSocket notification:", error);
        }

        res.status(201).json(appointment);
    } catch (error) {
        console.error("Lỗi trong createAppointment:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

/**
 * Lấy danh sách appointments của user
 * @param req - Request object chứa status, page, limit trong query
 * @param res - Response object để trả về danh sách appointments
 * @param next - NextFunction cho middleware
 */
export const getUserAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = (req as any).user.userId;
        const { status, page = 1, limit = 20 } = req.query;

        // Tìm tất cả appointments mà user tham gia (là buyer hoặc seller)
        const filter: any = {
            $or: [{ buyerId: userId }, { sellerId: userId }],
        };

        // Lọc theo trạng thái nếu có
        if (status) {
            filter.status = status;
        }

        // Lấy appointments với phân trang
        const appointments = await Appointment.find(filter)
            .populate("buyerId sellerId listingId", "fullName phone email make model year priceListed photos")
            .sort({ scheduledDate: 1 })
            .limit(Number(limit) * 1)
            .skip((Number(page) - 1) * Number(limit));

        const total = await Appointment.countDocuments(filter);

        res.json({
            appointments,
            totalPages: Math.ceil(total / Number(limit)),
            currentPage: Number(page),
            total,
        });
    } catch (error) {
        console.error("Lỗi trong getUserAppointments:", error);
        res.status(500).json({ error: "Lỗi máy chủ nội bộ" });
    }
};

// Update appointment status
export const updateAppointmentStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { appointmentId } = req.params;
        const { status, notes } = req.body;
        const userId = (req as any).user.userId;

        if (!status) {
            res.status(400).json({ error: "Status is required" });
            return;
        }

        const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
        if (!validStatuses.includes(status)) {
            res.status(400).json({ error: "Invalid status" });
            return;
        }

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            res.status(404).json({ error: "Appointment not found" });
            return;
        }

        // Only buyer or seller can update status
        if (!appointment.buyerId.equals(userId) && !appointment.sellerId.equals(userId)) {
            res.status(403).json({ error: "Access denied" });
            return;
        }

        // Update appointment
        appointment.status = status as any;
        if (notes) {
            appointment.notes = notes;
        }

        await appointment.save();

        // Create a message in the chat about the status update
        const Message = (await import("../models/Message")).default;
        const statusMessages = {
            confirmed: "Đã xác nhận lịch hẹn",
            cancelled: "Đã hủy lịch hẹn",
            completed: "Đã hoàn thành lịch hẹn",
        };

        if (statusMessages[status as keyof typeof statusMessages]) {
            const messageDoc = new Message({
                chatId: appointment.chatId,
                senderId: new Types.ObjectId(userId),
                content: statusMessages[status as keyof typeof statusMessages],
                messageType: "appointment",
                metadata: {
                    appointmentId: appointment._id,
                },
            });

            await messageDoc.save();

            // Update chat's last message
            const chat = await Chat.findById(appointment.chatId);
            if (chat) {
                chat.lastMessage = {
                    content: messageDoc.content,
                    senderId: new Types.ObjectId(userId),
                    timestamp: new Date(),
                };
                await chat.save();
            }
        }

        await appointment.populate("buyerId sellerId listingId", "fullName phone email make model year");

        res.json(appointment);
    } catch (error) {
        console.error("Error in updateAppointmentStatus:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Get appointment by ID
export const getAppointmentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { appointmentId } = req.params;
        const userId = (req as any).user.userId;

        const appointment = await Appointment.findById(appointmentId)
            .populate("buyerId sellerId listingId", "fullName phone email make model year priceListed photos");

        if (!appointment) {
            res.status(404).json({ error: "Appointment not found" });
            return;
        }

        // Check access
        if (!appointment.buyerId.equals(userId) && !appointment.sellerId.equals(userId)) {
            res.status(403).json({ error: "Access denied" });
            return;
        }

        res.json(appointment);
    } catch (error) {
        console.error("Error in getAppointmentById:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Delete appointment
export const deleteAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { appointmentId } = req.params;
        const userId = (req as any).user.userId;

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            res.status(404).json({ error: "Appointment not found" });
            return;
        }

        // Only buyer can delete pending appointments
        if (!appointment.buyerId.equals(userId)) {
            res.status(403).json({ error: "Access denied" });
            return;
        }

        if (appointment.status !== "pending") {
            res.status(400).json({ error: "Can only delete pending appointments" });
            return;
        }

        await Appointment.findByIdAndDelete(appointmentId);

        res.json({ message: "Appointment deleted successfully" });
    } catch (error) {
        console.error("Error in deleteAppointment:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
