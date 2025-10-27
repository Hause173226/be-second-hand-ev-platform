// src/models/NotificationMessage.ts
import { Schema, model } from "mongoose";
import { INotification } from "../interfaces/INotification";

const notificationMessageSchema = new Schema<INotification>(
    {
        userId: { 
            type: Schema.Types.ObjectId, 
            ref: "User", 
            required: true,
            index: true 
        },
        type: { 
            type: String, 
            enum: ["message", "offer", "appointment", "listing", "system"], 
            required: true 
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        
        relatedId: { type: Schema.Types.ObjectId },
        chatId: { type: Schema.Types.ObjectId, ref: "Chat" },
        senderId: { type: Schema.Types.ObjectId, ref: "User" },
        
        isRead: { type: Boolean, default: false },
        isDeleted: { type: Boolean, default: false },
        
        actionUrl: { type: String },
        actionText: { type: String },
        
        metadata: { type: Schema.Types.Mixed },
        
        readAt: { type: Date }
    },
    { 
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
        collection: "notificationmessages"
    }
);

// Indexes for efficient queries
notificationMessageSchema.index({ userId: 1, isRead: 1 });
notificationMessageSchema.index({ userId: 1, createdAt: -1 });
notificationMessageSchema.index({ userId: 1, type: 1 });
notificationMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // Auto delete after 30 days

export default model<INotification>("NotificationMessage", notificationMessageSchema);
