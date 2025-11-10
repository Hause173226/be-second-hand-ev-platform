// [TRANSACTION_HISTORY_FEATURE] - Service xử lý lịch sử giao dịch
// File này có thể xóa nếu không muốn dùng tính năng này nữa
// Để xóa: Xóa file này và xóa các import trong transactionController.ts

import Appointment from "../models/Appointment";
import Contract from "../models/Contract";
import DepositRequest from "../models/DepositRequest";
import Listing from "../models/Listing";

export interface TransactionHistoryItem {
  id: string;
  type: "buyer" | "seller";
  status: string;
  listing: {
    id: string;
    title: string;
    make?: string;
    model?: string;
    year?: number;
    price?: number;
    priceListed?: number;
    images?: string[];
  };
  contract?: {
    id: string;
    status: string;
    contractNumber: string;
    photos?: Array<{
      url: string;
      publicId: string;
      uploadedAt: Date;
    }>;
    signedAt?: Date;
    completedAt?: Date;
  };
  depositRequest: {
    id: string;
    depositAmount: number;
    status: string;
  };
  counterparty: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  dates: {
    createdAt: Date;
    scheduledDate?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
  };
  amount: {
    deposit: number;
    total: number;
  };
  appointmentId: string;
}

class TransactionHistoryService {
  /**
   * Lấy lịch sử giao dịch của user - chỉ trả về danh sách giao dịch của user đó
   */
  async getUserTransactionHistory(
    userId: string,
    filters: {
      status?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    transactions: TransactionHistoryItem[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
  }> {
    const { status, page = 1, limit = 10 } = filters;

    // User chỉ xem giao dịch của mình (buyer hoặc seller)
    const filter: any = {
      $or: [{ buyerId: userId }, { sellerId: userId }],
    };

    if (status) {
      filter.status = status;
    }

    // Get appointments
    const appointments = await Appointment.find(filter)
      .populate("depositRequestId")
      .populate("buyerId", "fullName email phone")
      .populate("sellerId", "fullName email phone")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(filter);

    // Get contracts and listings
    const transactions = await Promise.all(
      appointments.map(async (appointment) => {
        const depositRequest = appointment.depositRequestId as any;
        const buyer = appointment.buyerId as any;
        const seller = appointment.sellerId as any;

        // Determine user's role
        const userType: "buyer" | "seller" =
          buyer?._id?.toString() === userId ? "buyer" : "seller";
        const counterparty = userType === "buyer" ? seller : buyer;

        // Get listing
        const listing = depositRequest?.listingId
          ? await Listing.findById(depositRequest.listingId)
          : null;

        // Get contract
        const contract = await Contract.findOne({
          appointmentId: appointment._id,
        });

        // Calculate amounts
        const depositAmount = depositRequest?.depositAmount && depositRequest.depositAmount > 0
          ? depositRequest.depositAmount
          : (listing as any)?.priceListed && (listing as any)?.priceListed > 0
            ? Math.ceil((listing as any).priceListed * 0.1)
            : 0;
        const totalAmount = (listing as any)?.priceListed || (listing as any)?.price || 0;
        const remaining = totalAmount - depositAmount;

        return {
          id: (appointment._id as any).toString(),
          type: userType,
          status: appointment.status,
          listing: {
            id: (listing?._id as any)?.toString() || "",
            title: (listing as any)?.title || "N/A",
            make: (listing as any)?.make,
            model: (listing as any)?.model,
            year: (listing as any)?.year,
            price: (listing as any)?.price,
            priceListed: (listing as any)?.priceListed,
            images: (listing as any)?.images || [],
          },
          contract: contract
            ? {
                id: (contract._id as any).toString(),
                status: contract.status,
                contractNumber: contract.contractNumber,
                photos: (contract.contractPhotos as any[])?.map((photo) => ({
                  url: photo.url,
                  publicId: photo.publicId,
                  uploadedAt: photo.uploadedAt,
                })),
                signedAt: contract.signedAt,
                completedAt: contract.completedAt,
              }
            : undefined,
          depositRequest: {
            id: depositRequest?._id?.toString() || "",
            depositAmount,
            status: depositRequest?.status || "UNKNOWN",
          },
          counterparty: {
            id: counterparty?._id?.toString() || "",
            name: counterparty?.fullName || counterparty?.name || "N/A",
            email: counterparty?.email || "N/A",
            phone: counterparty?.phone,
          },
          dates: {
            createdAt: appointment.createdAt,
            scheduledDate: appointment.scheduledDate,
            completedAt: appointment.completedAt,
            cancelledAt: appointment.cancelledAt,
          },
          amount: {
            deposit: depositAmount,
            total: totalAmount,
            remaining: remaining,
          },
          appointmentId: (appointment._id as any).toString(),
        } as TransactionHistoryItem;
      })
    );

    return {
      transactions,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    };
  }

  /**
   * Lấy lịch sử giao dịch cho admin - trả về tất cả giao dịch trong hệ thống
   */
  async getAdminTransactionHistory(
    filters: {
      status?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    transactions: TransactionHistoryItem[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
  }> {
    const { status, page = 1, limit = 20 } = filters;

    const filter: any = {};

    if (status) filter.status = status;

    const appointments = await Appointment.find(filter)
      .populate("depositRequestId")
      .populate("buyerId", "fullName email phone")
      .populate("sellerId", "fullName email phone")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(filter);

    const transactions = await Promise.all(
      appointments.map(async (appointment) => {
        const depositRequest = appointment.depositRequestId as any;
        const buyer = appointment.buyerId as any;
        const seller = appointment.sellerId as any;

        const listing = depositRequest?.listingId
          ? await Listing.findById(depositRequest.listingId)
          : null;

        const contract = await Contract.findOne({
          appointmentId: appointment._id,
        });

        const depositAmount = depositRequest?.depositAmount && depositRequest.depositAmount > 0
          ? depositRequest.depositAmount
          : (listing as any)?.priceListed && (listing as any)?.priceListed > 0
            ? Math.ceil((listing as any).priceListed * 0.1)
            : 0;
        const totalAmount = (listing as any)?.priceListed || (listing as any)?.price || 0;
        const remaining = totalAmount - depositAmount;

        return {
          id: (appointment._id as any).toString(),
          type: "buyer" as const, // Admin view
          status: appointment.status,
          listing: {
            id: (listing?._id as any)?.toString() || "",
            title: (listing as any)?.title || "N/A",
            make: (listing as any)?.make,
            model: (listing as any)?.model,
            year: (listing as any)?.year,
            price: (listing as any)?.price,
            priceListed: (listing as any)?.priceListed,
            images: (listing as any)?.images || [],
          },
          contract: contract
            ? {
                id: (contract._id as any).toString(),
                status: contract.status,
                contractNumber: contract.contractNumber,
                photos: (contract.contractPhotos as any[])?.map((photo) => ({
                  url: photo.url,
                  publicId: photo.publicId,
                  uploadedAt: photo.uploadedAt,
                })),
                signedAt: contract.signedAt,
                completedAt: contract.completedAt,
              }
            : undefined,
          depositRequest: {
            id: depositRequest?._id?.toString() || "",
            depositAmount,
            status: depositRequest?.status || "UNKNOWN",
          },
          counterparty: {
            id: seller?._id?.toString() || "",
            name: seller?.fullName || seller?.name || "N/A",
            email: seller?.email || "N/A",
            phone: seller?.phone,
          },
          dates: {
            createdAt: appointment.createdAt,
            scheduledDate: appointment.scheduledDate,
            completedAt: appointment.completedAt,
            cancelledAt: appointment.cancelledAt,
          },
          amount: {
            deposit: depositAmount,
            total: totalAmount,
            remaining: remaining,
          },
          appointmentId: (appointment._id as any).toString(),
        } as TransactionHistoryItem;
      })
    );

    return {
      transactions,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    };
  }

  /**
   * Lấy tất cả giao dịch trong hệ thống (không filter gì cả, chỉ có pagination)
   */
  async getAllTransactions(
    filters: {
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{
    transactions: TransactionHistoryItem[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
  }> {
    const { page = 1, limit = 20 } = filters;

    // Không filter gì cả, lấy tất cả
    const appointments = await Appointment.find({})
      .populate("depositRequestId")
      .populate("buyerId", "fullName email phone")
      .populate("sellerId", "fullName email phone")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments({});

    const transactions = await Promise.all(
      appointments.map(async (appointment) => {
        const depositRequest = appointment.depositRequestId as any;
        const buyer = appointment.buyerId as any;
        const seller = appointment.sellerId as any;

        const listing = depositRequest?.listingId
          ? await Listing.findById(depositRequest.listingId)
          : null;

        const contract = await Contract.findOne({
          appointmentId: appointment._id,
        });

        const depositAmount = depositRequest?.depositAmount && depositRequest.depositAmount > 0
          ? depositRequest.depositAmount
          : (listing as any)?.priceListed && (listing as any)?.priceListed > 0
            ? Math.ceil((listing as any).priceListed * 0.1)
            : 0;
        const totalAmount = (listing as any)?.priceListed || (listing as any)?.price || 0;
        const remaining = totalAmount - depositAmount;

        return {
          id: (appointment._id as any).toString(),
          type: "buyer" as const,
          status: appointment.status,
          listing: {
            id: (listing?._id as any)?.toString() || "",
            title: (listing as any)?.title || "N/A",
            make: (listing as any)?.make,
            model: (listing as any)?.model,
            year: (listing as any)?.year,
            price: (listing as any)?.price,
            priceListed: (listing as any)?.priceListed,
            images: (listing as any)?.images || [],
          },
          contract: contract
            ? {
                id: (contract._id as any).toString(),
                status: contract.status,
                contractNumber: contract.contractNumber,
                photos: (contract.contractPhotos as any[])?.map((photo) => ({
                  url: photo.url,
                  publicId: photo.publicId,
                  uploadedAt: photo.uploadedAt,
                })),
                signedAt: contract.signedAt,
                completedAt: contract.completedAt,
              }
            : undefined,
          depositRequest: {
            id: depositRequest?._id?.toString() || "",
            depositAmount,
            status: depositRequest?.status || "UNKNOWN",
          },
          counterparty: {
            id: seller?._id?.toString() || "",
            name: seller?.fullName || seller?.name || "N/A",
            email: seller?.email || "N/A",
            phone: seller?.phone,
          },
          dates: {
            createdAt: appointment.createdAt,
            scheduledDate: appointment.scheduledDate,
            completedAt: appointment.completedAt,
            cancelledAt: appointment.cancelledAt,
          },
          amount: {
            deposit: depositAmount,
            total: totalAmount,
            remaining: remaining,
          },
          appointmentId: (appointment._id as any).toString(),
        } as TransactionHistoryItem;
      })
    );

    return {
      transactions,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    };
  }
}

// [TRANSACTION_HISTORY_FEATURE] - Export service instance
export const transactionHistoryService = new TransactionHistoryService();
