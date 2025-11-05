// src/services/depositNotificationService.ts
import { NotificationDeposit } from "../models/NotificationDeposit";
import { WebSocketService } from "./websocketService";
import { User } from "../models/User";
import emailService from "./emailService";

export class DepositNotificationService {
    private static instance: DepositNotificationService;
    private wsService?: WebSocketService;

    constructor() {}

    // Lazy get WebSocket service
    private getWsService() {
        try {
            return WebSocketService.getInstance();
        } catch (error) {
            console.warn('WebSocketService not ready yet');
            return null;
        }
    }

    public static getInstance(): DepositNotificationService {
        if (!DepositNotificationService.instance) {
            DepositNotificationService.instance = new DepositNotificationService();
        }
        return DepositNotificationService.instance;
    }

    /**
     * Gửi notification khi có yêu cầu đặt cọc mới
     */
    public async sendDepositRequestNotification(sellerId: string, depositRequest: any, buyerInfo: any, listingInfo?: any) {
        try {

            
            // Tạo notification trong database
            // Tạo message với thông tin sản phẩm
            const make = listingInfo?.make || '';
            const model = listingInfo?.model || '';
            const year = listingInfo?.year || '';
            
            // Tạo tên sản phẩm từ make, model, year
            const productName = make && model && year 
                ? `${make} ${model} ${year}`.trim()
                : listingInfo?.title || 'sản phẩm';
            
            const notification = new NotificationDeposit({
                userId: sellerId,
                type: 'deposit',
                title: 'Có yêu cầu đặt cọc mới',
                message: `${buyerInfo.fullName || buyerInfo.email} muốn đặt cọc ${depositRequest.depositAmount?.toLocaleString('vi-VN')} VND cho ${productName}`,
                depositId: depositRequest._id?.toString(),
                metadata: {
                    listingId: depositRequest.listingId,
                    amount: depositRequest.depositAmount,
                    status: depositRequest.status,
                    buyerId: depositRequest.buyerId,
                    buyerName: buyerInfo.fullName || buyerInfo.email,
                    listingTitle: listingInfo?.title,
                    listingBrand: listingInfo?.make,  // Sửa từ brand thành make
                    listingModel: listingInfo?.model,
                    listingYear: listingInfo?.year,
                },
                isRead: false,
            });

            await notification.save();

            // Gửi qua WebSocket
            const wsService = this.getWsService();
            if (wsService) {
                wsService.sendToUser(sellerId, 'deposit_notification', {
                    notificationId: notification._id,
                    type: 'deposit',
                    title: notification.title,
                    message: notification.message,
                    depositId: depositRequest._id,
                    metadata: notification.metadata,
                    timestamp: notification.createdAt,
                });
            }

            console.log('Deposit notification sent to seller:', sellerId);

            // Gửi email cho seller
            try {
                await emailService.sendDepositRequestEmail(
                    sellerId,
                    buyerInfo,
                    listingInfo,
                    depositRequest.depositAmount
                );
                console.log('Email thông báo đặt cọc đã được gửi cho seller');
            } catch (emailError) {
                console.error('Error sending deposit email:', emailError);
                // Không throw error để không ảnh hưởng đến flow chính
            }

            return notification;
        } catch (error) {
            console.error('Error sending deposit notification:', error);
            throw error;
        }
    }

