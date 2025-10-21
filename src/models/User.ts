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
    fullName: { type: String }, // Map từ new schema
    password: { type: String }, // Legacy field
    citizenId: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },
    address: { type: String },
    isActive: { type: Boolean, default: true }, // Legacy field
    otpCode: { type: String },
    otpExpires: { type: Date },
    refreshToken: { type: String },
    avatar: { type: String },
    googleId: { type: String },
    facebookId: { type: String },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

// Virtual fields để map giữa old và new schema
userSchema.virtual("legacyPassword").get(function () {
  const user = this as any;
  return user.passwordHash || user.password;
});

userSchema.virtual("legacyIsActive").get(function () {
  const user = this as any;
  return user.status === "ACTIVE";
});

// Pre-save middleware để sync data
userSchema.pre("save", function (next) {
  const user = this as any;

  // Sync từ legacy fields sang new fields
  if (user.password && !user.passwordHash) {
    user.passwordHash = user.password;
  }

  if (user.isActive !== undefined && !user.status) {
    user.status = user.isActive ? "ACTIVE" : "SUSPENDED";
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
