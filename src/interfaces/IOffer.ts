// src/interfaces/IOffer.ts
import { Types } from "mongoose";

export interface IOffer {
    _id?: Types.ObjectId;
    listingId: Types.ObjectId;
    buyerId: Types.ObjectId;
    sellerId: Types.ObjectId;
    chatId: Types.ObjectId;
    offeredPrice: number;
    message?: string;
    status: "pending" | "accepted" | "rejected" | "countered" | "expired";
    counterOffer?: {
        price: number;
        message?: string;
        offeredBy: Types.ObjectId;
        offeredAt: Date;
    };
    expiresAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}
