import { FilterQuery } from "mongoose";
import Deal, {
  DEAL_STATUSES,
  DEAL_TYPES,
  DEAL_SOURCES,
  IDeal,
  DealStatus,
  DealType,
  DealSource,
  PAYMENT_RECORD_TYPES,
  PAYMENT_RECORD_STATUSES,
  PaymentRecordType,
  PaymentRecordStatus,
  PaperworkProgressItem,
} from "../models/Deal";
import {
  CONTRACT_TIMELINE_STEPS,
  ContractTimelineStatus,
  ContractTimelineStepId,
} from "../constants/contractTimeline";

type CreateDealInput = {
  listingId: string;
  buyerId: string;
  sellerId: string;
  dealType?: DealType;
  source?: DealSource;
  depositRequestId?: string;
  auctionId?: string;
  contractId?: string;
  paymentPlan: {
    vehiclePrice: number;
    depositAmount?: number;
    remainingAmount?: number;
    currency?: string;
    depositDeadline?: Date;
    remainingPaymentDeadline?: Date;
    handoverDeadline?: Date;
    penaltyPlan?: {
      payToSellerPercent?: number;
      maxCompensateSeller?: number;
    };
  };
  createdBy?: string;
  notes?: string;
};

type PaymentRecordPayload = {
  type: PaymentRecordType;
  amount: number;
  currency?: string;
  status?: PaymentRecordStatus;
  orderId?: string;
  transactionId?: string;
  note?: string;
  recordedAt?: Date;
  recordedBy?: string;
  metadata?: Record<string, any>;
};

type PaperworkUpdatePayload = {
  status: ContractTimelineStatus;
  note?: string;
  appointmentId?: string;
  updatedBy?: string;
  attachments?: {
    url: string;
    description?: string;
    uploadedAt?: Date;
  }[];
};

const paperworkStepsNeedingAppointments: ContractTimelineStepId[] = [
  "SIGN_CONTRACT",
  "NOTARIZATION",
  "HANDOVER_PAPERS_AND_CAR",
];

type AppointmentMilestoneKey = "signContract" | "notarization" | "handover";

class DealService {
  async createDeal(payload: CreateDealInput): Promise<IDeal> {
    const dealType = payload.dealType ?? "DEPOSIT";
    const source = payload.source ?? "NORMAL_DEPOSIT";

    if (!DEAL_TYPES.includes(dealType)) {
      throw new Error("Invalid deal type");
    }

    if (!DEAL_SOURCES.includes(source)) {
      throw new Error("Invalid deal source");
    }

    const vehiclePrice = payload.paymentPlan.vehiclePrice;
    if (vehiclePrice <= 0) {
      throw new Error("Vehicle price must be greater than 0");
    }

    const depositAmount = payload.paymentPlan.depositAmount ?? 0;
    const remainingAmount =
      payload.paymentPlan.remainingAmount ??
      Math.max(vehiclePrice - depositAmount, 0);

    const deal = await Deal.create({
      listingId: payload.listingId,
      buyerId: payload.buyerId,
      sellerId: payload.sellerId,
      dealType,
      source,
      depositRequestId: payload.depositRequestId,
      auctionId: payload.auctionId,
      contractId: payload.contractId,
      paymentPlan: {
        ...payload.paymentPlan,
        depositAmount,
        remainingAmount,
      },
      createdBy: payload.createdBy,
      notes: payload.notes,
    });

    return deal;
  }

  async getDealById(dealId: string) {
    return Deal.findById(dealId);
  }

  async updateAppointmentMilestone(
    dealId: string,
    milestone: AppointmentMilestoneKey,
    payload: {
      appointmentId?: string;
      status?: "NOT_SCHEDULED" | "SCHEDULED" | "COMPLETED";
      scheduledAt?: Date;
      completedAt?: Date;
    }
  ) {
    const deal = await Deal.findById(dealId);
    if (!deal) {
      throw new Error("Deal not found");
    }

    const target = deal.appointmentMilestones[milestone] || {
      status: "NOT_SCHEDULED",
    };

    if (payload.appointmentId) {
      target.appointmentId = payload.appointmentId;
    }

    if (payload.status) {
      target.status = payload.status;
    }

    if (payload.scheduledAt) {
      target.scheduledAt = payload.scheduledAt;
    }

    if (payload.completedAt) {
      target.completedAt = payload.completedAt;
    }

    deal.appointmentMilestones[milestone] = target;
    await deal.save();
    return target;
  }

  async listDealsForUser(
    userId: string,
    options: { status?: DealStatus; page?: number; limit?: number } = {}
  ) {
    const filter: FilterQuery<IDeal> = {
      $or: [{ buyerId: userId }, { sellerId: userId }],
    };

    if (options.status) {
      filter.status = options.status;
    }

    const page = options.page ?? 1;
    const limit = options.limit ?? 10;

    const [data, total] = await Promise.all([
      Deal.find(filter)
        .populate('listingId', 'title make model year priceListed photos status')
        .populate('buyerId', 'fullName email phone avatar')
        .populate('sellerId', 'fullName email phone avatar')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit),
      Deal.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    };
  }

  async listDealsForStaff(
    options: { status?: DealStatus; page?: number; limit?: number } = {}
  ) {
    const filter: FilterQuery<IDeal> = {};

    if (options.status) {
      filter.status = options.status;
    }

    const page = options.page ?? 1;
    const limit = options.limit ?? 20;

    const [data, total] = await Promise.all([
      Deal.find(filter)
        .populate('listingId', 'title make model year priceListed photos status')
        .populate('buyerId', 'fullName email phone avatar')
        .populate('sellerId', 'fullName email phone avatar')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit),
      Deal.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    };
  }

