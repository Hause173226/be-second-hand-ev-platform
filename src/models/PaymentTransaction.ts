// src/models/PaymentTransaction.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IPaymentTransaction extends Document {
  orderId: string; // vnp_TxnRef từ VNPay
  userId: string; // ID người dùng
  amount: number; // Số tiền (VND)
  status: "PENDING" | "SUCCESS" | "FAILED";
  responseCode: string; // Mã phản hồi từ VNPay
  vnp_TransactionNo?: string; // Mã giao dịch từ VNPay
  processedAt?: Date; // Thời gian xử lý
  description?: string; // Mô tả
  listingId?: string; // ID listing (cho thanh toán toàn bộ)
  depositRequestId?: string; // ID deposit request (cho đặt cọc)
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema = new Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true, // Đảm bảo mỗi orderId chỉ được xử lý 1 lần
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
    },
    responseCode: {
      type: String,
      required: true,
    },
    vnp_TransactionNo: {
      type: String,
    },
    processedAt: {
      type: Date,
    },
    description: {
      type: String,
    },
    listingId: {
      type: String,
      required: false,
      ref: "Listing",
      index: true,
    },
    depositRequestId: {
      type: String,
      required: false,
      ref: "DepositRequest",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index để tối ưu query
PaymentTransactionSchema.index({ userId: 1, createdAt: -1 });
PaymentTransactionSchema.index({ status: 1 });

export default mongoose.model<IPaymentTransaction>(
  "PaymentTransaction",
  PaymentTransactionSchema
);

