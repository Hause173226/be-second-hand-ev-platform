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
