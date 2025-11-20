// [TRANSACTION_HISTORY_FEATURE] - Service xử lý lịch sử giao dịch
// File này có thể xóa nếu không muốn dùng tính năng này nữa
// Để xóa: Xóa file này và xóa các import trong transactionController.ts

import Appointment from "../models/Appointment";
import Contract from "../models/Contract";
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
    location?: any;
    licensePlate?: string;
    vehicleType?: string;
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
    staff?: {
      id: string;
      name: string;
    };
    contractPdfUrl?: string;
    paperworkTimeline?: any;
    contractType?: string;
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
    remaining: number;
  };
  appointmentId: string;
}

class TransactionHistoryService {
  private async resolveListingDocument(
    depositListingRef: any,
    appointmentListingRef: any
  ) {
    let listingDoc: any = null;

    const loadListing = async (ref: any) => {
      if (!ref) return null;
      if (typeof ref === "object" && ref._id) {
        return ref;
      }
      try {
        return await Listing.findById(ref);
      } catch (err) {
        console.error("[TransactionHistory] Cannot load listing:", ref, err);
        return null;
      }
    };

    listingDoc = await loadListing(depositListingRef);
    if (!listingDoc) {
      listingDoc = await loadListing(appointmentListingRef);
    }

    return listingDoc;
  }

  private normalizeUserId(user: any) {
    if (!user) return "";
    if (typeof user === "string") return user;
    if (user._id) return user._id.toString();
    if (user.id) return user.id.toString();
    return String(user);
  }

  private buildListingPayload(listing: any) {
    return {
      id: listing?._id?.toString() || "",
      title: listing?.title || "N/A",
      make: listing?.make,
      model: listing?.model,
      year: listing?.year,
      price: listing?.price,
      priceListed: listing?.priceListed,
      images: listing?.photos?.map((photo: any) => photo?.url) || listing?.images || [],
      location: listing?.location,
      licensePlate: listing?.licensePlate,
      vehicleType: listing?.vehicleType,
    };
  }

  private computeDeposit(
    depositRequest: any,
    listing: any
  ) {
    if (depositRequest?.depositAmount && depositRequest.depositAmount > 0) {
      return depositRequest.depositAmount;
    }
    const price = listing?.priceListed || listing?.price || 0;
    return price > 0 ? Math.ceil(price * 0.1) : 0;
  }

  private async buildTransactionItem(
    appointment: any,
    options: {
      currentUserId?: string;
      adminView?: boolean;
    } = {}
  ): Promise<TransactionHistoryItem> {
    const { currentUserId, adminView = false } = options;
    const depositRequest = appointment.depositRequestId as any;
    const buyer = appointment.buyerId as any;
    const seller = appointment.sellerId as any;

    const listingDoc = await this.resolveListingDocument(
      depositRequest?.listingId,
      appointment.listingId
    );

    const contract = await Contract.findOne({
      appointmentId: appointment._id,
    }).select(
      "status contractNumber contractPhotos signedAt completedAt staffId staffName contractPdfUrl paperworkTimeline contractType"
    );

    const depositAmount = this.computeDeposit(depositRequest, listingDoc);
    const totalAmount = listingDoc?.priceListed || listingDoc?.price || 0;
    const remaining = totalAmount - depositAmount;

    let userType: "buyer" | "seller" = "buyer";
    if (!adminView && currentUserId) {
      const buyerIdStr = this.normalizeUserId(buyer);
      const currentIdStr = currentUserId.toString();
      userType = buyerIdStr === currentIdStr ? "buyer" : "seller";
    }

    const counterparty = userType === "buyer" ? seller : buyer;

    return {
      id: appointment._id.toString(),
      type: userType,
      status: appointment.status,
      listing: this.buildListingPayload(listingDoc),
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
            staff: contract.staffId
              ? {
                  id: contract.staffId.toString(),
                  name: contract.staffName || "N/A",
                }
              : undefined,
            contractPdfUrl: contract.contractPdfUrl,
            paperworkTimeline: contract.paperworkTimeline,
            contractType: contract.contractType,
          }
        : undefined,
      depositRequest: {
        id: depositRequest?._id?.toString() || "",
        depositAmount,
        status: depositRequest?.status || "UNKNOWN",
      },
      counterparty: {
        id: this.normalizeUserId(counterparty),
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
        remaining,
      },
      appointmentId: appointment._id.toString(),
    };
  }

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
      .populate("listingId")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(filter);

    // Get contracts and listings
    const transactions = await Promise.all(
      appointments.map((appointment) =>
        this.buildTransactionItem(appointment, {
          currentUserId: userId.toString(),
        })
      )
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
      .populate("listingId")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments(filter);

    const transactions = await Promise.all(
      appointments.map((appointment) =>
        this.buildTransactionItem(appointment, { adminView: true })
      )
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
      .populate("listingId")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Appointment.countDocuments({});

    const transactions = await Promise.all(
      appointments.map((appointment) =>
        this.buildTransactionItem(appointment, { adminView: true })
      )
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

  async getTransactionById(
    appointmentId: string,
    options: {
      currentUserId?: string;
      adminView?: boolean;
    } = {}
  ): Promise<TransactionHistoryItem | null> {
    const appointment = await Appointment.findById(appointmentId)
      .populate("depositRequestId")
      .populate("buyerId", "fullName email phone")
      .populate("sellerId", "fullName email phone")
      .populate("listingId");

    if (!appointment) {
      return null;
    }

    return this.buildTransactionItem(appointment, options);
  }
}

// [TRANSACTION_HISTORY_FEATURE] - Export service instance
export const transactionHistoryService = new TransactionHistoryService();
