import mongoose, { Schema, Document } from "mongoose";

export interface IEscrow extends Document {
  order_id: mongoose.Types.ObjectId;
  listing_id: mongoose.Types.ObjectId;
  buyer_id: mongoose.Types.ObjectId;
  seller_id: mongoose.Types.ObjectId;
  status:
    | "CREATED"
    | "AUTHORIZED"
    | "IN_TRANSACTION"
    | "COMPLETED"
    | "CANCELED"
    | "IN_DISPUTE"
    | "RESOLVED";
  currency: string;
  amount_total: number;
  amount_hold: number;
  fees?: {
    platform?: number;
    escrow?: number;
  };
  payment?: {
    provider?: string;
    payment_intent_id?: string;
    authorized_at?: Date;
    captured_at?: Date;
  };
  payout?: {
    seller_account_id?: string;
    payout_status?: "PENDING" | "PAID" | "FAILED";
    payout_at?: Date;
    amount?: number;
  };
  created_at: Date;
  updated_at: Date;
}

const EscrowSchema: Schema = new Schema(
  {
    order_id: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    listing_id: {
      type: Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
    },
    buyer_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    seller_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "CREATED",
        "AUTHORIZED",
        "IN_TRANSACTION",
        "COMPLETED",
        "CANCELED",
        "IN_DISPUTE",
        "RESOLVED",
      ],
      required: true,
      default: "CREATED",
    },
    currency: {
      type: String,
      required: true,
      default: "VND",
    },
    amount_total: {
      type: Number,
      required: true,
    },
    amount_hold: {
      type: Number,
      required: true,
    },
    fees: {
      platform: Number,
      escrow: Number,
    },
    payment: {
      provider: String,
      payment_intent_id: String,
      authorized_at: Date,
      captured_at: Date,
    },
    payout: {
      seller_account_id: String,
      payout_status: {
        type: String,
        enum: ["PENDING", "PAID", "FAILED"],
      },
      payout_at: Date,
      amount: Number,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes
EscrowSchema.index({ order_id: 1 });
EscrowSchema.index({ buyer_id: 1 });
EscrowSchema.index({ seller_id: 1 });
EscrowSchema.index({ status: 1 });

export default mongoose.model<IEscrow>("Escrow", EscrowSchema);
