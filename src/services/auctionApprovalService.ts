import Auction from "../models/Auction";
import { User } from "../models/User";
import NotificationMessage from "../models/NotificationMessage";
import { WebSocketService } from "./websocketService";

export class AuctionApprovalService {
  /**
   * Approve auction
   */
  async approveAuction(
    auctionId: string,
    staffId: string,
    options?: {
      minParticipants?: number;
      maxParticipants?: number;
    }
  ) {
    // 1. Lấy auction hiện tại
    const auction: any = await Auction.findById(auctionId)
      .populate("listingId", "make model year sellerId")
      .lean();

    if (!auction) {
      throw new Error("Không tìm thấy phiên đấu giá");
    }

    if (auction.approvalStatus !== "pending") {
      const statusText =
        auction.approvalStatus === "approved" ? "được duyệt" : "bị từ chối";
      const approvedAt = auction.approvedAt
        ? ` vào ${new Date(auction.approvedAt).toLocaleString("vi-VN")}`
        : "";
      throw new Error(
        `Phiên đấu giá đã ${statusText}${approvedAt}. Trạng thái hiện tại: ${auction.approvalStatus}`
      );
    }

    // 2. TÍNH TIỀN CỌC = 10% GIÁ KHỞI ĐIỂM (nếu đang 0 / undefined)
    const calculatedDeposit = Math.round(
      (auction.startingPrice || 0) * 0.1 // 10%
    );
    const depositAmountToSet =
      auction.depositAmount && auction.depositAmount > 0
        ? auction.depositAmount
        : calculatedDeposit;

    // 3. Update auction trong DB
    const updatedAuction = await Auction.findByIdAndUpdate(
      auctionId,
      {
        $set: {
          approvalStatus: "approved",
          status: "approved",
          approvedBy: staffId,
          approvedAt: new Date(),
          depositAmount: depositAmountToSet, // 👈 set tiền cọc vào DB
          ...(options?.minParticipants !== undefined && {
            minParticipants: options.minParticipants,
          }),
          ...(options?.maxParticipants !== undefined && {
            maxParticipants: options.maxParticipants,
          }),
        },
      },
      { new: true }
    ).populate("listingId", "make model year photos sellerId");

    if (!updatedAuction) {
      throw new Error("Không tìm thấy phiên đấu giá");
    }

    const listing = updatedAuction.listingId as any;
    const sellerId = listing.sellerId.toString();

    // 4. Gửi notification sau khi duyệt
    await this.sendApprovalNotifications(updatedAuction, listing, sellerId);

    return updatedAuction;
  }

  /**
   * Reject auction
   */
  async rejectAuction(auctionId: string, staffId: string, reason: string) {
    if (!reason || !reason.trim()) {
      throw new Error("Vui lòng nhập lý do từ chối");
    }

    // Lấy auction
    const auction: any = await Auction.findById(auctionId)
      .populate("listingId", "make model year sellerId")
      .lean();

    if (!auction) {
      throw new Error("Không tìm thấy phiên đấu giá");
    }

    if (auction.approvalStatus !== "pending") {
      throw new Error(
        `Phiên đấu giá đã ${
          auction.approvalStatus === "approved" ? "được duyệt" : "bị từ chối"
        }`
      );
    }

    // Update auction
    const updatedAuction = await Auction.findByIdAndUpdate(
      auctionId,
      {
        $set: {
          approvalStatus: "rejected",
          status: "cancelled",
          rejectionReason: reason.trim(),
          approvedBy: staffId,
          approvedAt: new Date(),
        },
      },
      { new: true }
    ).populate("listingId", "make model year sellerId");

    if (!updatedAuction) {
      throw new Error("Không tìm thấy phiên đấu giá");
    }

    const listing = updatedAuction.listingId as any;
    const sellerId = listing.sellerId.toString();

    // Send rejection notification
    await this.sendRejectionNotification(
      updatedAuction,
      listing,
      sellerId,
      reason
    );

    return updatedAuction;
  }

  /**
   * Update min/max participants
   */
  async updateParticipants(auctionId: string, options: { minParticipants?: number; maxParticipants?: number }) {
    const { minParticipants, maxParticipants } = options;

    // Validation
    if (minParticipants !== undefined && minParticipants < 1) {
      throw new Error("Số người tham gia tối thiểu phải >= 1");
    }

    if (maxParticipants !== undefined && maxParticipants < 1) {
      throw new Error("Số người tham gia tối đa phải >= 1");
    }

    if (
      minParticipants !== undefined &&
      maxParticipants !== undefined &&
      minParticipants > maxParticipants
    ) {
      throw new Error("Số người tối thiểu không được lớn hơn số người tối đa");
    }

    const updateData: any = {};
    if (minParticipants !== undefined) updateData.minParticipants = minParticipants;
    if (maxParticipants !== undefined) updateData.maxParticipants = maxParticipants;

    const auction = await Auction.findByIdAndUpdate(
      auctionId,
      { $set: updateData },
      { new: true }
    ).populate("listingId", "make model year");

    if (!auction) {
      throw new Error("Không tìm thấy phiên đấu giá");
    }

    return auction;
  }

