// src/interfaces/IAppointment.ts
import { Types } from "mongoose";

export interface IAppointment {
    _id?: Types.ObjectId;
    listingId: Types.ObjectId;
    buyerId: Types.ObjectId;
    sellerId: Types.ObjectId;
    chatId: Types.ObjectId;
    scheduledDate: Date;
    location: {
        address: string;
        city: string;
        district: string;
        coordinates?: {
            lat: number;
            lng: number;
        };
    };
    status: "pending" | "confirmed" | "cancelled" | "completed";
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
}
