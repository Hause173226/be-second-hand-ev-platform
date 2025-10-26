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

const userSchema = new Schema<IUser>(
  {
    // New schema fields (theo database schema mới)
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    emailVerified: { type: Boolean, default: false },
    passwordHash: { type: String },
    roles: { type: [String], default: ["member"], required: true },
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

// Loại bỏ sensitive fields khi trả về JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
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
