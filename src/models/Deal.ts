import mongoose, { Schema, Document } from "mongoose";
import {
  CONTRACT_TIMELINE_STATUSES,
  CONTRACT_TIMELINE_STEPS,
  ContractTimelineStatus,
  ContractTimelineStepId,
  buildDefaultTimeline,
} from "../constants/contractTimeline";

export const DEAL_TYPES = ["DEPOSIT", "FULL_PAYMENT", "AUCTION"] as const;
export type DealType = (typeof DEAL_TYPES)[number];

export const DEAL_SOURCES = [
  "NORMAL_DEPOSIT",
  "BUY_NOW",
  "AUCTION",
] as const;
export type DealSource = (typeof DEAL_SOURCES)[number];

export const DEAL_STATUSES = [
  "INITIATED",
  "RESERVED",
  "AWAITING_PAYMENT",
  "PAPERWORK_IN_PROGRESS",
  "HANDOVER_SCHEDULED",
  "READY_FOR_PAYOUT",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const PAYMENT_RECORD_TYPES = [
  "DEPOSIT",
  "REMAINING",
  "FULL",
  "REFUND",
  "PAYOUT",
] as const;
export type PaymentRecordType = (typeof PAYMENT_RECORD_TYPES)[number];

export const PAYMENT_RECORD_STATUSES = [
  "PENDING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

export interface PaymentRecord {
  type: PaymentRecordType;
  amount: number;
  currency?: string;
  status: PaymentRecordStatus;
  orderId?: string;
  transactionId?: string;
  note?: string;
  recordedAt: Date;
  recordedBy?: string;
  metadata?: Record<string, any>;
}

export interface PaperworkProgressItem {
  step: ContractTimelineStepId;
  status: ContractTimelineStatus;
  note?: string;
  appointmentRequired?: boolean;
  appointmentId?: string;
  updatedAt?: Date;
  updatedBy?: string;
  attachments?: {
    url: string;
    description?: string;
    uploadedAt: Date;
  }[];
}

export interface DealTimeline {
  dealCreatedAt?: Date;
  depositRequestedAt?: Date;
  depositPaidAt?: Date;
  remainingPaymentRequestedAt?: Date;
  remainingPaidAt?: Date;
  fullPaymentRequestedAt?: Date;
  fullPaymentPaidAt?: Date;
  paperworkStartedAt?: Date;
  paperworkCompletedAt?: Date;
  handoverScheduledAt?: Date;
  handoverCompletedAt?: Date;
  payoutRequestedAt?: Date;
  payoutCompletedAt?: Date;
  cancelledAt?: Date;
}

export interface IPenaltyPlan {
  payToSellerPercent: number;
  maxCompensateSeller: number;
}

export interface PaymentPlan {
  currency?: string;
  vehiclePrice: number;
  depositAmount?: number;
  remainingAmount?: number;
  depositDeadline?: Date;
  remainingPaymentDeadline?: Date;
  handoverDeadline?: Date;
  penaltyPlan?: IPenaltyPlan;
}

export interface IDeal extends Document {
  listingId: string;
  buyerId: string;
  sellerId: string;
  depositRequestId?: string;
  auctionId?: string;
  dealType: DealType;
  source: DealSource;
  status: DealStatus;
  paymentPlan: PaymentPlan;
  timeline: DealTimeline;
  payments: PaymentRecord[];
  paperworkProgress: PaperworkProgressItem[];
  appointmentMilestones: {
    signContract?: {
      appointmentId?: string;
      status: "NOT_SCHEDULED" | "SCHEDULED" | "COMPLETED";
      scheduledAt?: Date;
      completedAt?: Date;
    };
    notarization?: {
      appointmentId?: string;
      status: "NOT_SCHEDULED" | "SCHEDULED" | "COMPLETED";
      scheduledAt?: Date;
      completedAt?: Date;
    };
    handover?: {
      appointmentId?: string;
      status: "NOT_SCHEDULED" | "SCHEDULED" | "COMPLETED";
      scheduledAt?: Date;
      completedAt?: Date;
    };
  };
  payout?: {
    released?: boolean;
    releasedAt?: Date;
    releasedBy?: string;
    amount?: number;
    note?: string;
  };
  contractId?: string;
  createdBy?: string;
  notes?: string;
  cancellation?: {
    reason?: string;
    cancelledBy?: string;
    penaltyAmount?: number;
    resolvedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PaperworkProgressSchema = new Schema<PaperworkProgressItem>(
  {
    step: {
      type: String,
      enum: CONTRACT_TIMELINE_STEPS,
      required: true,
    },
    status: {
      type: String,
      enum: CONTRACT_TIMELINE_STATUSES,
      default: "PENDING",
    },
    note: {
      type: String,
    },
    appointmentRequired: {
      type: Boolean,
      default: false,
    },
    appointmentId: {
      type: String,
      ref: "Appointment",
    },
    updatedAt: {
      type: Date,
    },
    updatedBy: {
      type: String,
      ref: "User",
    },
    attachments: [
      new Schema(
        {
          url: { type: String, required: true },
          description: { type: String },
          uploadedAt: { type: Date, default: Date.now },
        },
        { _id: false }
      ),
    ],
  },
  { _id: false }
);

const PaymentRecordSchema = new Schema<PaymentRecord>(
  {
    type: {
      type: String,
      enum: PAYMENT_RECORD_TYPES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "VND",
    },
    status: {
      type: String,
      enum: PAYMENT_RECORD_STATUSES,
      default: "PENDING",
    },
    orderId: {
      type: String,
    },
    transactionId: {
      type: String,
    },
    note: {
      type: String,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
    recordedBy: {
      type: String,
      ref: "User",
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: true }
);

const DealSchema = new Schema<IDeal>(
  {
    listingId: {
      type: String,
      ref: "Listing",
      required: true,
    },
    buyerId: {
      type: String,
      ref: "User",
      required: true,
    },
    sellerId: {
      type: String,
      ref: "User",
      required: true,
    },
    depositRequestId: {
      type: String,
      ref: "DepositRequest",
    },
    auctionId: {
      type: String,
      ref: "Auction",
    },
    dealType: {
      type: String,
      enum: DEAL_TYPES,
      default: "DEPOSIT",
    },
    source: {
      type: String,
      enum: DEAL_SOURCES,
      default: "NORMAL_DEPOSIT",
    },
    status: {
      type: String,
      enum: DEAL_STATUSES,
      default: "INITIATED",
      index: true,
    },
    paymentPlan: {
      currency: {
        type: String,
        default: "VND",
      },
      vehiclePrice: {
        type: Number,
        required: true,
        min: 0,
      },
      depositAmount: {
        type: Number,
        min: 0,
      },
      remainingAmount: {
        type: Number,
        min: 0,
      },
      depositDeadline: {
        type: Date,
      },
      remainingPaymentDeadline: {
        type: Date,
      },
      handoverDeadline: {
        type: Date,
      },
      penaltyPlan: {
        payToSellerPercent: {
          type: Number,
          default: 0.5,
        },
        maxCompensateSeller: {
          type: Number,
          default: 5_000_000,
        },
      },
    },
    timeline: {
      dealCreatedAt: { type: Date, default: Date.now },
      depositRequestedAt: Date,
      depositPaidAt: Date,
      remainingPaymentRequestedAt: Date,
      remainingPaidAt: Date,
      fullPaymentRequestedAt: Date,
      fullPaymentPaidAt: Date,
      paperworkStartedAt: Date,
      paperworkCompletedAt: Date,
      handoverScheduledAt: Date,
      handoverCompletedAt: Date,
      payoutRequestedAt: Date,
      payoutCompletedAt: Date,
      cancelledAt: Date,
    },
    payments: {
      type: [PaymentRecordSchema],
      default: [],
    },
    paperworkProgress: {
      type: [PaperworkProgressSchema],
      default: () =>
        buildDefaultTimeline().map((item) => ({
          step: item.step,
          status: item.status,
          appointmentRequired:
            item.step === "SIGN_CONTRACT" ||
            item.step === "NOTARIZATION" ||
            item.step === "HANDOVER_PAPERS_AND_CAR",
        })),
    },
    appointmentMilestones: {
      signContract: {
        appointmentId: { type: String, ref: "Appointment" },
        status: {
          type: String,
          enum: ["NOT_SCHEDULED", "SCHEDULED", "COMPLETED"],
          default: "NOT_SCHEDULED",
        },
        scheduledAt: Date,
        completedAt: Date,
      },
      notarization: {
        appointmentId: { type: String, ref: "Appointment" },
        status: {
          type: String,
          enum: ["NOT_SCHEDULED", "SCHEDULED", "COMPLETED"],
          default: "NOT_SCHEDULED",
        },
        scheduledAt: Date,
        completedAt: Date,
      },
      handover: {
        appointmentId: { type: String, ref: "Appointment" },
        status: {
          type: String,
          enum: ["NOT_SCHEDULED", "SCHEDULED", "COMPLETED"],
          default: "NOT_SCHEDULED",
        },
        scheduledAt: Date,
        completedAt: Date,
      },
    },
    payout: {
      released: { type: Boolean, default: false },
      releasedAt: Date,
      releasedBy: { type: String, ref: "User" },
      amount: Number,
      note: String,
    },
    contractId: {
      type: String,
      ref: "Contract",
    },
    createdBy: {
      type: String,
      ref: "User",
    },
    notes: {
      type: String,
    },
    cancellation: {
      reason: String,
      cancelledBy: { type: String, ref: "User" },
      penaltyAmount: Number,
      resolvedAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

DealSchema.index({ buyerId: 1, status: 1 });
DealSchema.index({ sellerId: 1, status: 1 });
DealSchema.index({ listingId: 1, status: 1 });

export default mongoose.model<IDeal>("Deal", DealSchema);

