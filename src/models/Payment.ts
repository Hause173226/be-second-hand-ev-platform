import mongoose, { Schema } from "mongoose";
import { IPaymentHistory } from "../interfaces/IPayment";

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
    gatewayResponse: { type: Schema.Types.Mixed }, // JSON response from gateway
    processedAt: { type: Date, default: Date.now },
    notes: { type: String },
  },
  { timestamps: true }
);

export const PaymentHistory = mongoose.model<IPaymentHistory>("PaymentHistory", paymentHistorySchema);
