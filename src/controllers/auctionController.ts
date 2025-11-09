import { Request, Response } from "express";
import { auctionService } from "../services/auctionService";

export const createAuction = async (req: Request, res: Response) => {
    try {
        const { listingId, startAt, endAt, startingPrice, depositAmount } = req.body;
        const sellerId = (req as any).user?._id;
        const auction = await auctionService.createAuction({ 
            listingId, 
            startAt, 
            endAt, 
            startingPrice, 
            depositAmount: depositAmount || 0, // Mặc định 0 nếu không yêu cầu cọc
            sellerId 
        });
        res.status(201).json(auction);
    } catch (err) {
        res.status(400).json({ message: err instanceof Error ? err.message : err });
    }
};

export const placeBid = async (req: Request, res: Response) => {
    try {
        const { auctionId } = req.params;
        const { price } = req.body;
        const userId = (req as any).user?._id;
        const auction = await auctionService.placeBid({ auctionId, price, userId });
        res.json({ message: "Bid thành công", auction });
    } catch (err) {
        res.status(400).json({ message: err instanceof Error ? err.message : err });
    }
};

export const getAuctionById = async (req: Request, res: Response) => {
    try {
        const { auctionId } = req.params;
        const auction = await auctionService.getAuctionById(auctionId);
        if (!auction) return res.status(404).json({ message: "Không tìm thấy phiên" });
        res.json(auction);
    } catch (err) {
        res.status(400).json({ message: err instanceof Error ? err.message : err });
    }
};

export const endAuction = async (req: Request, res: Response) => {
    try {
        const { auctionId } = req.params;
        await auctionService.endAuction(auctionId);
        res.json({ message: "Đã đóng phiên đấu giá" });
    } catch (err) {
        res.status(400).json({ message: err instanceof Error ? err.message : err });
    }
};


export const getOngoingAuctions = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        
        const result = await auctionService.getOngoingAuctions(page, limit);
        res.json(result);
    } catch (err) {
        res.status(400).json({ message: err instanceof Error ? err.message : err });
    }
};


export const getUpcomingAuctions = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        
        const result = await auctionService.getUpcomingAuctions(page, limit);
        res.json(result);
    } catch (err) {
        res.status(400).json({ message: err instanceof Error ? err.message : err });
    }
};


export const getEndedAuctions = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        
        const result = await auctionService.getEndedAuctions(page, limit);
        res.json(result);
    } catch (err) {
        res.status(400).json({ message: err instanceof Error ? err.message : err });
    }
};


export const getAllAuctions = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const filters = {
            status: req.query.status as string,
            listingId: req.query.listingId as string
        };
        
        const result = await auctionService.getAllAuctions(filters, page, limit);
        res.json(result);
    } catch (err) {
        res.status(400).json({ message: err instanceof Error ? err.message : err });
    }
};

// Lấy danh sách phiên đấu giá đã thắng, chưa tạo lịch hẹn
export const getWonAuctionsPendingAppointment = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?._id;
        if (!userId) {
            return res.status(401).json({ 
                success: false,
                message: "Chưa đăng nhập" 
            });
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        
        const result = await auctionService.getWonAuctionsPendingAppointment(userId, page, limit);
        
        res.json({
            success: true,
            message: "Lấy danh sách phiên đấu giá đã thắng thành công",
            data: result.auctions,
            pagination: result.pagination
        });
    } catch (err) {
        res.status(400).json({ 
            success: false,
            message: err instanceof Error ? err.message : err 
        });
    }
};
