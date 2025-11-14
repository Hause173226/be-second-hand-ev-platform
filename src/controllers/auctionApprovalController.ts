import { Request, Response } from "express";
import { auctionApprovalService } from "../services/auctionApprovalService";

/**
 * Staff approve auction
 * POST /api/admin/auctions/:auctionId/approve
 */
export const approveAuction = async (req: Request, res: Response) => {
    try {
        const { auctionId } = req.params;
        const { minParticipants, maxParticipants } = req.body;
        const staffId = (req as any).user?._id;
        const staffRole = (req as any).user?.role;

        // Kiểm tra quyền staff
        if (staffRole !== 'staff' && staffRole !== 'admin') {
            return res.status(403).json({ 
                success: false,
                message: "Chỉ staff/admin mới có quyền duyệt phiên đấu giá" 
            });
        }

        const auction = await auctionApprovalService.approveAuction(
            auctionId,
            staffId,
            { minParticipants, maxParticipants }
        );

        res.json({
            success: true,
            message: 'Phiên đấu giá đã được phê duyệt thành công',
            data: auction
        });
    } catch (err) {
        console.error('Lỗi approve auction:', err);
        res.status(err instanceof Error && err.message.includes('Không tìm thấy') ? 404 : 400).json({ 
            success: false,
            message: err instanceof Error ? err.message : 'Lỗi server' 
        });
    }
};

/**
 * Staff reject auction
 * POST /api/admin/auctions/:auctionId/reject
 */
export const rejectAuction = async (req: Request, res: Response) => {
    try {
        const { auctionId } = req.params;
        const { reason } = req.body;
        const staffId = (req as any).user?._id;
        const staffRole = (req as any).user?.role;

        // Kiểm tra quyền staff
        if (staffRole !== 'staff' && staffRole !== 'admin') {
            return res.status(403).json({ 
                success: false,
                message: "Chỉ staff/admin mới có quyền từ chối phiên đấu giá" 
            });
        }

        const auction = await auctionApprovalService.rejectAuction(
            auctionId,
            staffId,
            reason
        );

        res.json({
            success: true,
            message: 'Phiên đấu giá đã bị từ chối',
            data: auction
        });
    } catch (err) {
        console.error('Lỗi reject auction:', err);
        res.status(err instanceof Error && err.message.includes('Không tìm thấy') ? 404 : 400).json({ 
            success: false,
            message: err instanceof Error ? err.message : 'Lỗi server' 
        });
    }
};

/**
 * Staff update min/max participants
 * PATCH /api/admin/auctions/:auctionId/participants
 */
export const updateParticipants = async (req: Request, res: Response) => {
    try {
        const { auctionId } = req.params;
        const { minParticipants, maxParticipants } = req.body;
        const staffRole = (req as any).user?.role;

        // Kiểm tra quyền staff
        if (staffRole !== 'staff' && staffRole !== 'admin') {
            return res.status(403).json({ 
                success: false,
                message: "Chỉ staff/admin mới có quyền cập nhật" 
            });
        }

        const auction = await auctionApprovalService.updateParticipants(
            auctionId,
            { minParticipants, maxParticipants }
        );

        res.json({
            success: true,
            message: 'Cập nhật số lượng người tham gia thành công',
            data: auction
        });
    } catch (err) {
        console.error('Lỗi update participants:', err);
        res.status(err instanceof Error && err.message.includes('Không tìm thấy') ? 404 : 400).json({ 
            success: false,
            message: err instanceof Error ? err.message : 'Lỗi server' 
        });
    }
};

/**
 * Get pending auctions for staff review
 * GET /api/admin/auctions/pending
 */
export const getPendingAuctions = async (req: Request, res: Response) => {
    try {
        const staffRole = (req as any).user?.role;

        // Kiểm tra quyền staff
        if (staffRole !== 'staff' && staffRole !== 'admin') {
            return res.status(403).json({ 
                success: false,
                message: "Chỉ staff/admin mới có quyền xem" 
            });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        const result = await auctionApprovalService.getPendingAuctions(page, limit);

        res.json({
            success: true,
            data: result.auctions,
            pagination: result.pagination
        });
    } catch (err) {
        console.error('Lỗi get pending auctions:', err);
        res.status(500).json({ 
            success: false,
            message: err instanceof Error ? err.message : 'Lỗi server' 
        });
    }
};
