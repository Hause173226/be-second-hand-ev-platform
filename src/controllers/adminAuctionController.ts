import { Request, Response } from "express";
import Auction from "../models/Auction";
import AuctionDeposit from "../models/AuctionDeposit";

/**
 * Admin lấy tất cả auctions với filter
 * GET /api/auctions/admin/all
 */
export const getAllAuctionsForAdmin = async (req: Request, res: Response) => {
    try {
        const staffRole = (req as any).user?.role;

        // Kiểm tra quyền staff/admin
        if (staffRole !== 'staff' && staffRole !== 'admin') {
            return res.status(403).json({ 
                success: false,
                message: "Chỉ staff/admin mới có quyền xem" 
            });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const filter = req.query.filter as string;
        const skip = (page - 1) * limit;

        const now = new Date();
        const query: any = {};

        // Filter theo trạng thái
        switch (filter) {
            case "pending":
                // Đang chờ duyệt
                query.approvalStatus = "pending";
                query.status = "pending";
                break;

            case "approved":
                // Đã được duyệt, chưa bắt đầu
                query.approvalStatus = "approved";
                query.status = "approved";
                query.startAt = { $gt: now };
                break;

            case "upcoming":
                // Sắp diễn ra (trong 24h)
                const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                query.approvalStatus = "approved";
                query.status = "approved";
                query.startAt = { $gte: now, $lte: next24Hours };
                break;

            case "ongoing":
                // Đang diễn ra
                query.status = "active";
                query.startAt = { $lte: now };
                query.endAt = { $gte: now };
                break;

            case "ended":
                // Đã kết thúc
                query.$or = [
                    { status: "ended" },
                    { status: "cancelled" },
                ];
                break;

            case "rejected":
                // Bị từ chối
                query.approvalStatus = "rejected";
                break;

            default:
                // Không filter, lấy tất cả
                break;
        }

        const auctions = await Auction.find(query)
            .populate("listingId", "make model year priceListed photos batteryCapacity range sellerId status")
            .populate("winnerId", "fullName avatar email")
            .populate("bids.userId", "fullName avatar")
            .populate("approvedBy", "fullName email")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await Auction.countDocuments(query);

        // Thêm thông tin chi tiết cho mỗi auction
        const auctionsWithDetails = await Promise.all(
            auctions.map(async (auction: any) => {
                // Đếm số người đã đặt cọc (đã đăng ký tham gia)
                const depositCount = await AuctionDeposit.countDocuments({
                    auctionId: auction._id,
                    status: "FROZEN", // Chỉ đếm deposit đang freeze (đã đăng ký chưa refund)
                });

                // Lấy danh sách người đã đặt cọc (nếu đã approved)
                let participants = [];
                if (auction.approvalStatus === "approved") {
                    const deposits = await AuctionDeposit.find({
                        auctionId: auction._id,
                        status: "FROZEN", // Chỉ lấy deposit đang freeze
                    })
                        .populate("userId", "fullName email phone avatar")
                        .select("userId status frozenAt")
                        .lean();

                    participants = deposits.map((d: any) => ({
                        userId: d.userId._id,
                        fullName: d.userId.fullName,
                        email: d.userId.email,
                        phone: d.userId.phone,
                        avatar: d.userId.avatar,
                        depositStatus: d.status,
                        depositedAt: d.frozenAt,
                    }));
                }

                // Tính display status dựa trên approvalStatus và thời gian
                let displayStatus = auction.status;
                if (auction.approvalStatus === "approved") {
                    const auctionStart = new Date(auction.startAt);
                    const auctionEnd = new Date(auction.endAt);
                    
                    if (now < auctionStart) {
                        displayStatus = "upcoming"; // Sắp diễn ra
                    } else if (now >= auctionStart && now <= auctionEnd) {
                        displayStatus = "ongoing"; // Đang diễn ra
                    } else if (now > auctionEnd) {
                        displayStatus = "ended"; // Đã kết thúc
                    }
                }

                return {
                    ...auction,
                    displayStatus, // Status hiển thị dựa trên thời gian thực tế
                    depositCount,
                    currentBidCount: auction.bids?.length || 0,
                    highestBid: auction.bids?.length > 0 
                        ? Math.max(...auction.bids.map((b: any) => b.price))
                        : auction.startingPrice,
                    participants, // Danh sách người tham gia (chỉ có khi approved)
                    canStart: depositCount >= (auction.minParticipants || 1), // Có đủ người để bắt đầu không
                };
            })
        );

        res.json({
            success: true,
            message: "Lấy danh sách phiên đấu giá thành công",
            data: auctionsWithDetails,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total,
                limit,
            },
        });
    } catch (err) {
        console.error("Lỗi get all auctions for admin:", err);
        res.status(500).json({ 
            success: false,
            message: err instanceof Error ? err.message : "Lỗi server" 
        });
    }
};