    /**
     * Gửi notification khi seller xác nhận/từ chối đặt cọc
     */
    public async sendDepositConfirmationNotification(
        buyerId: string, 
        depositRequest: any, 
        sellerInfo: any,
        action: 'accept' | 'reject',
        listingInfo?: any
    ) {
        try {
            
            // Tạo message với thông tin sản phẩm
            const make = listingInfo?.make || '';
            const model = listingInfo?.model || '';
            const year = listingInfo?.year || '';
            
            // Tạo tên sản phẩm từ make, model, year
            const productName = make && model && year 
                ? `${make} ${model} ${year}`.trim()
                : listingInfo?.title || 'sản phẩm';
            
            const status = action === 'accept' ? 'accepted' : 'rejected';
            const title = action === 'accept' 
                ? 'Đặt cọc được chấp nhận' 
                : 'Đặt cọc bị từ chối';
            const message = action === 'accept'
                ? `${sellerInfo.fullName || sellerInfo.email} đã chấp nhận yêu cầu đặt cọc ${depositRequest.depositAmount?.toLocaleString('vi-VN')} VND cho ${productName}`
                : `${sellerInfo.fullName || sellerInfo.email} đã từ chối yêu cầu đặt cọc ${depositRequest.depositAmount?.toLocaleString('vi-VN')} VND cho ${productName}`;

            // Tạo notification trong database
            const notification = new NotificationDeposit({
                userId: buyerId,
                type: 'deposit_confirmation',
                title,
                message,
                depositId: depositRequest._id?.toString(),
                metadata: {
                    listingId: depositRequest.listingId,
                    amount: depositRequest.depositAmount,
                    status,
                    sellerId: depositRequest.sellerId,
                    sellerName: sellerInfo.fullName || sellerInfo.email,
                    listingTitle: listingInfo?.title,
                    listingBrand: listingInfo?.make,  // Sửa từ brand thành make
                    listingModel: listingInfo?.model,
                    listingYear: listingInfo?.year,
                },
                isRead: false,
            });

            await notification.save();

            // Gửi qua WebSocket
            const wsService = this.getWsService();
            if (wsService) {
                wsService.sendToUser(buyerId, 'deposit_confirmation', {
                    notificationId: notification._id,
                    type: 'deposit_confirmation',
                    title,
                    message,
                    depositId: depositRequest._id,
                    status,
                    metadata: notification.metadata,
                    timestamp: notification.createdAt,
                });
            }

            console.log('Deposit confirmation notification sent to buyer:', buyerId);

            return notification;
        } catch (error) {
            console.error('Error sending deposit confirmation notification:', error);
            throw error;
        }
    }

    /**
     * Gửi notification hợp đồng
     */
    public async sendContractNotification(receiverId: string, contract: any, senderInfo: any) {
        try {
            const notification = new NotificationDeposit({
                userId: receiverId,
                type: 'contract',
                title: 'Hợp đồng mới',
                message: `Hợp đồng đã được tạo cho giao dịch của bạn`,
                contractId: contract._id?.toString(),
                metadata: {
                    appointmentId: contract.appointmentId,
                    depositId: contract.depositId,
                    status: contract.status,
                    staffId: contract.staffId,
                    staffName: senderInfo.fullName || 'Nhân viên',
                },
                isRead: false,
            });

            await notification.save();

            const wsService = this.getWsService();
            if (wsService) {
                wsService.sendToUser(receiverId, 'contract_notification', {
                    notificationId: notification._id,
                    type: 'contract',
                    title: notification.title,
                    message: notification.message,
                    contractId: contract._id,
                    metadata: notification.metadata,
                    timestamp: notification.createdAt,
                });
            }

            console.log('Contract notification sent to user:', receiverId);

            return notification;
        } catch (error) {
            console.error('Error sending contract notification:', error);
            throw error;
        }
    }

