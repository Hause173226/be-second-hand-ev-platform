// services/auctionService.ts  (hoặc .js nếu bạn dùng JS)
import Auction from "../models/Auction";
import Listing from "../models/Listing";
import DepositRequest from "../models/DepositRequest";
import EscrowAccount from "../models/EscrowAccount";
import AuctionDeposit from "../models/AuctionDeposit";
import Appointment from "../models/Appointment";
import { WebSocketService } from "./websocketService";
import auctionDepositService from "./auctionDepositService";
import cron from "node-cron";

type AnyId = string | { toString(): string };

// =======================================================
// In–memory timeouts cho các phiên đang active
// (sẽ được hydrate lại ở bootstrapAuctions khi server khởi động)
// =======================================================
export const auctionTimeouts = new Map<string, NodeJS.Timeout>();

// Tính ms đến endAt (âm nếu đã quá hạn)
function msUntilEnd(endAt: Date | string) {
  return new Date(endAt).getTime() - Date.now();
}

// Đặt hẹn giờ tự đóng phiên
export async function scheduleAuctionClose(auction: any) {
  const id = auction._id?.toString?.() ?? String(auction._id);
  const ms = msUntilEnd(auction.endAt);
  // Nếu hết giờ rồi: không set timeout (để cron/boot xử), hoặc tự đóng ngay
  if (ms <= 0) return;

  // Clear timeout cũ nếu có
  const prev = auctionTimeouts.get(id);
  if (prev) clearTimeout(prev);

  const ws = WebSocketService.getInstance();

  const timeout = setTimeout(async () => {
    try {
      await autoCloseAuction(id, ws);
    } catch (e) {
      console.error("[auctionService] autoCloseAuction error in timeout:", e);
    } finally {
      auctionTimeouts.delete(id);
    }
  }, ms);

  auctionTimeouts.set(id, timeout);
}

// Đóng phiên + refund + tạo “deposit request ảo” cho winner + emit socket
export async function autoCloseAuction(
  auctionId: AnyId,
  ws?: WebSocketService
) {
  const id = typeof auctionId === "string" ? auctionId : auctionId.toString();
  const svc = ws ?? WebSocketService.getInstance();

  const auction = await Auction.findById(id).populate("listingId");
  if (!auction) return;

  // Chỉ đóng khi đang active (idempotent)
  if (auction.status !== "active") return;

  // Xác định bid thắng (nếu có)
  let winningBid: any = null;
  if (auction.bids?.length > 0) {
    winningBid = auction.bids.reduce(
      (max: any, bid: any) => (bid.price > max.price ? bid : max),
      auction.bids[0]
    );
    auction.winnerId = winningBid.userId;
    auction.winningBid = winningBid;
  }

  // Flip trạng thái
  auction.status = "ended";
  await auction.save();

  // Refund cọc cho người thua
  try {
    await auctionDepositService.refundNonWinners(
      id,
      auction.winnerId?.toString()
    );
  } catch (error) {
    console.error("[auctionService] Error refunding non-winners:", error);
  }

  // Tạo DepositRequest/Escrow “ảo” cho winner (để hợp luồng thường)
  if (auction.winnerId && winningBid) {
    try {
      const listing: any = auction.listingId;
      if (listing) {
        const depositAmountForWinner =
          auctionDepositService.getParticipationFee(auction);

        const depositRequest = await DepositRequest.create({
          listingId: listing._id.toString(),
          buyerId: auction.winnerId.toString(),
          sellerId: listing.sellerId.toString(),
          depositAmount: depositAmountForWinner,
          status: "IN_ESCROW",
          sellerConfirmedAt: new Date(),
        });

        const escrowAccount = await EscrowAccount.create({
          buyerId: auction.winnerId.toString(),
          sellerId: listing.sellerId.toString(),
          listingId: listing._id.toString(),
          amount: depositAmountForWinner,
          status: "LOCKED",
        });

        (depositRequest as any).escrowAccountId = (
          escrowAccount as any
        )._id.toString();
        await depositRequest.save();
      }
    } catch (error) {
      console.error(
        "[auctionService] Error creating virtual deposit request:",
        error
      );
    }
  }

  // Emit realtime đến room của phiên
  try {
    svc.emitAuctionEvent(`auction_${id}`, "auction_closed", {
      auctionId: id,
      winner: auction.winnerId,
      winningBid,
    });
  } catch (e) {
    console.error("[auctionService] emit auction_closed error:", e);
  }
}