/**
 * Admin lấy chi tiết auction với thông tin đầy đủ
 * GET /api/auctions/admin/:auctionId
 */
export const getAuctionDetailForAdmin = async (req: Request, res: Response) => {
    try {
        const staffRole = (req as any).user?.role;

        // Kiểm tra quyền staff/admin
        if (staffRole !== 'staff' && staffRole !== 'admin') {
            return res.status(403).json({ 
                success: false,
                message: "Chỉ staff/admin mới có quyền xem" 
            });
        }

        const { auctionId } = req.params;

        const auction = await Auction.findById(auctionId)
            .populate("listingId", "make model year priceListed photos batteryCapacity range sellerId status")
            .populate("winnerId", "fullName avatar email phone")
            .populate("bids.userId", "fullName avatar email")
            .populate("approvedBy", "fullName email")
            .lean();

        if (!auction) {
            return res.status(404).json({ 
                success: false,
                message: "Không tìm thấy phiên đấu giá" 
            });
        }

        // Lấy thông tin người bán
        const listing: any = auction.listingId;
        let seller = null;
        if (listing?.sellerId) {
            const { User } = await import("../models/User");
            seller = await User.findById(listing.sellerId)
                .select("fullName email phone avatar")
                .lean();
        }

        // Đếm số người đã đặt cọc (đã đăng ký tham gia)
        const depositCount = await AuctionDeposit.countDocuments({
            auctionId: auction._id,
            status: "FROZEN", // Chỉ đếm deposit đang freeze
        });

        // Lấy danh sách tất cả người đã đặt cọc (bao gồm cả đã refund để admin xem lịch sử)
        const deposits = await AuctionDeposit.find({
            auctionId: auction._id,
        })
            .populate("userId", "fullName email phone avatar")
            .select("userId status frozenAt refundedAt amount")
            .sort({ frozenAt: 1 })
            .lean();

        const participants = deposits.map((d: any) => ({
            userId: d.userId._id,
            fullName: d.userId.fullName,
            email: d.userId.email,
            phone: d.userId.phone,
            avatar: d.userId.avatar,
            depositStatus: d.status,
            depositAmount: d.amount,
            depositedAt: d.frozenAt,
            refundedAt: d.refundedAt,
        }));

        res.json({
            success: true,
            data: {
                ...auction,
                seller,
                depositCount,
                currentBidCount: auction.bids?.length || 0,
                highestBid: auction.bids?.length > 0 
                    ? Math.max(...auction.bids.map((b: any) => b.price))
                    : auction.startingPrice,
                participants,
                canStart: depositCount >= (auction.minParticipants || 1),
            },
        });
    } catch (err) {
        console.error("Lỗi get auction detail for admin:", err);
        res.status(500).json({ 
            success: false,
            message: err instanceof Error ? err.message : "Lỗi server" 
        });
    }
};

/**
 * Admin cập nhật cấu hình hệ thống về min/max participants mặc định
 * PATCH /api/auctions/admin/config/participants
 */
export const updateSystemParticipantsConfig = async (req: Request, res: Response) => {
    try {
        const staffRole = (req as any).user?.role;

        // Chỉ admin mới có quyền cập nhật config hệ thống
        if (staffRole !== 'admin') {
            return res.status(403).json({ 
                success: false,
                message: "Chỉ admin mới có quyền cập nhật cấu hình hệ thống" 
            });
        }

        const { minParticipants, maxParticipants } = req.body;

        // Validation
        if (minParticipants !== undefined && (minParticipants < 1 || minParticipants > 30)) {
            return res.status(400).json({ 
                success: false,
                message: "Số người tham gia tối thiểu phải từ 1-30" 
            });
        }

        if (maxParticipants !== undefined && (maxParticipants < 1 || maxParticipants > 100)) {
            return res.status(400).json({ 
                success: false,
                message: "Số người tham gia tối đa phải từ 1-100" 
            });
        }

        if (minParticipants && maxParticipants && minParticipants > maxParticipants) {
            return res.status(400).json({ 
                success: false,
                message: "Số người tối thiểu không được lớn hơn số người tối đa" 
            });
        }

        // Lưu vào một collection SystemConfig (hoặc trả về để FE lưu)
        // Tạm thời trả về config đã validate
        res.json({
            success: true,
            message: "Cấu hình hệ thống được cập nhật",
            data: {
                systemDefaults: {
                    minParticipants: minParticipants || 5,
                    maxParticipants: maxParticipants || 30,
                },
                note: "Staff sẽ sử dụng giá trị này khi approve auction"
            },
        });
    } catch (err) {
        console.error("Lỗi update system config:", err);
        res.status(500).json({ 
            success: false,
            message: err instanceof Error ? err.message : "Lỗi server" 
        });
    }
};
