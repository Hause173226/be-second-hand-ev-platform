import { Request, Response } from "express";
import Auction from "../models/Auction";
import { WebSocketService } from "../services/websocketService";

/**
 * Cleanup endpoint để test auto-cancel logic
 * Chỉ dùng cho testing/admin
 */
export const cleanupExpiredPendingAuctions = async (req: Request, res: Response) => {
    try {
        const ws = WebSocketService.getInstance();
        const now = new Date();

        // Tìm các phiên pending đã quá thời gian startAt
        const pendingExpired = await Auction.find({
            approvalStatus: 'pending',
            status: 'pending',
            startAt: { $lte: now }
        }).populate('listingId', 'make model year sellerId');

        const results = [];

        for (const auction of pendingExpired) {
            const listing: any = auction.listingId;
            const sellerId = listing?.sellerId?.toString();
            const cancellationReason = `Phiên đấu giá bị hủy do đã quá thời gian bắt đầu mà chưa được staff phê duyệt`;

            auction.status = 'cancelled';
            auction.approvalStatus = 'rejected';
            auction.cancellationReason = cancellationReason;
            await auction.save();

            // Gửi thông báo cho người bán
            if (sellerId) {
                const NotificationMessage = (await import('../models/NotificationMessage')).default;
                await NotificationMessage.create({
                    recipientId: sellerId,
                    type: 'auction_cancelled',
                    title: 'Phiên đấu giá bị hủy',
                    message: cancellationReason,
                    relatedId: auction._id.toString(),
                    metadata: {
                        auctionId: auction._id.toString(),
                        reason: 'auto_cancel_pending_expired',
                        startAt: auction.startAt
                    }
                });

                ws.sendToUser(sellerId, 'auction_cancelled', {
                    auctionId: auction._id.toString(),
                    title: 'Phiên đấu giá bị hủy',
                    message: cancellationReason,
                    reason: cancellationReason
                });
            }

            results.push({
                auctionId: auction._id.toString(),
                listing: listing ? `${listing.make} ${listing.model} ${listing.year}` : 'N/A',
                startAt: auction.startAt,
                cancelled: true
            });
        }

        res.json({
            success: true,
            message: `Đã hủy ${results.length} phiên pending quá hạn`,
            data: results
        });
    } catch (err) {
        console.error('Lỗi cleanup:', err);
        res.status(500).json({ 
            success: false,
            message: err instanceof Error ? err.message : 'Lỗi server' 
        });
    }
};
