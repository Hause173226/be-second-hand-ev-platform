import mongoose, { Schema, Document } from "mongoose";
import { IMembershipPackage } from "../interfaces/IMembershipPackage";

export interface IMembershipPackageDocument
  extends IMembershipPackage,
    Document {}

const MembershipPackageSchema = new Schema<IMembershipPackageDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    duration: {
      type: Number,
      required: true,
      default: 0,
    },
    features: {
      maxListings: {
        type: Number,
        required: true,
        default: 3,
      },
      prioritySupport: {
        type: Boolean,
        default: false,
      },
      featuredListing: {
        type: Boolean,
        default: false,
      },
      autoRenew: {
        type: Boolean,
        default: false,
      },
      badge: {
        type: String,
        default: "",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isPermanent: {
      type: Boolean,
      default: false,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Index
MembershipPackageSchema.index({ slug: 1 });
MembershipPackageSchema.index({ isActive: 1, displayOrder: 1 });

export const MembershipPackage = mongoose.model<IMembershipPackageDocument>(
  "MembershipPackage",
  MembershipPackageSchema
);
