import { IMembershipPackage } from "./IMembershipPackage";
import mongoose from "mongoose";

export interface IUserMembership {
  userId: mongoose.Types.ObjectId;
  packageId: mongoose.Types.ObjectId | IMembershipPackage;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  autoRenew: boolean;
  listingsUsed: number;
  paymentId?: mongoose.Types.ObjectId;
  transactionId?: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  createdAt?: Date;
  updatedAt?: Date;
}
