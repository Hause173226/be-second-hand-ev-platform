// src/models/Profile.ts
import mongoose, { Schema } from "mongoose";
import { IProfile } from "../interfaces/IProfile";

const profileSchema = new Schema<IProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    avatar: { type: String },
    bio: { type: String, maxlength: 500 },
    location: { type: String },
    website: { type: String },
    socialMedia: {
      facebook: { type: String },
      instagram: { type: String },
      twitter: { type: String },
      linkedin: { type: String },
    },
    preferences: {
      notifications: { type: Boolean, default: true },
      emailUpdates: { type: Boolean, default: true },
      smsUpdates: { type: Boolean, default: false },
    },
    vehiclePreferences: {
      brands: [{ type: String }],
      priceRange: {
        min: { type: Number },
        max: { type: Number },
      },
      fuelTypes: [{ type: String }],
    },
    isComplete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for better performance
profileSchema.index({ userId: 1 });

export const Profile = mongoose.model<IProfile>("Profile", profileSchema);
