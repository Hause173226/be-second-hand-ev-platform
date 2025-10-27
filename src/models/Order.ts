import mongoose, { Schema, Document } from "mongoose";

export interface IOrder extends Document {
  listing_id: mongoose.Types.ObjectId;
  buyer_id: mongoose.Types.ObjectId;
  seller_id: mongoose.Types.ObjectId;
  type: "RESERVATION" | "BUY_NOW";
  status:
    | "CREATED"
    | "RESERVED"
    | "PAID"
    | "IN_TRANSACTION"
    | "COMPLETED"
    | "CANCELED"
    | "IN_DISPUTE"
    | "RESOLVED";
  delivery_status?: "PENDING" | "IN_DELIVERY" | "INSPECTING" | "DELIVERED";
  currency: string;
  amount_total: number;
  escrow_id?: mongoose.Types.ObjectId;
  meeting?: {
    time?: Date;
    place?: string;
    notes?: string;
  };
  buyer_confirmation?: {
    confirmed: boolean;
    confirmed_at: Date;
    is_correct: boolean;
    rating?: number;
    comment?: string;
    issues?: string[];
  };
  created_at: Date;
  updated_at: Date;
}

const OrderSchema: Schema = new Schema(
  {
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
    type: {
      type: String,
      enum: ["RESERVATION", "BUY_NOW"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "CREATED",
        "RESERVED",
        "PAID",
        "IN_TRANSACTION",
        "COMPLETED",
        "CANCELED",
        "IN_DISPUTE",
        "RESOLVED",
      ],
      required: true,
      default: "CREATED",
    },
    delivery_status: {
      type: String,
      enum: ["PENDING", "IN_DELIVERY", "INSPECTING", "DELIVERED"],
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
    escrow_id: {
      type: Schema.Types.ObjectId,
      ref: "Escrow",
    },
    meeting: {
      time: Date,
      place: String,
      notes: String,
    },
    buyer_confirmation: {
      confirmed: {
        type: Boolean,
        default: false,
      },
      confirmed_at: Date,
      is_correct: Boolean,
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: String,
      issues: [String],
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Indexes
OrderSchema.index({ buyer_id: 1 });
OrderSchema.index({ seller_id: 1 });
OrderSchema.index({ listing_id: 1 });
OrderSchema.index({ status: 1 });

export default mongoose.model<IOrder>("Order", OrderSchema);
