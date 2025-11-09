// src/models/NotificationDeposit.ts
import mongoose from "mongoose";

export interface INotificationDeposit extends mongoose.Document {
    userId: string; // Người nhận notification
    type: 'deposit' | 'deposit_confirmation' | 'contract' | 'transaction_complete' | 'appointment_created' | 'appointment_rejected' | 'appointment_cancelled' | 'transaction_cancelled';
    title: string;
    message: string;
    depositId?: string; // ID deposit request
    appointmentId?: string; // ID appointment
    contractId?: string; // ID contract
    transactionId?: string; // ID transaction
    metadata?: {
        listingId?: string;
        amount?: number;
        status?: string;
        // Thông tin sản phẩm
        listingTitle?: string;
        listingBrand?: string;
        listingModel?: string;
        listingYear?: string;
        // Thông tin buyer/seller
        buyerId?: string;
        buyerName?: string;
        sellerId?: string;
        sellerName?: string;
        [key: string]: any;
    };
    isRead: boolean;
    readAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const NotificationDepositSchema = new mongoose.Schema<INotificationDeposit>(
    {
        userId: {
            type: String,
            required: true,
            index: true, // Để query nhanh
        },
        type: {
            type: String,
            enum: ['deposit', 'deposit_confirmation', 'contract', 'transaction_complete', 'appointment_created', 'appointment_rejected', 'appointment_cancelled', 'transaction_cancelled'],
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        depositId: {
            type: String,
            index: true,
        },
        appointmentId: {
            type: String,
            index: true,
        },
        transactionId: {
            type: String,
            index: true,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
        readAt: {
            type: Date,
        },
    },
    {
        timestamps: true, // Tự động thêm createdAt và updatedAt
    }
);

// Indexes cho performance
NotificationDepositSchema.index({ userId: 1, isRead: 1 }); // Query theo user và trạng thái đã đọc
NotificationDepositSchema.index({ userId: 1, createdAt: -1 }); // Query theo user và thời gian tạo
NotificationDepositSchema.index({ type: 1 });

export const NotificationDeposit = mongoose.model<INotificationDeposit>("NotificationDeposit", NotificationDepositSchema);

