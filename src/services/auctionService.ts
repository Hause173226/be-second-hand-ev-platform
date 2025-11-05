import Auction from "../models/Auction";
import Listing from "../models/Listing";
import { WebSocketService } from './websocketService';
import auctionDepositService from './auctionDepositService';

// Map lưu các timeout đóng phiên trong RAM
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
    const auction = await Auction.findById(auctionId);
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
        const existing = await Auction.findOne({ listingId, status: { $in: ["active"] } });
        if (existing) throw new Error("Đã có phiên đấu giá đang hoạt động");
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
        const auction = await Auction.findById(auctionId);
        if (!auction) throw new Error("Phiên đấu giá không tồn tại");
        if (auction.status !== "active") throw new Error("Phiên đã đóng");
        const now = new Date();
        if (now < auction.startAt || now > auction.endAt) throw new Error("Ngoài thời gian đấu giá");
        
        // Kiểm tra đã đặt cọc chưa (nếu phiên yêu cầu cọc)
        if (auction.depositAmount > 0) {
            const hasDeposited = await auctionDepositService.hasDeposited(auctionId, userId);
            if (!hasDeposited) {
                throw new Error(`Bạn cần đặt cọc ${auction.depositAmount.toLocaleString('vi-VN')} VNĐ để tham gia đấu giá`);
            }
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
        return Auction.findById(auctionId)
            .populate("listingId", "make model year priceListed photos")
            .populate("bids.userId", "fullName avatar");
    },

    async endAuction(auctionId) {
        const Auction = (await import('../models/Auction')).default;
        const ws = WebSocketService.getInstance();
        const auction = await Auction.findById(auctionId);
        if (!auction) throw new Error("Không tìm thấy phiên");
        if (auction.status !== "active") throw new Error("Phiên đã đóng");
        if (new Date() < auction.endAt) throw new Error("Chưa hết thời gian");
        if (auctionTimeouts.has(auctionId)) {
            clearTimeout(auctionTimeouts.get(auctionId));
            auctionTimeouts.delete(auctionId);
        }
        await autoCloseAuction(auctionId, ws);
        return auction;
    },
    scheduleAuctionClose,
    autoCloseAuction,
    auctionTimeouts, // expose for test/monitor
};
