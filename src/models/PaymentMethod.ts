import mongoose, { Schema } from "mongoose";

export interface IPaymentMethod {
  _id?: string;
  userId: string;
  provider: "stripe" | "xpay" | "momo" | "zalopay" | "bank" | string;
  tokenId: string;
  brand?: string;
  last4?: string;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const paymentMethodSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, required: true },
    tokenId: { type: String, required: true },
    brand: { type: String },
    last4: { type: String },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes
paymentMethodSchema.index({ userId: 1 });
paymentMethodSchema.index({ provider: 1 });

export const PaymentMethod = mongoose.model<IPaymentMethod>(
  "PaymentMethod",
  paymentMethodSchema
);