    /**
     * Gửi notification khi appointment bị reject bởi buyer
     */
    public async sendAppointmentRejectedNotification(
        sellerId: string,
        buyerInfo: any,
        appointment: any,
        reason: string,
        listingInfo?: any
    ) {
        try {
            // Tạo notification trong database
            const make = listingInfo?.make || '';
            const model = listingInfo?.model || '';
            const year = listingInfo?.year || '';
            
            // Tạo tên sản phẩm từ make, model, year
            const productName = make && model && year 
                ? `${make} ${model} ${year}`.trim()
                : listingInfo?.title || 'sản phẩm';
            
            const notification = new NotificationDeposit({
                userId: sellerId,
                type: 'appointment_rejected',
                title: 'Người mua đã từ chối lịch hẹn',
                message: `${buyerInfo.fullName || 'Người mua'} đã từ chối lịch hẹn cho ${productName}${reason ? `. Lý do: ${reason}` : ''}`,
                appointmentId: String(appointment._id),
                metadata: {
                    listingId: listingInfo?._id,
                    amount: listingInfo?.price,
                    status: appointment.status,
                    listingTitle: listingInfo?.title,
                    make: listingInfo?.make,
                    model: listingInfo?.model,
                    year: listingInfo?.year,
                    buyerId: buyerInfo._id,
                    buyerName: buyerInfo.fullName,
                    sellerId: sellerId,
                    sellerName: (await User.findById(sellerId))?.fullName,
                    reason: reason,
                    scheduledDate: appointment.scheduledDate,
                    depositRequestId: appointment.depositRequestId
                },
                isRead: false
            });

            await notification.save();

            // Gửi WebSocket notification (nếu có)
            const wsService = this.getWsService();
            if (wsService) {
                wsService.sendToUser(sellerId, 'appointment_rejected', {
                    notificationId: notification._id,
                    type: 'appointment_rejected',
                    title: notification.title,
                    message: notification.message,
                    appointmentId: appointment._id,
                    metadata: notification.metadata,
                    timestamp: notification.createdAt
                });
            }

            // Gửi email (đã có method sẵn trong emailService)
            await emailService.sendAppointmentRejectedByBuyerNotification(
                sellerId,
                buyerInfo,
                appointment,
                reason,
                listingInfo
            );

        } catch (error) {
            console.error('Error sending appointment rejection notification:', error);
            throw error;
        }
    }

    /**
     * Gửi notification khi tạo lịch hẹn
     */
    public async sendAppointmentCreatedNotification(
        receiverId: string,
        appointment: any,
        otherPartyInfo: any,
        listingInfo?: any
    ) {
        try {
            // Tạo message với thông tin sản phẩm
            const make = listingInfo?.make || '';
            const model = listingInfo?.model || '';
            const year = listingInfo?.year || '';
            
            // Tạo tên sản phẩm từ make, model, year
            const productName = make && model && year 
                ? `${make} ${model} ${year}`.trim()
                : listingInfo?.title || 'sản phẩm';
            
            const notification = new NotificationDeposit({
                userId: receiverId,
                type: 'appointment_created',
                title: 'Lịch hẹn ký hợp đồng đã được tạo',
                message: `Lịch hẹn ký hợp đồng cho ${productName} đã được tạo vào ${appointment.scheduledDate.toLocaleDateString('vi-VN')} tại ${appointment.location}`,
                appointmentId: appointment._id?.toString(),
                metadata: {
                    appointmentId: appointment._id,
                    scheduledDate: appointment.scheduledDate,
                    location: appointment.location,
                    status: appointment.status,
                    type: appointment.type,
                    otherPartyId: otherPartyInfo._id,
                    otherPartyName: otherPartyInfo.fullName || otherPartyInfo.email,
                    listingTitle: listingInfo?.title,
                    listingBrand: listingInfo?.make,
                    listingModel: listingInfo?.model,
                    listingYear: listingInfo?.year,
                },
                isRead: false,
            });

            await notification.save();

            // Gửi qua WebSocket
            const wsService = this.getWsService();
            if (wsService) {
                wsService.sendToUser(receiverId, 'appointment_created', {
                    notificationId: notification._id,
                    type: 'appointment_created',
                    title: notification.title,
                    message: notification.message,
                    appointmentId: appointment._id,
                    metadata: notification.metadata,
                    timestamp: notification.createdAt,
                });
            }

            console.log('Appointment created notification sent to user:', receiverId);

            return notification;
        } catch (error) {
            console.error('Error sending appointment created notification:', error);
            throw error;
        }
    }

