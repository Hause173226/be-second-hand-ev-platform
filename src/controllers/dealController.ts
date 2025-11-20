import { Request, Response } from "express";
import dealService from "../services/dealService";
import Contract from "../models/Contract";
import {
  buildDefaultTimeline,
  ContractTimelineStepId,
  ContractTimelineStatus,
  CONTRACT_TIMELINE_STATUSES,
} from "../constants/contractTimeline";
import {
  DEAL_STATUSES,
  PAYMENT_RECORD_STATUSES,
  PAYMENT_RECORD_TYPES,
} from "../models/Deal";

const getUserId = (req: Request) => req.user?.id || req.user?._id;

const ensureStaff = (req: Request) => {
  const role = req.user?.role;
  return role === "admin" || role === "staff";
};

const canAccessDeal = (req: Request, deal: any) => {
  if (ensureStaff(req)) return true;
  const userId = getUserId(req);
  if (!userId) return false;
  const normalizedUserId = userId.toString();
  return (
    deal.buyerId?.toString() === normalizedUserId ||
    deal.sellerId?.toString() === normalizedUserId
  );
};

export const createDeal = async (req: Request, res: Response) => {
  try {
    if (!ensureStaff(req)) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới có quyền tạo deal",
      });
    }

    const {
      listingId,
      buyerId,
      sellerId,
      paymentPlan,
      dealType,
      source,
      depositRequestId,
      auctionId,
      contractId,
      notes,
    } = req.body || {};

    if (!listingId || !buyerId || !sellerId || !paymentPlan?.vehiclePrice) {
      return res.status(400).json({
        success: false,
        message: "Thiếu dữ liệu bắt buộc (listingId, buyerId, sellerId, vehiclePrice)",
      });
    }

    const deal = await dealService.createDeal({
      listingId,
      buyerId,
      sellerId,
      paymentPlan,
      dealType,
      source,
      depositRequestId,
      auctionId,
      contractId,
      notes,
      createdBy: getUserId(req)?.toString(),
    });

    res.status(201).json({
      success: true,
      data: deal,
    });
  } catch (error) {
    console.error("Error creating deal:", error);
    res.status(500).json({
      success: false,
      message: "Không thể tạo deal mới",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getDealById = async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const deal = await dealService.getDealById(dealId);
    if (!deal) {
      return res.status(404).json({
        success: false,
        message: "Deal không tồn tại",
      });
    }

    if (!canAccessDeal(req, deal)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem deal này",
      });
    }

    res.json({
      success: true,
      data: deal,
    });
  } catch (error) {
    console.error("Error fetching deal:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy thông tin deal",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getUserDeals = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
    }

    const { status, page = 1, limit = 10 } = req.query;
    const parsedStatus =
      typeof status === "string" && DEAL_STATUSES.includes(status as any)
        ? (status as any)
        : undefined;

    const result = await dealService.listDealsForUser(userId.toString(), {
      status: parsedStatus,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching user deals:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách deal",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAdminDeals = async (req: Request, res: Response) => {
  try {
    if (!ensureStaff(req)) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới xem được danh sách deal",
      });
    }

    const { status, page = 1, limit = 20 } = req.query;
    const parsedStatus =
      typeof status === "string" && DEAL_STATUSES.includes(status as any)
        ? (status as any)
        : undefined;

    const result = await dealService.listDealsForStaff({
      status: parsedStatus,
      page: Number(page),
      limit: Number(limit),
    });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("Error fetching staff deals:", error);
    res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách deal",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const addPaymentRecord = async (req: Request, res: Response) => {
  try {
    if (!ensureStaff(req)) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới được ghi nhận thanh toán",
      });
    }

    const { dealId } = req.params;
    const { type, amount, currency, status, orderId, transactionId, note, metadata } =
      req.body || {};

    if (!type || !amount) {
      return res.status(400).json({
        success: false,
        message: "Thiếu dữ liệu bắt buộc (type, amount)",
      });
    }

    if (!PAYMENT_RECORD_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Loại thanh toán không hợp lệ",
      });
    }

    if (status && !PAYMENT_RECORD_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái thanh toán không hợp lệ",
      });
    }

    const deal = await dealService.addPaymentRecord(dealId, {
      type,
      amount,
      currency,
      status,
      orderId,
      transactionId,
      note,
      metadata,
      recordedBy: getUserId(req)?.toString(),
    });

    res.json({
      success: true,
      data: deal,
    });
  } catch (error) {
    console.error("Error adding payment record:", error);
    res.status(500).json({
      success: false,
      message: "Không thể ghi nhận thanh toán",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

const getNextPaperworkStatus = (current?: ContractTimelineStatus) => {
  switch (current) {
    case "PENDING":
    case undefined:
      return "IN_PROGRESS";
    case "IN_PROGRESS":
      return "DONE";
    default:
      return current;
  }
};

export const updatePaperworkStep = async (req: Request, res: Response) => {
  try {
    if (!ensureStaff(req)) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới cập nhật tiến độ giấy tờ",
      });
    }

    const { dealId, step } = req.params;
    const { status, note, appointmentId } = req.body || {};

    const normalizedStep = step as ContractTimelineStepId;

    const dealDoc = await dealService.getDealById(dealId);
    if (!dealDoc) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy deal",
      });
    }

    const currentStep = dealDoc.paperworkProgress?.find(
      (item) => item.step === normalizedStep
    );

    if (!currentStep) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy bước giấy tờ này trong deal",
      });
    }

    const targetStatus = status && CONTRACT_TIMELINE_STATUSES.includes(status)
      ? status
      : getNextPaperworkStatus(currentStep.status);

    if (!targetStatus) {
      return res.status(400).json({
        success: false,
        message: "Không xác định được trạng thái cập nhật",
      });
    }

    const deal = await dealService.updatePaperworkStep(dealId, normalizedStep, {
      status: targetStatus,
      note,
      appointmentId,
      updatedBy: getUserId(req)?.toString(),
    });

    try {
      const contract =
        (await Contract.findOne({ dealId })) ||
        (appointmentId ? await Contract.findOne({ appointmentId }) : null);

      if (contract) {
        if (!contract.paperworkTimeline || contract.paperworkTimeline.length === 0) {
          contract.paperworkTimeline = buildDefaultTimeline(
            contract.contractType || "DEPOSIT"
          ) as any;
        }

        const contractStep = contract.paperworkTimeline.find(
          (item: any) => item.step === normalizedStep
        );

        if (contractStep) {
          const contractStepAny: any = contractStep;
          contractStepAny.status = targetStatus;
          contractStepAny.note = note ?? contractStepAny.note;
          contractStepAny.updatedAt = new Date();
          contractStepAny.updatedBy = getUserId(req)?.toString();
          if (appointmentId) {
            contractStepAny.appointmentId = appointmentId;
          }
          contract.markModified("paperworkTimeline");
          await contract.save();
        }
      }
    } catch (contractError) {
      console.error("Error syncing contract timeline for paperwork update:", contractError);
    }

    res.json({
      success: true,
      data: deal,
    });
  } catch (error) {
    console.error("Error updating paperwork step:", error);
    res.status(500).json({
      success: false,
      message: "Không thể cập nhật tiến độ giấy tờ",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateDealStatus = async (req: Request, res: Response) => {
  try {
    if (!ensureStaff(req)) {
      return res.status(403).json({
        success: false,
        message: "Chỉ nhân viên mới được cập nhật trạng thái deal",
      });
    }

    const { dealId } = req.params;
    const { status, note } = req.body || {};

    if (!status || !DEAL_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Trạng thái deal không hợp lệ",
      });
    }

    const deal = await dealService.updateStatus(dealId, status, note);

    res.json({
      success: true,
      data: deal,
    });
  } catch (error) {
    console.error("Error updating deal status:", error);
    res.status(500).json({
      success: false,
      message: "Không thể cập nhật trạng thái deal",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

