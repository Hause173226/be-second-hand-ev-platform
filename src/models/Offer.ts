// src/models/Offer.ts
import { Schema, model } from "mongoose";
import { IOffer } from "../interfaces/IOffer";

const counterOfferSchema = new Schema(
    {
        price: { type: Number, required: true },
        message: { type: String },
        offeredBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        offeredAt: { type: Date, required: true },
    },
    { _id: false }
);

const offerSchema = new Schema<IOffer>(
    {
        listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
        buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        chatId: { type: Schema.Types.ObjectId, ref: "Chat", required: true },
        offeredPrice: { type: Number, required: true, min: 0 },
        message: { type: String },
        status: {
            type: String,
            enum: ["pending", "accepted", "rejected", "countered", "expired"],
            default: "pending",
        },
        counterOffer: { type: counterOfferSchema },
        expiresAt: { type: Date },
    },
    { timestamps: true }
);

// Index for efficient queries
offerSchema.index({ listingId: 1, status: 1 });
offerSchema.index({ buyerId: 1, createdAt: -1 });
offerSchema.index({ sellerId: 1, createdAt: -1 });
offerSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

export default model<IOffer>("Offer", offerSchema);
