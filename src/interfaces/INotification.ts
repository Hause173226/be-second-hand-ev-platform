// src/interfaces/INotification.ts
import { Types } from "mongoose";

export interface INotification {
    _id?: Types.ObjectId;
    userId: Types.ObjectId; // Người nhận thông báo
    type: "message" | "offer" | "appointment" | "listing" | "system";
    title: string;
    message: string;
    
    // Metadata tùy theo loại thông báo
    relatedId?: Types.ObjectId; // ID của message/offer/appointment/listing
    chatId?: Types.ObjectId;
    senderId?: Types.ObjectId; // Người gửi (đối với message notification)
    
    // Trạng thái
    isRead: boolean;
    isDeleted: boolean;
    
    // Actions
    actionUrl?: string; // URL để redirect khi click vào notification
    actionText?: string; // Text của button action
    
    // Metadata bổ sung
    metadata?: {
        senderName?: string;
        senderAvatar?: string;
        messagePreview?: string;
        listingTitle?: string;
        listingImage?: string;
        offerAmount?: number;
        appointmentDate?: Date;
        [key: string]: any;
    };
    
    createdAt?: Date;
    readAt?: Date;
}
