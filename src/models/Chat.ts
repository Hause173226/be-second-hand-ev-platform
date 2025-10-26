// src/models/Chat.ts
import { Schema, model } from "mongoose";
import { IChat } from "../interfaces/IChat";

const lastMessageSchema = new Schema(
    {
        content: { type: String, required: true },
        senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        timestamp: { type: Date, required: true },
    },
    { _id: false }
);

const chatSchema = new Schema<IChat>(
    {
        listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: false }, // Không bắt buộc cho chat trực tiếp
        buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        lastMessage: { type: lastMessageSchema },
        isActive: { type: Boolean, default: true },
        chatType: { type: String, enum: ["listing", "direct"], default: "listing" }, // Thêm chatType
    },
    { timestamps: true }
);

// Index for efficient queries
chatSchema.index({ listingId: 1, buyerId: 1, sellerId: 1 });
chatSchema.index({ buyerId: 1, isActive: 1 });
chatSchema.index({ sellerId: 1, isActive: 1 });

export default model<IChat>("Chat", chatSchema);
