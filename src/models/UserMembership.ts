import mongoose, { Schema, Document } from "mongoose";
import { IUserMembership } from "../interfaces/IUserMembership";

export interface IUserMembershipDocument extends IUserMembership, Document {}

const UserMembershipSchema = new Schema<IUserMembershipDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    packageId: {
      type: Schema.Types.ObjectId,
      ref: "MembershipPackage",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: false, // ✅ CHỈ SỬA: false thay vì true (để hỗ trợ gói FREE = null)
      default: null, // ✅ THÊM: default null
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    autoRenew: {
      type: Boolean,
      default: false,
    },
    listingsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
    },
    transactionId: {
      type: String,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "CANCELLED"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
UserMembershipSchema.index({ userId: 1, status: 1 });
UserMembershipSchema.index({ endDate: 1 });
UserMembershipSchema.index({ userId: 1, endDate: -1 });

// Virtual để check còn hạn không
UserMembershipSchema.virtual("isExpired").get(function (
  this: IUserMembershipDocument
) {
  // ✅ FIX: Handle null endDate (gói FREE vĩnh viễn)
  if (!this.endDate) return false; // Vĩnh viễn không bao giờ expired
  return this.endDate < new Date();
});

export const UserMembership = mongoose.model<IUserMembershipDocument>(
  "UserMembership",
  UserMembershipSchema
);
