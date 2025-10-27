import { Types } from "mongoose";

export interface IPaymentHistory {
  booking: Types.ObjectId;
  amount: number;
  paymentMethod: "cash" | "bank_transfer" | "credit_card" | "e_wallet" | "online";
  paymentStatus: "pending" | "success" | "failed" | "refunded";
  transactionId?: string;
  gatewayResponse?: any; // JSON object
  processedAt?: Date;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