  /**
   * Get pending auctions
   */
  async getPendingAuctions(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const auctions = await Auction.find({ approvalStatus: "pending" })
      .populate(
        "listingId",
        "make model year photos priceListed sellerId"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalCount = await Auction.countDocuments({
      approvalStatus: "pending",
    });

    return {
      auctions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit,
      },
    };
  }

  /**
   * Send approval notifications
   */
  private async sendApprovalNotifications(
    auction: any,
    listing: any,
    sellerId: string
  ) {
    const auctionId = auction._id.toString();

    // 1. Gửi thông báo cho người bán
    await NotificationMessage.create({
      userId: sellerId,
      type: "system",
      title: "Phiên đấu giá đã được phê duyệt",
      message: `Phiên đấu giá cho xe ${listing.make} ${listing.model} ${listing.year} của bạn đã được phê duyệt và sẽ bắt đầu vào ${new Date(
        auction.startAt
      ).toLocaleString("vi-VN")}`,
      relatedId: auctionId,
      actionUrl: `/auctions/${auctionId}`,
      actionText: "Xem chi tiết",
      metadata: {
        auctionId,
        listingId: listing._id.toString(),
        startAt: auction.startAt,
        endAt: auction.endAt,
        minParticipants: auction.minParticipants,
        maxParticipants: auction.maxParticipants,
        notificationType: "auction_approved",
      },
    });

    // 2. Gửi thông báo broadcast cho toàn bộ hệ thống (buyer)
    const allUsers = await User.find({ role: "buyer" }).select("_id").lean();
    const notifications = allUsers.map((user) => ({
      userId: user._id,
      type: "system",
      title: "Phiên đấu giá mới",
      message: `Phiên đấu giá cho xe ${listing.make} ${listing.model} ${listing.year} sắp bắt đầu vào ${new Date(
        auction.startAt
      ).toLocaleString("vi-VN")}. Đặt cọc ngay để tham gia!`,
      relatedId: auctionId,
      actionUrl: `/auctions/${auctionId}`,
      actionText: "Xem chi tiết",
      metadata: {
        auctionId,
        listingId: listing._id.toString(),
        startAt: auction.startAt,
        endAt: auction.endAt,
        startingPrice: auction.startingPrice,
        depositAmount: auction.depositAmount, // 👈 giờ đã có giá trị 10%
        vehicleInfo: `${listing.make} ${listing.model} ${listing.year}`,
        photos: listing.photos,
        notificationType: "new_auction",
      },
    }));

    await NotificationMessage.insertMany(notifications);

    // 3. Emit WebSocket events
    try {
      const wsService = WebSocketService.getInstance();

      // Gửi cho người bán
      wsService.sendToUser(sellerId, "auction_approved", {
        auctionId,
        title: "Phiên đấu giá đã được phê duyệt",
        message: `Phiên đấu giá cho xe ${listing.make} ${listing.model} ${listing.year} của bạn đã được phê duyệt`,
        auction,
      });

      // Broadcast cho toàn bộ hệ thống
      wsService.broadcast("new_auction_available", {
        auctionId,
        title: "Phiên đấu giá mới",
        message: `Phiên đấu giá cho xe ${listing.make} ${listing.model} ${listing.year} sắp bắt đầu`,
        auction: {
          _id: auction._id,
          startAt: auction.startAt,
          endAt: auction.endAt,
          startingPrice: auction.startingPrice,
          depositAmount: auction.depositAmount,
          listing: {
            make: listing.make,
            model: listing.model,
            year: listing.year,
            photos: listing.photos,
          },
        },
      });
    } catch (wsError) {
      console.error("Lỗi gửi WebSocket notification:", wsError);
    }
  }

  /**
   * Send rejection notification
   */
  private async sendRejectionNotification(
    auction: any,
    listing: any,
    sellerId: string,
    reason: string
  ) {
    const auctionId = auction._id.toString();

    // Gửi thông báo cho người bán
    await NotificationMessage.create({
      userId: sellerId,
      type: "system",
      title: "Phiên đấu giá bị từ chối",
      message: `Phiên đấu giá cho xe ${listing.make} ${listing.model} ${listing.year} của bạn đã bị từ chối. Lý do: ${reason}`,
      relatedId: auctionId,
      actionUrl: `/listings/${listing._id}`,
      actionText: "Xem sản phẩm",
      metadata: {
        auctionId,
        listingId: listing._id.toString(),
        reason: reason.trim(),
        notificationType: "auction_rejected",
      },
    });

    // Emit WebSocket event
    try {
      const wsService = WebSocketService.getInstance();
      wsService.sendToUser(sellerId, "auction_rejected", {
        auctionId,
        title: "Phiên đấu giá bị từ chối",
        message: `Phiên đấu giá cho xe ${listing.make} ${listing.model} ${listing.year} của bạn đã bị từ chối`,
        reason: reason.trim(),
        auction,
      });
    } catch (wsError) {
      console.error("Lỗi gửi WebSocket notification:", wsError);
    }
  }
}

export const auctionApprovalService = new AuctionApprovalService();
