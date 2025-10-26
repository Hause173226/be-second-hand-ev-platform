import mongoose, { Schema } from "mongoose";
import { IUser, IAddress } from "../interfaces/IUser";

// Address sub-schema
const addressSchema = new Schema(
  {
    fullAddress: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    ward: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    district: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    city: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    province: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    coordinates: {
      lat: {
        type: Number,
        min: -90,
        max: 90,
      },
      lng: {
        type: Number,
        min: -180,
        max: 180,
      },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const userSchema = new Schema<IUser>(
  {
    // Authentication fields
    email: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      match: /^[0-9+\-\s()]+$/,
    },
    emailVerified: { type: Boolean, default: false },
    roles: { type: [String], default: ["user"], required: true },
    password: {
      type: String,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["user", "staff", "admin"],
      default: "user",
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "DELETED"],
      default: "ACTIVE",
      required: true,
    },
    lastLoginAt: { type: Date },

    // Profile fields
    fullName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    avatar: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    address: addressSchema,
    rating: { type: Number, min: 0, max: 5 },
    stats: {
      soldCount: { type: Number, default: 0 },
      buyCount: { type: Number, default: 0 },
      cancelRate: { type: Number, default: 0 },
      responseTime: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
    },

    // Personal info
    citizenId: {
      type: String,
      trim: true,
      maxlength: 20,
      match: /^[0-9]+$/,
    },
    dateOfBirth: {
      type: Date,
      max: new Date(),
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      trim: true,
    },

    // OTP & Tokens
    otpCode: { type: String },
    otpExpires: { type: Date },
    refreshToken: { type: String },

    // SSO
    googleId: { type: String },
    facebookId: { type: String },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

// Pre-save middleware để sync data
userSchema.pre("save", function (next) {
  const user = this as any;

  if (user.role && (!user.roles || user.roles.length === 0)) {
    user.roles = [user.role];
  }

  if (!user.status) {
    user.status = "ACTIVE";
  }

  // Initialize stats if not exists
  if (!user.stats) {
    user.stats = {
      soldCount: 0,
      buyCount: 0,
      cancelRate: 0,
      responseTime: 0,
      completionRate: 0,
    };
  }

  next();
});

// Indexes cho performance
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ facebookId: 1 });
userSchema.index({ status: 1 });
userSchema.index({ role: 1 });

// Loại bỏ sensitive fields khi trả về JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.otpCode;
  delete obj.roles; // Chỉ giữ role (string)
  return obj;
};

export const User = mongoose.model<IUser>("User", userSchema);
