import mongoose, { Schema } from "mongoose";
import { IUser, IAddress } from "../interfaces/IUser";

// Address sub-schema
const addressSchema = new Schema<IAddress>(
  {
    fullAddress: { type: String, required: true },
    ward: { type: String, required: true },
    district: { type: String, required: true },
    city: { type: String, required: true },
    province: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Address sub-schema
const addressSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["home", "work", "other"],
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    fullAddress: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    ward: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    district: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    province: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    postalCode: {
      type: String,
      trim: true,
      maxlength: 10,
    },
    isDefault: { type: Boolean, default: false },
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

// Payment Method sub-schema
const paymentMethodSchema = new Schema(
  {
    provider: {
      type: String,
      enum: ["stripe", "xpay", "momo", "zalopay", "bank"],
      required: true,
    },
    tokenId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    brand: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    last4: {
      type: String,
      trim: true,
      maxlength: 4,
      match: /^\d{4}$/,
    },
    isDefault: { type: Boolean, default: false },
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
    passwordHash: { type: String },
    roles: { type: [String], default: ["member"], required: true },
    phoneVerified: { type: Boolean, default: false },
    password: {
      type: String,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
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

    // Legacy fields (để backward compatibility)
    fullName: { type: String },
    password: { type: String },
    citizenId: { type: String },
    dateOfBirth: { type: Date },
    role: { type: String, enum: ["user", "admin"] },
    gender: { type: String, enum: ["male", "female", "other"] },
    isActive: { type: Boolean, default: true },
    otpCode: { type: String },
    otpExpires: { type: Date },
    refreshToken: { type: String },
    avatar: { type: String },

    // SSO IDs
    googleId: { type: String },
    facebookId: { type: String },

    // Profile stats
    rating: { type: Number, min: 0, max: 5 },
    stats: {
      soldCount: { type: Number, default: 0 },
      buyCount: { type: Number, default: 0 },
      cancelRate: { type: Number, default: 0 },
      responseTime: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
    },

    // Addresses
    addresses: addressSchema,
    // Profile fields (tích hợp từ Profile)
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
    addresses: [addressSchema],
    paymentMethods: [paymentMethodSchema],
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

// Virtual fields để map giữa old và new schema
userSchema.virtual("legacyPassword").get(function () {
  return this.passwordHash || this.password;
});

userSchema.virtual("legacyRole").get(function () {
  return this.roles && this.roles.length > 0 ? this.roles[0] : this.role;
});

userSchema.virtual("legacyIsActive").get(function () {
  return this.status === "ACTIVE";
});

// Pre-save middleware để sync data
userSchema.pre("save", function (next) {
  // Sync từ legacy fields sang new fields
  if (this.password && !this.passwordHash) {
    this.passwordHash = this.password;
  }

  if (this.role && (!this.roles || this.roles.length === 0)) {
    this.roles = [this.role];
  }

  if (this.isActive !== undefined && !this.status) {
    this.status = this.isActive ? "ACTIVE" : "SUSPENDED";
  }

  // Initialize stats if not exists
  if (!this.stats) {
    this.stats = {
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
  delete obj.kycLevel;
  delete obj.paymentMethods;
  delete obj.isActive; // Redundant với status
  delete obj.roles; // Chỉ giữ role (string)
  if (obj.phoneVerified !== undefined) delete obj.phoneVerified; // Đã bỏ field này
  return obj;
};

export const User = mongoose.model<IUser>("User", userSchema);
