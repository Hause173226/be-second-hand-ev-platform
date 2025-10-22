// src/models/Message.ts
import { Schema, model } from "mongoose";
import { IMessage } from "../interfaces/IChat";

const metadataSchema = new Schema(
    {
        offerId: { type: Schema.Types.ObjectId, ref: "Offer" },
        appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment" },
        imageUrl: { type: String },
        fileName: { type: String },
        fileSize: { type: Number },
        fileType: { type: String },
        originalFileName: { type: String },
        editedAt: { type: Date },
        deletedAt: { type: Date },
        isDeleted: { type: Boolean, default: false },
        deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
        reactions: [{
            userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
            emoji: { type: String, required: true },
            createdAt: { type: Date, default: Date.now }
        }],
        // Thêm support cho files array
        files: [{
            filename: { type: String },
            originalname: { type: String },
            url: { type: String },
            size: { type: Number },
            mimetype: { type: String },
            formattedSize: { type: String }
        }]
    },
    { _id: false }
);

const messageSchema = new Schema<IMessage>(
    {
        chatId: { type: Schema.Types.ObjectId, ref: "Chat", required: true },
        senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        content: { type: String, required: true },
        messageType: {
            type: String,
            enum: ["text", "image", "file", "offer", "appointment"],
            default: "text",
        },
        isRead: { type: Boolean, default: false },
        metadata: { type: metadataSchema },
    },
    { timestamps: true }
);

// Index for efficient queries
messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, isRead: 1 });

export default model<IMessage>("Message", messageSchema);
