// src/interfaces/IChat.ts
import { Types } from "mongoose";

export interface IChat {
    _id?: Types.ObjectId;
    listingId: Types.ObjectId;
    buyerId: Types.ObjectId;
    sellerId: Types.ObjectId;
    lastMessage?: {
        content: string;
        senderId: Types.ObjectId;
        timestamp: Date;
    };
    isActive: boolean;
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
    };
    createdAt?: Date;
    updatedAt?: Date;
}
