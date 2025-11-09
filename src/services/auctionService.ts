import Auction from "../models/Auction";
import Listing from "../models/Listing";
import DepositRequest from "../models/DepositRequest";
import EscrowAccount from "../models/EscrowAccount";
import AuctionDeposit from "../models/AuctionDeposit";
import Appointment from "../models/Appointment";
import { WebSocketService } from './websocketService';
import auctionDepositService from './auctionDepositService';


const auctionTimeouts = new Map<string, NodeJS.Timeout>();

async function scheduleAuctionClose(auction) {
    const ws = WebSocketService.getInstance();
    const ms = new Date(auction.endAt).getTime() - Date.now();
    if (ms > 0) {
        const timeout = setTimeout(async () => {
            await autoCloseAuction(auction._id, ws);
            auctionTimeouts.delete(auction._id.toString());
        }, ms);
        auctionTimeouts.set(auction._id.toString(), timeout);
    }
}

async function autoCloseAuction(auctionId, ws) {
    const Auction = (await import('../models/Auction')).default;
    const auction = await Auction.findById(auctionId).populate('listingId');
    if (!auction || auction.status !== 'active') return;
    
    let winningBid = null;
    if (auction.bids.length > 0) {
        winningBid = auction.bids.reduce((max, bid) => bid.price > max.price ? bid : max, auction.bids[0]);
        auction.winnerId = winningBid.userId;
        auction.winningBid = winningBid;
    }
    
    auction.status = 'ended';
    await auction.save();
    
    // Hoàn tiền cọc cho những người không thắng
    try {
        await auctionDepositService.refundNonWinners(
            auctionId, 
            auction.winnerId?.toString()
        );
    } catch (error) {
        console.error('Error refunding non-winners:', error);
    }

    // Tạo DepositRequest ảo cho winner để tương thích với luồng thông thường
    if (auction.winnerId && winningBid) {
        try {
            const listing = auction.listingId as any;
            if (listing) {
                // Tạo DepositRequest với status IN_ESCROW sẵn
                const depositRequest = await DepositRequest.create({
                    listingId: listing._id.toString(),
                    buyerId: auction.winnerId.toString(),
                    sellerId: listing.sellerId.toString(),
                    depositAmount: auctionDepositService.getParticipationFee(), // 1 triệu VND
                    status: 'IN_ESCROW', // Đã có tiền cọc từ đấu giá
                    sellerConfirmedAt: new Date() // Tự động xác nhận vì đấu giá
                });

                // Tạo EscrowAccount ảo để tương thích
                const escrowAccount = await EscrowAccount.create({
                    buyerId: auction.winnerId.toString(),
                    sellerId: listing.sellerId.toString(),
                    listingId: listing._id.toString(),
                    amount: auctionDepositService.getParticipationFee(),
                    status: 'LOCKED'
                });

                depositRequest.escrowAccountId = (escrowAccount as any)._id.toString();
                await depositRequest.save();

                console.log(`Created virtual DepositRequest ${depositRequest._id} for auction winner`);
            }
        } catch (error) {
            console.error('Error creating virtual deposit request:', error);
        }
    }
    
    ws.io.to(`auction_${auctionId}`).emit('auction_closed', {
        auctionId,
        winner: auction.winnerId,
        winningBid
    });
}

