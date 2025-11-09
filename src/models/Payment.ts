import mongoose, { Schema, Document } from "mongoose";
import { IPaymentHistory } from "../interfaces/IPayment";

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  description: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  method: "VNPAY" | "WALLET" | "BANK_TRANSFER";
  transactionId?: string;
  metadata?: {
    type?: "MEMBERSHIP" | "MEMBERSHIP_RENEW" | "DEPOSIT" | "WITHDRAWAL";
    packageId?: string;
    months?: number;
    pricing?: any;
    [key: string]: any;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"],
      default: "PENDING",
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: ["VNPAY", "WALLET", "BANK_TRANSFER"],
      required: true,
    },
    transactionId: {
      type: String,
      index: true,
      sparse: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// ✅ Indexes
paymentSchema.index({ userId: 1, createdAt: -1 }); // Query payment history
paymentSchema.index({ status: 1 }); // Filter by status

// ✅ XÓA index này nếu có:
// paymentSchema.index({ transactionId: 1 }, { unique: true }); // ← XÓA

export const Payment = mongoose.model<IPayment>("Payment", paymentSchema);

// ========== PaymentHistory (giữ nguyên) ==========
const paymentHistorySchema = new Schema<IPaymentHistory>(
  {
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true },
    amount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank_transfer", "credit_card", "e_wallet", "online"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed", "refunded"],
      required: true,
    },
    transactionId: { type: String },
    gatewayResponse: { type: Schema.Types.Mixed },
    processedAt: { type: Date, default: Date.now },
    notes: { type: String },
  },
  { timestamps: true }
);

export const PaymentHistory = mongoose.model<IPaymentHistory>(
  "PaymentHistory",
  paymentHistorySchema
);
