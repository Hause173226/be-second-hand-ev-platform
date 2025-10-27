// src/services/notificationMessageService.ts
import NotificationMessage from "../models/NotificationMessage";
import { INotification } from "../interfaces/INotification";
import { Types } from "mongoose";
import { WebSocketService } from "./websocketService";

export class NotificationMessageService {
    // Tạo notification khi có tin nhắn mới
    async createMessageNotification(data: {
        userId: string; // Người nhận notification
        senderId: string; // Người gửi tin nhắn
        chatId: string;
        messageId: string;
        messageContent: string;
        senderName: string;
        senderAvatar?: string;
    }) {
        try {
            const notification = await NotificationMessage.create({
                userId: new Types.ObjectId(data.userId),
                type: "message",
                title: `Tin nhắn mới từ ${data.senderName}`,
                message: data.messageContent.length > 100 
                    ? data.messageContent.substring(0, 100) + "..." 
                    : data.messageContent,
                
                relatedId: new Types.ObjectId(data.messageId),
                chatId: new Types.ObjectId(data.chatId),
                senderId: new Types.ObjectId(data.senderId),
                
                isRead: false,
                isDeleted: false,
                
                actionUrl: `/messages/${data.chatId}`,
                actionText: "Xem tin nhắn",
                
                metadata: {
                    senderName: data.senderName,
                    senderAvatar: data.senderAvatar || "/default-avatar.png",
                    messagePreview: data.messageContent.substring(0, 50)
                }
            });

            // Populate thông tin sender
            await notification.populate("senderId", "fullName avatar");

            // Gửi real-time notification qua WebSocket
            try {
                const wsService = WebSocketService.getInstance();
                wsService.sendToUser(data.userId, "new_notification", {
                    _id: notification._id,
                    type: notification.type,
                    title: notification.title,
                    message: notification.message,
                    actionUrl: notification.actionUrl,
                    metadata: notification.metadata,
                    createdAt: notification.createdAt,
                    isRead: false
                });
            } catch (error) {
                console.log("WebSocket not available, notification saved to DB only");
            }

            return notification;
        } catch (error) {
            console.error("Error creating message notification:", error);
            throw error;
        }
    }

    // Lấy danh sách notification của user
    async getUserNotifications(userId: string, options?: {
        limit?: number;
        skip?: number;
        type?: string;
        isRead?: boolean;
    }) {
        const query: any = {
            userId: new Types.ObjectId(userId),
            isDeleted: false
        };

        if (options?.type) {
            query.type = options.type;
        }

        if (options?.isRead !== undefined) {
            query.isRead = options.isRead;
        }

        const notifications = await NotificationMessage.find(query)
            .populate("senderId", "fullName avatar email")
            .populate("chatId", "buyerId sellerId listingId")
            .sort({ createdAt: -1 })
            .skip(options?.skip || 0)
            .limit(options?.limit || 20);

        const total = await NotificationMessage.countDocuments(query);
        const unreadCount = await NotificationMessage.countDocuments({
            userId: new Types.ObjectId(userId),
            isDeleted: false,
            isRead: false
        });

        return {
            notifications,
            total,
            unreadCount
        };
    }

    // Đánh dấu notification đã đọc
    async markAsRead(notificationId: string, userId: string) {
        const notification = await NotificationMessage.findOneAndUpdate(
            {
                _id: new Types.ObjectId(notificationId),
                userId: new Types.ObjectId(userId)
            },
            {
                isRead: true,
                readAt: new Date()
            },
            { new: true }
        );

        if (!notification) {
            throw new Error("Notification not found");
        }

        return notification;
    }

    // Đánh dấu tất cả notification đã đọc
    async markAllAsRead(userId: string) {
        await NotificationMessage.updateMany(
            {
                userId: new Types.ObjectId(userId),
                isRead: false,
                isDeleted: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        return { success: true, message: "Đã đánh dấu tất cả thông báo là đã đọc" };
    }

    // Xóa notification (soft delete)
    async deleteNotification(notificationId: string, userId: string) {
        const notification = await NotificationMessage.findOneAndUpdate(
            {
                _id: new Types.ObjectId(notificationId),
                userId: new Types.ObjectId(userId)
            },
            {
                isDeleted: true
            },
            { new: true }
        );

        if (!notification) {
            throw new Error("Notification not found");
        }

        return { success: true, message: "Đã xóa thông báo" };
    }

    // Xóa tất cả notification đã đọc
    async deleteAllRead(userId: string) {
        await NotificationMessage.updateMany(
            {
                userId: new Types.ObjectId(userId),
                isRead: true,
                isDeleted: false
            },
            {
                isDeleted: true
            }
        );

        return { success: true, message: "Đã xóa tất cả thông báo đã đọc" };
    }

    // Lấy số lượng notification chưa đọc
    async getUnreadCount(userId: string) {
        const count = await NotificationMessage.countDocuments({
            userId: new Types.ObjectId(userId),
            isRead: false,
            isDeleted: false
        });

        return { unreadCount: count };
    }

    // Tạo notification cho offer
    async createOfferNotification(data: {
        userId: string;
        senderId: string;
        offerId: string;
        chatId: string;
        offerAmount: number;
        senderName: string;
        listingTitle?: string;
    }) {
        const notification = await NotificationMessage.create({
            userId: new Types.ObjectId(data.userId),
            type: "offer",
            title: `Đề xuất mới từ ${data.senderName}`,
            message: `${data.senderName} đã gửi đề xuất giá ${data.offerAmount.toLocaleString('vi-VN')} VNĐ`,
            
            relatedId: new Types.ObjectId(data.offerId),
            chatId: new Types.ObjectId(data.chatId),
            senderId: new Types.ObjectId(data.senderId),
            
            actionUrl: `/messages/${data.chatId}`,
            actionText: "Xem đề xuất",
            
            metadata: {
                senderName: data.senderName,
                offerAmount: data.offerAmount,
                listingTitle: data.listingTitle
            }
        });

        // Send real-time notification
        try {
            const wsService = WebSocketService.getInstance();
            wsService.sendToUser(data.userId, "new_notification", notification);
        } catch (error) {
            console.log("WebSocket not available");
        }

        return notification;
    }

    // Tạo notification cho appointment
    async createAppointmentNotification(data: {
        userId: string;
        senderId: string;
        appointmentId: string;
        chatId: string;
        scheduledDate: Date;
        senderName: string;
        listingTitle?: string;
    }) {
        const notification = await NotificationMessage.create({
            userId: new Types.ObjectId(data.userId),
            type: "appointment",
            title: `Lịch hẹn mới từ ${data.senderName}`,
            message: `${data.senderName} đã đặt lịch hẹn vào ${new Date(data.scheduledDate).toLocaleString('vi-VN')}`,
            
            relatedId: new Types.ObjectId(data.appointmentId),
            chatId: new Types.ObjectId(data.chatId),
            senderId: new Types.ObjectId(data.senderId),
            
            actionUrl: `/appointments/${data.appointmentId}`,
            actionText: "Xem lịch hẹn",
            
            metadata: {
                senderName: data.senderName,
                appointmentDate: data.scheduledDate,
                listingTitle: data.listingTitle
            }
        });

        // Send real-time notification
        try {
            const wsService = WebSocketService.getInstance();
            wsService.sendToUser(data.userId, "new_notification", notification);
        } catch (error) {
            console.log("WebSocket not available");
        }

        return notification;
    }
}

export default new NotificationMessageService();
