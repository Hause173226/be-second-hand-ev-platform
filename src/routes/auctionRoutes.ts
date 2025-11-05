import express from "express";
import { authenticate } from "../middlewares/authenticate";
import { createAuction, placeBid, getAuctionById, endAuction } from "../controllers/auctionController";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Auction
 *     description: Quản lý phiên đấu giá sản phẩm
 */

/**
 * @swagger
 * /api/auctions:
 *   post:
 *     summary: Tạo phiên đấu giá mới cho sản phẩm
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               listingId:
 *                 type: string
 *               startAt:
 *                 type: string
 *                 format: date-time
 *               endAt:
 *                 type: string
 *                 format: date-time
 *               startingPrice:
 *                 type: number
 *     responses:
 *       201: { description: Tạo phiên thành công }
 *       400: { description: Dữ liệu không hợp lệ }
 *       401: { description: Unauthorized }
 */
router.post("/", authenticate, createAuction);

/**
 * @swagger
 * /api/auctions/{auctionId}/bid:
 *   post:
 *     summary: Đặt giá mới cho phiên đấu giá (Bid)
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               price:
 *                 type: number
 *     responses:
 *       200: { description: Đấu giá thành công }
 *       400: { description: Bid không hợp lệ }
 *       401: { description: Unauthorized }
 */
router.post("/:auctionId/bid", authenticate, placeBid);

/**
 * @swagger
 * /api/auctions/{auctionId}:
 *   get:
 *     summary: Lấy chi tiết một phiên đấu giá
 *     tags: [Auction]
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Chi tiết phiên }
 *       404: { description: Không tồn tại }
 */
router.get("/:auctionId", getAuctionById);

/**
 * @swagger
 * /api/auctions/{auctionId}/end:
 *   post:
 *     summary: Kết thúc phiên đấu giá (bằng tay, hệ thống tự động sẽ gọi trực tiếp khi đúng giờ)
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Đã đóng phiên đấu giá }
 *       400: { description: Không hợp lệ hoặc đã đóng }
 *       401: { description: Unauthorized }
 */
router.post("/:auctionId/end", authenticate, endAuction);

export default router;