export const auctionService = {
    async createAuction({ listingId, startAt, endAt, startingPrice, depositAmount, sellerId }) {
        const listing = await Listing.findById(listingId);
        if (!listing) throw new Error("Không tìm thấy sản phẩm");
        if (listing.sellerId.toString() !== sellerId.toString()) throw new Error("Bạn không phải chủ sở hữu");
        
        // Kiểm tra listing này đã có phiên đấu giá active chưa
        const existingForListing = await Auction.findOne({ listingId, status: { $in: ["active"] } });
        if (existingForListing) throw new Error("Sản phẩm này đã có phiên đấu giá đang hoạt động");
        
        // Kiểm tra seller có phiên đấu giá active nào khác không
        const now = new Date();
        const sellerListings = await Listing.find({ sellerId }).select('_id');
        const sellerListingIds = sellerListings.map(l => l._id);
        
        const existingActiveAuction = await Auction.findOne({
            listingId: { $in: sellerListingIds },
            status: "active",
            $or: [
                { startAt: { $lte: now }, endAt: { $gte: now } }, // Đang diễn ra
                { startAt: { $gt: now } } // Hoặc sắp diễn ra
            ]
        });
        
        if (existingActiveAuction) {
            throw new Error("Bạn đang có phiên đấu giá khác đang hoạt động hoặc sắp diễn ra. Vui lòng chờ phiên đó kết thúc.");
        }
        
        if (!startAt || !endAt) throw new Error("Thiếu thời gian phiên");
        if (new Date(endAt) <= new Date(startAt)) throw new Error("endAt phải sau startAt");
        if ((Date.now() - Date.parse(startAt)) > 3600000) throw new Error("startAt đã quá xa hiện tại");
        
        // Tạo auction với depositAmount
        const auction = await Auction.create({ 
            listingId, 
            startAt, 
            endAt, 
            status: "active", 
            startingPrice, 
            depositAmount: depositAmount || 0, // Mặc định 0 nếu không có
            bids: [] 
        });
        
        await scheduleAuctionClose(auction);
        return auction;
    },

    async placeBid({ auctionId, price, userId }) {
        const auction = await Auction.findById(auctionId).populate('listingId');
        if (!auction) throw new Error("Phiên đấu giá không tồn tại");
        if (auction.status !== "active") throw new Error("Phiên đã đóng");
        
        // Kiểm tra user có phải là seller của sản phẩm không
        const listing = auction.listingId as any;
        if (listing.sellerId.toString() === userId.toString()) {
            throw new Error("Bạn không thể đấu giá sản phẩm của chính mình");
        }
        
        const now = new Date();
        if (now < auction.startAt || now > auction.endAt) throw new Error("Ngoài thời gian đấu giá");
        
        // BẮT BUỘC phải đặt cọc trước khi bid (PHÍ CỐ ĐỊNH 1 TRIỆU)
        const hasDeposited = await auctionDepositService.hasDeposited(auctionId, userId);
        if (!hasDeposited) {
            const participationFee = auctionDepositService.getParticipationFee();
            throw new Error(`Bạn cần đặt cọc ${participationFee.toLocaleString('vi-VN')} VNĐ để tham gia đấu giá`);
        }
        
        // Tính giá cao nhất hiện tại (từ các bid hoặc giá khởi điểm)
        const currentHighestBid = auction.bids.length > 0 
            ? Math.max(...auction.bids.map(b => b.price)) 
            : auction.startingPrice;
        
        // Giá mới phải lớn hơn giá cao nhất hiện tại
        if (price <= currentHighestBid) {
            throw new Error(`Giá đặt phải cao hơn giá hiện tại ${currentHighestBid.toLocaleString('vi-VN')} VNĐ`);
        }
        
        auction.bids.push({ userId, price, createdAt: now });
        await auction.save();
        return auction;
    },

    async getAuctionById(auctionId) {
        const auction = await Auction.findById(auctionId)
            .populate("listingId", "make model year priceListed photos batteryCapacity range sellerId")
            .populate("bids.userId", "fullName avatar");
        
        if (!auction) {
            throw new Error("Không tìm thấy phiên đấu giá");
        }

        // Lấy danh sách người đã đặt cọc (participants)
        const deposits = await AuctionDeposit.find({ 
            auctionId,
            status: { $in: ['FROZEN', 'DEDUCTED'] } // Chỉ lấy người còn tham gia
        }).populate('userId', 'fullName email phone avatar');

        // Lấy thông tin seller (chủ xe)
        const listing = auction.listingId as any;
        let seller = null;
        if (listing && listing.sellerId) {
            const User = (await import('../models/User')).User;
            seller = await User.findById(listing.sellerId).select('fullName email phone avatar');
        }

        // Format response
        const auctionData = auction.toObject();
        return {
            ...auctionData,
            participants: deposits.map(d => ({
                userId: (d.userId as any)._id,
                fullName: (d.userId as any).fullName,
                avatar: (d.userId as any).avatar,
                depositStatus: d.status,
                depositedAt: d.frozenAt
            })),
            seller: seller ? {
                userId: seller._id,
                fullName: seller.fullName,
                email: seller.email,
                phone: seller.phone,
                avatar: seller.avatar
            } : null,
            totalParticipants: deposits.length
        };
    },

    async endAuction(auctionId) {
        const Auction = (await import('../models/Auction')).default;
        const ws = WebSocketService.getInstance();
        const auction = await Auction.findById(auctionId);
        if (!auction) throw new Error("Không tìm thấy phiên");
        if (auction.status !== "active") throw new Error("Phiên đã đóng");
        // Bỏ check thời gian - cho phép kết thúc sớm
        // if (new Date() < auction.endAt) throw new Error("Chưa hết thời gian");
        if (auctionTimeouts.has(auctionId)) {
            clearTimeout(auctionTimeouts.get(auctionId));
            auctionTimeouts.delete(auctionId);
        }
        await autoCloseAuction(auctionId, ws);
        return auction;
    },

    /**
     * Lấy danh sách phiên đấu giá đang diễn ra
     * Điều kiện: status = "active" VÀ startAt <= now <= endAt
     */
    async getOngoingAuctions(page = 1, limit = 10) {
        const now = new Date();
        const skip = (page - 1) * limit;

        const query = {
            status: "active",
            startAt: { $lte: now },
            endAt: { $gte: now }
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
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        };
    },

    /**
     * Lấy danh sách phiên đấu giá sắp diễn ra
     * Điều kiện: status = "active" VÀ startAt > now
     */
    async getUpcomingAuctions(page = 1, limit = 10) {
        const now = new Date();
        const skip = (page - 1) * limit;

        const query = {
            status: "active",
            startAt: { $gt: now }
        };

        const auctions = await Auction.find(query)
            .populate("listingId", "make model year priceListed photos status")
            .sort({ startAt: 1 }) // Sắp xếp theo thời gian bắt đầu sớm nhất
            .skip(skip)
            .limit(limit);

        const total = await Auction.countDocuments(query);

        return {
            auctions,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        };
    },

    /**
     * Lấy danh sách phiên đấu giá đã kết thúc
     * Điều kiện: status = "ended" HOẶC (status = "active" VÀ endAt < now)
     */
    async getEndedAuctions(page = 1, limit = 10) {
        const now = new Date();
        const skip = (page - 1) * limit;

        const query = {
            $or: [
                { status: "ended" },
                { status: "cancelled" },
                { status: "active", endAt: { $lt: now } }
            ]
        };

        const auctions = await Auction.find(query)
            .populate("listingId", "make model year priceListed photos status")
            .populate("winnerId", "fullName avatar email")
            .populate("winningBid.userId", "fullName avatar email")
            .sort({ endAt: -1 }) // Sắp xếp theo thời gian kết thúc gần nhất
            .skip(skip)
            .limit(limit);

        const total = await Auction.countDocuments(query);

        return {
            auctions,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        };
    },

    /**
     * Lấy tất cả phiên đấu giá (có filter theo status logic)
     */
    async getAllAuctions(filters: any = {}, page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const now = new Date();
        const query: any = {};

        // Filter theo status logic (ongoing, upcoming, ended)
        if (filters.status) {
            switch (filters.status) {
                case 'ongoing':
                    query.status = 'active';
                    query.startAt = { $lte: now };
                    query.endAt = { $gte: now };
                    break;
                case 'upcoming':
                    query.status = 'active';
                    query.startAt = { $gt: now };
                    break;
                case 'ended':
                    query.$or = [
                        { status: 'ended' },
                        { status: 'cancelled' },
                        { status: 'active', endAt: { $lt: now } }
                    ];
                    break;
            }
        }

        // Filter theo listingId nếu có
        if (filters.listingId) {
            query.listingId = filters.listingId;
        }

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
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        };
    },

    /**
     * Lấy danh sách phiên đấu giá đã thắng, chưa tạo lịch hẹn
     * Dành cho winner để biết phiên nào cần tạo appointment
     */
    async getWonAuctionsPendingAppointment(userId: string, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        // Tìm tất cả auction mà user là winner và status = ended
        const wonAuctions = await Auction.find({
            winnerId: userId,
            status: 'ended'
        })
        .populate("listingId", "make model year priceListed photos batteryCapacity range sellerId")
        .sort({ endAt: -1 })
        .lean();

        // Với mỗi auction, check xem đã có appointment chưa
        const auctionsWithAppointmentStatus = await Promise.all(
            wonAuctions.map(async (auction) => {
                const appointment = await Appointment.findOne({
                    auctionId: auction._id,
                    appointmentType: 'AUCTION'
                }).select('_id status scheduledDate createdAt');

                return {
                    ...auction,
                    hasAppointment: !!appointment,
                    appointment: appointment || null
                };
            })
        );

        // Filter chỉ lấy những phiên chưa có appointment
        const pendingAuctions = auctionsWithAppointmentStatus.filter(
            auction => !auction.hasAppointment
        );

        // Pagination
        const total = pendingAuctions.length;
        const paginatedAuctions = pendingAuctions.slice(skip, skip + limit);

        return {
            auctions: paginatedAuctions,
            pagination: {
                current: page,
                pages: Math.ceil(total / limit),
                total
            }
        };
    },

    scheduleAuctionClose,
    autoCloseAuction,
    auctionTimeouts, // expose for test/monitor
};