    /**
     * Gửi notification hoàn thành giao dịch
     */
    public async sendTransactionCompleteNotification(
        buyerId: string, 
        sellerId: string, 
        transaction: any
    ) {
        try {
            const messages = [
                {
                    userId: buyerId,
                    title: 'Giao dịch hoàn thành',
                    message: 'Giao dịch mua xe đã hoàn thành thành công',
                },
                {
                    userId: sellerId,
                    title: 'Giao dịch hoàn thành',
                    message: 'Giao dịch bán xe đã hoàn thành thành công',
                },
            ];

            const notifications = [];

            for (const msg of messages) {
                const notification = new NotificationDeposit({
                    userId: msg.userId,
                    type: 'transaction_complete',
                    title: msg.title,
                    message: msg.message,
                    transactionId: transaction._id?.toString(),
                    metadata: {
                        transactionId: transaction._id,
                        amount: transaction.amount,
                        status: transaction.status,
                        contractId: transaction.contractId,
                    },
                    isRead: false,
                });

                await notification.save();
                notifications.push(notification);

                const wsService = this.getWsService();
                if (wsService) {
                    wsService.sendToUser(msg.userId, 'transaction_complete', {
                        notificationId: notification._id,
                        type: 'transaction_complete',
                        title: notification.title,
                        message: notification.message,
                        transactionId: transaction._id,
                        metadata: notification.metadata,
                        timestamp: notification.createdAt,
                    });
                }
            }

            console.log('Transaction complete notification sent to buyer and seller');

            return notifications;
        } catch (error) {
            console.error('Error sending transaction complete notification:', error);
            throw error;
        }
    }

    /**
     * Lấy tất cả notification của user
     */
    public async    getUserNotifications(userId: string, options?: {
        isRead?: boolean;
        type?: string;
        limit?: number;
        page?: number;
    }) {
        try {
            const query: any = { userId };

            if (options?.isRead !== undefined) {
                query.isRead = options.isRead;
            }

            if (options?.type) {
                query.type = options.type;
            }

            const limit = options?.limit || 20;
            const page = options?.page || 1;
            const skip = (page - 1) * limit;

            const NotificationDepositModel = (await import('../models/NotificationDeposit')).NotificationDeposit;
            
            const notifications = await NotificationDepositModel.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(skip);

            const total = await NotificationDepositModel.countDocuments(query);

            return {
                notifications,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            };
        } catch (error) {
            console.error('Error getting user notifications:', error);
            throw error;
        }
    }

    /**
     * Đánh dấu notification là đã đọc
     */
    public async markAsRead(notificationId: string, userId: string) {
        try {
            const NotificationDepositModel = (await import('../models/NotificationDeposit')).NotificationDeposit;
            
            const notification = await NotificationDepositModel.findOne({
                _id: notificationId,
                userId,
            });

            if (!notification) {
                throw new Error('Notification not found');
            }

            notification.isRead = true;
            notification.readAt = new Date();
            await notification.save();

            return notification;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }

    /**
     * Đánh dấu tất cả notification là đã đọc
     */
    public async markAllAsRead(userId: string) {
        try {
            const NotificationDepositModel = (await import('../models/NotificationDeposit')).NotificationDeposit;
            
            const result = await NotificationDepositModel.updateMany(
                { userId, isRead: false },
                { 
                    isRead: true, 
                    readAt: new Date() 
                }
            );

            return result;
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            throw error;
        }
    }

    /**
     * Đếm số notification chưa đọc
     */
    public async getUnreadCount(userId: string) {
        try {
            const NotificationDepositModel = (await import('../models/NotificationDeposit')).NotificationDeposit;
            
            const count = await NotificationDepositModel.countDocuments({
                userId,
                isRead: false,
            });

            return count;
        } catch (error) {
            console.error('Error getting unread count:', error);
            throw error;
        }
    }

    /**
     * Xóa notification
     */
    public async deleteNotification(notificationId: string, userId: string) {
        try {
            const mongoose = await import('mongoose');
            
            const NotificationDepositModel = (await import('../models/NotificationDeposit')).NotificationDeposit;
            
            const notification = await NotificationDepositModel.findOneAndDelete({
                _id: new mongoose.default.Types.ObjectId(notificationId),
                userId,
            });

            if (!notification) {
                throw new Error('Notification not found');
            }

            return notification;
        } catch (error) {
            console.error('Error deleting notification:', error);
            throw error;
        }
    }
}

export default DepositNotificationService.getInstance();

