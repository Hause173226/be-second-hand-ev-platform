// src/models/Appointment.ts
import { Schema, model } from "mongoose";
import { IAppointment } from "../interfaces/IAppointment";

const coordinatesSchema = new Schema(
    {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
    },
    { _id: false }
);

const locationSchema = new Schema(
    {
        address: { type: String, required: true },
        city: { type: String, required: true },
        district: { type: String, required: true },
        coordinates: { type: coordinatesSchema },
    },
    { _id: false }
);

const appointmentSchema = new Schema<IAppointment>(
    {
        listingId: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
        buyerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        sellerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        chatId: { type: Schema.Types.ObjectId, ref: "Chat", required: true },
        scheduledDate: { type: Date, required: true },
        location: { type: locationSchema, required: true },
        status: {
            type: String,
            enum: ["pending", "confirmed", "cancelled", "completed"],
            default: "pending",
        },
        notes: { type: String },
    },
    { timestamps: true }
);

// Index for efficient queries
appointmentSchema.index({ listingId: 1, status: 1 });
appointmentSchema.index({ buyerId: 1, scheduledDate: 1 });
appointmentSchema.index({ sellerId: 1, scheduledDate: 1 });

export default model<IAppointment>("Appointment", appointmentSchema);
