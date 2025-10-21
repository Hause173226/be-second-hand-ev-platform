import mongoose, { Schema } from "mongoose";
import { IUser } from "../interfaces/IUser";

const userSchema = new Schema<IUser>(
  {
    // New schema fields (theo database schema mới)
    email: { type: String, unique: true, sparse: true },
    phone: { type: String, unique: true, sparse: true },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
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
    fullName: { type: String }, // Map từ new schema
    password: { type: String }, // Legacy field
    citizenId: { type: String },
    dateOfBirth: { type: Date },
    role: { type: String, enum: ["user", "admin"] }, // Legacy field
    gender: { type: String, enum: ["male", "female", "other"] },
    address: { type: String },
    isActive: { type: Boolean, default: true }, // Legacy field
    otpCode: { type: String },
    otpExpires: { type: Date },
    refreshToken: { type: String },
    avatar: { type: String },
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

  next();
});

// Loại bỏ sensitive fields khi trả về JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.password;
  delete obj.refreshToken;
  delete obj.otpCode;
  return obj;
};

export const User = mongoose.model<IUser>("User", userSchema);
