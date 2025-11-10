import express, { RequestHandler } from "express";
import { authenticate } from "../middlewares/authenticate";
import {
  createAuction,
  placeBid,
  getAuctionById,
  endAuction,
  getOngoingAuctions,
  getUpcomingAuctions,
  getEndedAuctions,
  getAllAuctions,
  getWonAuctionsPendingAppointment,
} from "../controllers/auctionController";

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

/**
 * @swagger
 * /api/auctions/ongoing:
 *   get:
 *     summary: Lấy danh sách phiên đấu giá đang diễn ra
 *     tags: [Auction]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Danh sách phiên đang diễn ra }
 */
router.get("/ongoing", getOngoingAuctions);

/**
 * @swagger
 * /api/auctions/upcoming:
 *   get:
 *     summary: Lấy danh sách phiên đấu giá sắp diễn ra
 *     tags: [Auction]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Danh sách phiên sắp diễn ra }
 */
router.get("/upcoming", getUpcomingAuctions);

/**
 * @swagger
 * /api/auctions/ended:
 *   get:
 *     summary: Lấy danh sách phiên đấu giá đã kết thúc
 *     tags: [Auction]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Danh sách phiên đã kết thúc }
 */
router.get("/ended", getEndedAuctions);

/**
 * @swagger
 * /api/auctions/all:
 *   get:
 *     summary: Lấy tất cả phiên đấu giá (có filter)
 *     tags: [Auction]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ongoing, upcoming, ended] }
 *         description: Filter theo trạng thái logic (ongoing, upcoming, ended)
 *       - in: query
 *         name: listingId
 *         schema: { type: string }
 *     responses:
 *       200: { description: Danh sách tất cả phiên }
 */
router.get("/all", getAllAuctions);

/**
 * @swagger
 * /api/auctions/won/pending-appointment:
 *   get:
 *     summary: Lấy danh sách phiên đấu giá đã thắng, chưa tạo lịch hẹn
 *     tags: [Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Danh sách phiên đấu giá đã thắng, chưa tạo lịch hẹn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                 pagination:
 *                   type: object
 *       401: { description: Chưa đăng nhập }
 */
router.get(
  "/won/pending-appointment",
  authenticate,
  getWonAuctionsPendingAppointment as unknown as RequestHandler
);

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
router.get("/:auctionId", getAuctionById as unknown as RequestHandler);

export default router;
