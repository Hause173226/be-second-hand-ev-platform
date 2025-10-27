// src/services/notificationService.ts
import { WebSocketService } from "./websocketService";

export interface NotificationData {
    type: 'message' | 'appointment' | 'offer' | 'file_upload' | 'reaction' | 'typing';
    chatId: string;
    senderId: string;
    senderInfo: {
        fullName: string;
        avatar: string;
    };
    content?: string;
    metadata?: any;
    timestamp: Date;
}

export class NotificationService {
    private static instance: NotificationService;
    private wsService: WebSocketService;

    constructor() {
        this.wsService = WebSocketService.getInstance();
    }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    /**
     * Gửi notification tin nhắn mới
     */
    public async sendMessageNotification(chatId: string, senderId: string, content: string, senderInfo: any) {
        const notification: NotificationData = {
            type: 'message',
            chatId,
            senderId,
            senderInfo: {
                fullName: senderInfo.fullName,
                avatar: senderInfo.avatar || '/default-avatar.png'
            },
            content: content.length > 50 ? content.substring(0, 50) + '...' : content,
            timestamp: new Date()
        };

        // Gửi notification đến chat room
        this.wsService.sendToChat(chatId, 'message_notification', notification);

        // Gửi notification đến personal room của người gửi (confirmation)
        this.wsService.sendToUser(senderId, 'message_sent_confirmation', {
            chatId,
            messageId: 'temp',
            timestamp: new Date()
        });

        // Gửi push notification (nếu có mobile app)
        await this.sendPushNotification(notification);
    }

    /**
     * Gửi notification file upload
     */
    public async sendFileUploadNotification(chatId: string, senderId: string, files: any[], senderInfo: any) {
        const notification: NotificationData = {
            type: 'file_upload',
            chatId,
            senderId,
            senderInfo: {
                fullName: senderInfo.fullName,
                avatar: senderInfo.avatar || '/default-avatar.png'
            },
            content: `Đã gửi ${files.length} file${files.length > 1 ? 's' : ''}`,
            metadata: { files },
            timestamp: new Date()
        };

        this.wsService.sendToChat(chatId, 'file_upload_notification', notification);
        await this.sendPushNotification(notification);
    }

    /**
     * Gửi notification appointment
     */
    public async sendAppointmentNotification(chatId: string, senderId: string, appointmentData: any, senderInfo: any) {
        const notification: NotificationData = {
            type: 'appointment',
            chatId,
            senderId,
            senderInfo: {
                fullName: senderInfo.fullName,
                avatar: senderInfo.avatar || '/default-avatar.png'
            },
            content: `Đã đặt lịch hẹn vào ${new Date(appointmentData.scheduledDate).toLocaleString('vi-VN')}`,
            metadata: { appointmentData },
            timestamp: new Date()
        };

        this.wsService.sendToChat(chatId, 'appointment_notification', notification);
        await this.sendPushNotification(notification);
    }

    /**
     * Gửi notification reaction
     */
    public async sendReactionNotification(chatId: string, senderId: string, emoji: string, messageId: string, senderInfo: any) {
        const notification: NotificationData = {
            type: 'reaction',
            chatId,
            senderId,
            senderInfo: {
                fullName: senderInfo.fullName,
                avatar: senderInfo.avatar || '/default-avatar.png'
            },
            content: `Đã thêm reaction ${emoji}`,
            metadata: { emoji, messageId },
            timestamp: new Date()
        };

        this.wsService.sendToChat(chatId, 'reaction_notification', notification);
    }

    /**
     * Gửi notification typing
     */
    public async sendTypingNotification(chatId: string, senderId: string, isTyping: boolean, senderInfo: any) {
        const notification: NotificationData = {
            type: 'typing',
            chatId,
            senderId,
            senderInfo: {
                fullName: senderInfo.fullName,
                avatar: senderInfo.avatar || '/default-avatar.png'
            },
            content: isTyping ? 'đang gõ...' : 'đã dừng gõ',
            timestamp: new Date()
        };

        const eventName = isTyping ? 'user_typing' : 'user_stopped_typing';
        this.wsService.sendToChat(chatId, eventName, notification);
    }

    /**
     * Gửi push notification (placeholder - cần integrate với FCM/APNS)
     */
    private async sendPushNotification(notification: NotificationData) {
        try {
            // TODO: Implement push notification với Firebase Cloud Messaging
            // hoặc Apple Push Notification Service

            console.log('Push notification would be sent:', {
                type: notification.type,
                chatId: notification.chatId,
                senderName: notification.senderInfo.fullName,
                content: notification.content
            });

            // Example implementation:
            // await fcm.send({
            //     to: userToken,
            //     notification: {
            //         title: notification.senderInfo.fullName,
            //         body: notification.content,
            //         icon: notification.senderInfo.avatar
            //     },
            //     data: {
            //         chatId: notification.chatId,
            //         type: notification.type
            //     }
            // });
        } catch (error) {
            console.error('Error sending push notification:', error);
        }
    }

    /**
     * Gửi notification offline (khi user offline)
     */
    public async sendOfflineNotification(userId: string, notification: NotificationData) {
        try {
            // Lưu notification vào database để gửi khi user online
            // TODO: Implement offline notification storage

            console.log('Offline notification stored for user:', userId, notification);
        } catch (error) {
            console.error('Error storing offline notification:', error);
        }
    }

    /**
     * Lấy notifications chưa đọc của user
     */
    public async getUnreadNotifications(userId: string) {
        try {
            // TODO: Implement get unread notifications from database
            return [];
        } catch (error) {
            console.error('Error getting unread notifications:', error);
            return [];
        }
    }

    /**
     * Đánh dấu notification đã đọc
     */
    public async markNotificationAsRead(notificationId: string, userId: string) {
        try {
            // TODO: Implement mark notification as read
            console.log('Notification marked as read:', notificationId, userId);
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }
}