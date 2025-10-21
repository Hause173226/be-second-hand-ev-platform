import mongoose, { Schema } from "mongoose";
import { IProfile, IAddress } from "../interfaces/IProfile";

// Address sub-schema
const addressSchema = new Schema<IAddress>(
  {
    type: {
      type: String,
      enum: ["home", "work", "other"],
      required: true,
    },
    name: { type: String, required: true },
    fullAddress: { type: String, required: true },
    ward: { type: String, required: true },
    district: { type: String, required: true },
    city: { type: String, required: true },
    province: { type: String, required: true },
    postalCode: { type: String },
    isDefault: { type: Boolean, default: false },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Main Profile schema
const profileSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    fullName: { type: String },
    avatarUrl: { type: String },
    addresses: [addressSchema],
    kycLevel: {
      type: String,
      enum: ["NONE", "BASIC", "ADVANCED"],
      default: "NONE",
    },
    rating: { type: Number, min: 0, max: 5 },
    stats: {
      soldCount: { type: Number, default: 0 },
      buyCount: { type: Number, default: 0 },
      cancelRate: { type: Number, default: 0 },
      responseTime: { type: Number, default: 0 }, // hours
      completionRate: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Indexes
profileSchema.index({ userId: 1 }, { unique: true });
profileSchema.index({ kycLevel: 1 });
profileSchema.index({ rating: 1 });

export const Profile = mongoose.model<IProfile>("Profile", profileSchema);
