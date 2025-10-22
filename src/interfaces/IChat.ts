// src/interfaces/IChat.ts
import { Types } from "mongoose";

export interface IChat {
    _id?: Types.ObjectId;
    listingId?: Types.ObjectId; // Không bắt buộc cho chat trực tiếp
    buyerId: Types.ObjectId;
    sellerId: Types.ObjectId;
    lastMessage?: {
        content: string;
        senderId: Types.ObjectId;
        timestamp: Date;
    };
    isActive: boolean;
    chatType?: "listing" | "direct"; // Thêm chatType
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IMessage {
    _id?: Types.ObjectId;
    chatId: Types.ObjectId;
    senderId: Types.ObjectId;
    content: string;
    messageType: "text" | "image" | "file" | "offer" | "appointment";
    isRead: boolean;
    metadata?: {
        offerId?: Types.ObjectId;
        appointmentId?: Types.ObjectId;
        imageUrl?: string;
        fileName?: string;
        fileSize?: number;
        fileType?: string;
        originalFileName?: string;
        editedAt?: Date;
        deletedAt?: Date;
        isDeleted?: boolean;
        deletedBy?: Types.ObjectId;
        reactions?: {
            userId: Types.ObjectId;
            emoji: string;
            createdAt: Date;
        }[];
        // Thêm support cho files array
        files?: {
            filename: string;
            originalname: string;
            url: string;
            size: number;
            mimetype: string;
            formattedSize: string;
        }[];
    };
    createdAt?: Date;
    updatedAt?: Date;
}