  async updateStatus(dealId: string, status: DealStatus, note?: string) {
    if (!DEAL_STATUSES.includes(status)) {
      throw new Error("Invalid deal status");
    }

    const deal = await Deal.findById(dealId);
    if (!deal) {
      throw new Error("Deal not found");
    }

    deal.status = status;
    if (note) {
      deal.notes = note;
    }

    if (status === "PAPERWORK_IN_PROGRESS" && !deal.timeline.paperworkStartedAt) {
      deal.timeline.paperworkStartedAt = new Date();
    }

    if (status === "READY_FOR_PAYOUT" && !deal.timeline.payoutRequestedAt) {
      deal.timeline.payoutRequestedAt = new Date();
    }

    if (status === "COMPLETED" && !deal.timeline.payoutCompletedAt) {
      deal.timeline.payoutCompletedAt = new Date();
    }

    await deal.save();
    return deal;
  }

  async linkContract(dealId: string, contractId: string) {
    const deal = await Deal.findById(dealId);
    if (!deal) {
      throw new Error("Deal not found");
    }

    if (deal.contractId !== contractId) {
      deal.contractId = contractId;
      await deal.save();
    }

    return deal;
  }

  async addPaymentRecord(dealId: string, payload: PaymentRecordPayload) {
    if (!PAYMENT_RECORD_TYPES.includes(payload.type)) {
      throw new Error("Invalid payment type");
    }

    const status = payload.status ?? "PENDING";
    if (!PAYMENT_RECORD_STATUSES.includes(status)) {
      throw new Error("Invalid payment status");
    }

    const deal = await Deal.findById(dealId);
    if (!deal) {
      throw new Error("Deal not found");
    }

    const record = {
      ...payload,
      status,
      recordedAt: payload.recordedAt ?? new Date(),
    };

    deal.payments.push(record);
    this.updateTimelineFromPayment(deal, record);

    await deal.save();
    return deal;
  }

  async updatePaperworkStep(
    dealId: string,
    step: ContractTimelineStepId,
    payload: PaperworkUpdatePayload
  ) {
    if (!CONTRACT_TIMELINE_STEPS.includes(step)) {
      throw new Error("Invalid paperwork step");
    }

    const deal = await Deal.findById(dealId);
    if (!deal) {
      throw new Error("Deal not found");
    }

    const target: PaperworkProgressItem | undefined =
      deal.paperworkProgress.find((item) => item.step === step);

    if (!target) {
      throw new Error("Paperwork step not available on deal");
    }

    target.status = payload.status;
    target.note = payload.note ?? target.note;
    target.updatedAt = new Date();
    target.updatedBy = payload.updatedBy;

    if (payload.appointmentId) {
      target.appointmentId = payload.appointmentId;
      target.appointmentRequired = true;
    }

    if (payload.attachments && payload.attachments.length > 0) {
      const newAttachments = payload.attachments.map((att) => ({
        url: att.url,
        description: att.description,
        uploadedAt: att.uploadedAt ?? new Date(),
      }));
      target.attachments = [...(target.attachments || []), ...newAttachments];
    }

    this.updateDealStatusFromPaperwork(deal);

    await deal.save();
    return deal;
  }

  async releasePayout(
    dealId: string,
    payload: { amount?: number; note?: string; releasedBy?: string }
  ) {
    const deal = await Deal.findById(dealId);
    if (!deal) {
      throw new Error("Deal not found");
    }

    if (deal.payout?.released) {
      return deal;
    }

    deal.payout = {
      released: true,
      releasedAt: new Date(),
      releasedBy: payload.releasedBy,
      amount: payload.amount ?? deal.paymentPlan.remainingAmount ?? deal.paymentPlan.vehiclePrice,
      note: payload.note,
    };

    deal.timeline.payoutCompletedAt = deal.timeline.payoutCompletedAt || new Date();
    deal.status = "COMPLETED";

    await deal.save();
    return deal;
  }

  private updateTimelineFromPayment(deal: IDeal, record: PaymentRecordPayload) {
    if (record.status !== "COMPLETED") {
      return;
    }

    const completedAt = record.recordedAt ?? new Date();
    switch (record.type) {
      case "DEPOSIT":
        deal.timeline.depositPaidAt = completedAt;
        deal.status =
          (deal.paymentPlan.remainingAmount ?? 0) > 0
            ? "AWAITING_PAYMENT"
            : "PAPERWORK_IN_PROGRESS";
        break;
      case "REMAINING":
        deal.timeline.remainingPaidAt = completedAt;
        deal.status = "PAPERWORK_IN_PROGRESS";
        break;
      case "FULL":
        deal.timeline.fullPaymentPaidAt = completedAt;
        deal.status = "PAPERWORK_IN_PROGRESS";
        break;
      case "PAYOUT":
        deal.timeline.payoutCompletedAt = completedAt;
        deal.status = "COMPLETED";
        break;
      default:
        break;
    }
  }

  private updateDealStatusFromPaperwork(deal: IDeal) {
    const allStepsCompleted = deal.paperworkProgress.every(
      (item) => item.status === "DONE"
    );

    if (allStepsCompleted) {
      deal.timeline.paperworkCompletedAt = new Date();
      deal.status = "READY_FOR_PAYOUT";
      return;
    }

    const anyStepInProgress = deal.paperworkProgress.some(
      (item) =>
        item.status === "IN_PROGRESS" ||
        (paperworkStepsNeedingAppointments.includes(item.step) &&
          item.appointmentId &&
          item.status !== "DONE")
    );

    if (anyStepInProgress) {
      deal.status = "PAPERWORK_IN_PROGRESS";
      if (!deal.timeline.paperworkStartedAt) {
        deal.timeline.paperworkStartedAt = new Date();
      }
    }
  }
}

export const dealService = new DealService();
export default dealService;