// =======================================================
// Bootstrap & Cron – đảm bảo không lệ thuộc 100% vào setTimeout
// =======================================================

// Gọi 1 lần khi server start: đóng ngay các phiên đã quá giờ & đặt lại timeout
export async function bootstrapAuctions() {
  const ws = WebSocketService.getInstance();
  const now = new Date();

  // 1) Đóng ngay các phiên active nhưng đã quá hạn
  const overdue = await Auction.find({
    status: "active",
    endAt: { $lte: now },
  }).lean();
  for (const a of overdue) {
    try {
      await autoCloseAuction(a._id.toString(), ws);
    } catch (e) {
      console.error("[auctionService] bootstrap close error:", e);
    }
  }

  // 2) Lên lịch cho các phiên active còn hạn
  const future = await Auction.find({ status: "active", endAt: { $gt: now } });
  for (const a of future) {
    try {
      await scheduleAuctionClose(a);
    } catch (e) {
      console.error("[auctionService] bootstrap schedule error:", e);
    }
  }

  console.log(
    `[auctionService] bootstrap done: closed=${overdue.length}, scheduled=${future.length}`
  );
}

// Cron mỗi phút: sweep phiên quá hạn (nếu timeout bị miss / server restart)
export function startAuctionSweepCron() {
  cron.schedule("*/1 * * * *", async () => {
    try {
      const ws = WebSocketService.getInstance();
      const now = new Date();
      const overdue = await Auction.find({
        status: "active",
        endAt: { $lte: now },
      }).lean();
      if (overdue.length) {
        console.log(
          `[auctionService] cron: closing ${overdue.length} overdue auctions`
        );
      }
      for (const a of overdue) {
        await autoCloseAuction(a._id.toString(), ws);
      }
    } catch (e) {
      console.error("[auctionService] cron sweep error:", e);
    }
  });
}

// =======================================================
// Public service API (giữ nguyên các hàm cũ, chỉ chỉnh nhẹ)
// =======================================================
export const auctionService = {
  async createAuction({
    listingId,
    startAt,
    endAt,
    startingPrice,
    depositAmount,
    sellerId,
  }: {
    listingId: string;
    startAt: string | Date;
    endAt: string | Date;
    startingPrice: number;
    depositAmount?: number;
    sellerId: AnyId;
  }) {
    const listing = await Listing.findById(listingId);
    if (!listing) throw new Error("Không tìm thấy sản phẩm");
    if (listing.sellerId.toString() !== sellerId.toString())
      throw new Error("Bạn không phải chủ sở hữu");

    // Listing đã có phiên active?
    const existingForListing = await Auction.findOne({
      listingId,
      status: { $in: ["active"] },
    });
    if (existingForListing)
      throw new Error("Sản phẩm này đã có phiên đấu giá đang hoạt động");

    // Seller có phiên active/upcoming nào khác?
    const now = new Date();
    const sellerListings = await Listing.find({ sellerId }).select("_id");
    const sellerListingIds = sellerListings.map((l) => l._id);

    const existingActiveAuction = await Auction.findOne({
      listingId: { $in: sellerListingIds },
      status: "active",
      $or: [
        { startAt: { $lte: now }, endAt: { $gte: now } },
        { startAt: { $gt: now } },
      ],
    });
    if (existingActiveAuction) {
      throw new Error(
        "Bạn đang có phiên đấu giá khác đang hoạt động hoặc sắp diễn ra. Vui lòng chờ phiên đó kết thúc."
      );
    }

    if (!startAt || !endAt) throw new Error("Thiếu thời gian phiên");
    if (new Date(endAt) <= new Date(startAt))
      throw new Error("endAt phải sau startAt");
    if (Date.now() - Date.parse(String(startAt)) > 3600000)
      throw new Error("startAt đã quá xa hiện tại");

    const auction = await Auction.create({
      listingId,
      startAt,
      endAt,
      status: "active",
      startingPrice,
      depositAmount: depositAmount || 0,
      bids: [],
    });

    await scheduleAuctionClose(auction);
    return auction;
  },

  async placeBid({
    auctionId,
    price,
    userId,
  }: {
    auctionId: string;
    price: number;
    userId: AnyId;
  }) {
    const auction = await Auction.findById(auctionId).populate("listingId");
    if (!auction) throw new Error("Phiên đấu giá không tồn tại");
    if (auction.status !== "active") throw new Error("Phiên đã đóng");

    const listing: any = auction.listingId;
    if (listing.sellerId.toString() === userId.toString()) {
      throw new Error("Bạn không thể đấu giá sản phẩm của chính mình");
    }

    const now = new Date();
    if (now < auction.startAt || now > auction.endAt)
      throw new Error("Ngoài thời gian đấu giá");

    const hasDeposited = await auctionDepositService.hasDeposited(
      auctionId,
      userId.toString()
    );
    if (!hasDeposited) {
      const participationFee =
        auctionDepositService.getParticipationFee(auction);
      throw new Error(
        `Bạn cần đặt cọc ${participationFee.toLocaleString(
          "vi-VN"
        )} VNĐ để tham gia đấu giá`
      );
    }

    const currentHighestBid =
      auction.bids.length > 0
        ? Math.max(...auction.bids.map((b: any) => b.price))
        : auction.startingPrice;

    if (price <= currentHighestBid) {
      throw new Error(
        `Giá đặt phải cao hơn giá hiện tại ${currentHighestBid.toLocaleString(
          "vi-VN"
        )} VNĐ`
      );
    }

    auction.bids.push({ userId, price, createdAt: now } as any);
    await auction.save();
    return auction;
  },

  async getAuctionById(auctionId: string) {
    const auction = await Auction.findById(auctionId)
      .populate(
        "listingId",
        "make model year priceListed photos batteryCapacity range sellerId"
      )
      .populate("bids.userId", "fullName avatar");

    if (!auction) throw new Error("Không tìm thấy phiên đấu giá");

    const deposits = await AuctionDeposit.find({
      auctionId,
      status: { $in: ["FROZEN", "DEDUCTED"] },
    }).populate("userId", "fullName email phone avatar");

    const listing: any = auction.listingId;
    let seller = null;
    if (listing && listing.sellerId) {
      const { User } = await import("../models/User");
      seller = await User.findById(listing.sellerId).select(
        "fullName email phone avatar"
      );
    }

    const auctionData = auction.toObject();
    return {
      ...auctionData,
      participants: deposits.map((d: any) => ({
        userId: (d.userId as any)._id,
        fullName: (d.userId as any).fullName,
        avatar: (d.userId as any).avatar,
        depositStatus: d.status,
        depositedAt: (d as any).frozenAt,
      })),
      seller: seller
        ? {
            userId: seller._id,
            fullName: seller.fullName,
            email: seller.email,
            phone: seller.phone,
            avatar: seller.avatar,
          }
        : null,
      totalParticipants: deposits.length,
    };
  },

  async endAuction(auctionId: string) {
    const ws = WebSocketService.getInstance();

    if (auctionTimeouts.has(auctionId)) {
      clearTimeout(auctionTimeouts.get(auctionId)!);
      auctionTimeouts.delete(auctionId);
    }
    await autoCloseAuction(auctionId, ws);
    // trả lại record hiện tại (đã được autoCloseAuction flip status)
    return Auction.findById(auctionId);
  },

  // ===== LIST APIs (giữ nguyên, chỉ dùng thời gian để lọc hợp lý) =====
  async getOngoingAuctions(page = 1, limit = 10) {
    const now = new Date();
    const skip = (page - 1) * limit;
    const query = {
      status: "active",
      startAt: { $lte: now },
      endAt: { $gte: now },
    };

    const auctions = await Auction.find(query)
      .populate("listingId", "make model year priceListed photos status")
      .populate("winnerId", "fullName avatar email")
      .sort({ startAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Auction.countDocuments(query);

    return {
      auctions,
      pagination: { current: page, pages: Math.ceil(total / limit), total },
    };
  },

  async getUpcomingAuctions(page = 1, limit = 10) {
    const now = new Date();
    const skip = (page - 1) * limit;
    const query = { status: "active", startAt: { $gt: now } };

    const auctions = await Auction.find(query)
      .populate("listingId", "make model year priceListed photos status")
      .sort({ startAt: 1 })
      .skip(skip)
      .limit(limit);
    const total = await Auction.countDocuments(query);

    return {
      auctions,
      pagination: { current: page, pages: Math.ceil(total / limit), total },
    };
  },

  async getEndedAuctions(page = 1, limit = 10) {
    const now = new Date();
    const skip = (page - 1) * limit;
    const query = {
      $or: [
        { status: "ended" },
        { status: "cancelled" },
        { status: "active", endAt: { $lt: now } },
      ],
    };

    const auctions = await Auction.find(query)
      .populate("listingId", "make model year priceListed photos status")
      .populate("winnerId", "fullName avatar email")
      .populate("winningBid.userId", "fullName avatar email")
      .sort({ endAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Auction.countDocuments(query);

    return {
      auctions,
      pagination: { current: page, pages: Math.ceil(total / limit), total },
    };
  },

  async getAllAuctions(filters: any = {}, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const now = new Date();
    const query: any = {};

    if (filters.status) {
      switch (filters.status) {
        case "ongoing":
          query.status = "active";
          query.startAt = { $lte: now };
          query.endAt = { $gte: now };
          break;
        case "upcoming":
          query.status = "active";
          query.startAt = { $gt: now };
          break;
        case "ended":
          query.$or = [
            { status: "ended" },
            { status: "cancelled" },
            { status: "active", endAt: { $lt: now } },
          ];
          break;
      }
    }
    if (filters.listingId) query.listingId = filters.listingId;

    const auctions = await Auction.find(query)
      .populate("listingId", "make model year priceListed photos status")
      .populate("winnerId", "fullName avatar email")
      .populate("bids.userId", "fullName avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Auction.countDocuments(query);

    return {
      auctions,
      pagination: { current: page, pages: Math.ceil(total / limit), total },
    };
  },

  async getWonAuctionsPendingAppointment(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const wonAuctions = await Auction.find({
      winnerId: userId,
      status: "ended",
    })
      .populate(
        "listingId",
        "make model year priceListed photos batteryCapacity range sellerId"
      )
      .sort({ endAt: -1 })
      .lean();

    const auctionsWithAppointmentStatus = await Promise.all(
      wonAuctions.map(async (auction: any) => {
        const appointment = await Appointment.findOne({
          auctionId: auction._id,
          appointmentType: "AUCTION",
        }).select("_id status scheduledDate createdAt");
        return {
          ...auction,
          hasAppointment: !!appointment,
          appointment: appointment || null,
        };
      })
    );

    const pendingAuctions = auctionsWithAppointmentStatus.filter(
      (a) => !a.hasAppointment
    );
    const total = pendingAuctions.length;
    const paginatedAuctions = pendingAuctions.slice(skip, skip + limit);

    return {
      auctions: paginatedAuctions,
      pagination: { current: page, pages: Math.ceil(total / limit), total },
    };
  },

  scheduleAuctionClose,
  autoCloseAuction,
};
