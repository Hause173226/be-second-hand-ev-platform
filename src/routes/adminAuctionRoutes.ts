import express, { RequestHandler } from "express";
import { authenticate } from "../middlewares/authenticate";
import {
  approveAuction,
  rejectAuction,
} from "../controllers/auctionApprovalController";
import { cleanupExpiredPendingAuctions } from "../controllers/auctionCleanupController";
import { 
  getAllAuctionsForAdmin, 
  getAuctionDetailForAdmin,
  updateSystemParticipantsConfig,
  startAuctionManually
} from "../controllers/adminAuctionController";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin Auction
 *     description: Quản lý phiên đấu giá cho Admin/Staff
 */

/**
 * @swagger
 * /api/auctions/admin:
 *   get:
 *     summary: "[ADMIN] Lấy tất cả phiên đấu giá với filter"
 *     description: |
 *       Admin/Staff xem tất cả phiên đấu giá với filters và thông tin chi tiết:
 *       - Số người đã đăng ký tham gia (deposit)
 *       - Danh sách participants (nếu đã approved)
 *       - Số lượt bid, giá cao nhất
 *       - Có đủ người để bắt đầu không
 *     tags: [Admin Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [pending, approved, upcoming, ongoing, ended, rejected]
 *         description: |
 *           Filter theo trạng thái:
 *           - pending: Đang chờ duyệt
 *           - approved: Đã duyệt, chưa bắt đầu
 *           - upcoming: Sắp diễn ra (trong 24h)
 *           - ongoing: Đang diễn ra
 *           - ended: Đã kết thúc
 *           - rejected: Bị từ chối
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
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
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       listingId:
 *                         type: object
 *                       status:
 *                         type: string
 *                         description: Status lưu trong database
 *                       approvalStatus:
 *                         type: string
 *                         description: Trạng thái duyệt (pending/approved/rejected)
 *                       displayStatus:
 *                         type: string
 *                         description: |
 *                           Status hiển thị dựa trên thời gian thực tế:
 *                           - pending: Chưa được duyệt
 *                           - upcoming: Đã duyệt, chưa tới giờ bắt đầu
 *                           - ongoing: Đang diễn ra (đã tới giờ, chưa hết giờ)
 *                           - ended: Đã kết thúc
 *                           - cancelled: Đã bị hủy
 *                           - rejected: Bị từ chối
 *                         example: upcoming
 *                       minParticipants:
 *                         type: number
 *                       maxParticipants:
 *                         type: number
 *                       depositCount:
 *                         type: number
 *                         description: Số người đã đặt cọc
 *                       participants:
 *                         type: array
 *                         description: Danh sách người tham gia (chỉ có khi approved)
 *                       currentBidCount:
 *                         type: number
 *                       highestBid:
 *                         type: number
 *                       canStart:
 *                         type: boolean
 *                         description: Có đủ người để bắt đầu không
 *                 pagination:
 *                   type: object
 *       403:
 *         description: Không có quyền
 */
router.get("/", authenticate, getAllAuctionsForAdmin as unknown as RequestHandler);

/**
 * @swagger
 * /api/auctions/admin/{auctionId}:
 *   get:
 *     summary: "[ADMIN] Xem chi tiết phiên đấu giá"
 *     description: |
 *       Admin/Staff xem chi tiết đầy đủ của phiên đấu giá:
 *       - Thông tin seller
 *       - Danh sách tất cả người đã deposit (kể cả đã refund)
 *       - Thông tin bids
 *       - Trạng thái approval
 *     tags: [Admin Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết phiên đấu giá
 *       404:
 *         description: Không tìm thấy
 *       403:
 *         description: Không có quyền
 */
router.get("/:auctionId", authenticate, getAuctionDetailForAdmin as unknown as RequestHandler);

/**
 * @swagger
 * /api/auctions/admin/{auctionId}/approve:
 *   post:
 *     summary: "[STAFF] Phê duyệt phiên đấu giá"
 *     description: |
 *       Staff/Admin phê duyệt phiên đấu giá. Khi approve:
 *       - Gửi thông báo cho người bán
 *       - Broadcast thông báo đến tất cả buyers
 *       - Phiên sẽ được hiển thị công khai
 *     tags: [Admin Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema: 
 *           type: string
 *         description: ID của phiên đấu giá cần duyệt
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               minParticipants:
 *                 type: number
 *                 description: Số người tham gia tối thiểu (mặc định 1)
 *                 example: 3
 *               maxParticipants:
 *                 type: number
 *                 description: Số người tham gia tối đa (mặc định 100)
 *                 example: 50
 *     responses:
 *       200:
 *         description: Phê duyệt thành công
 *       400:
 *         description: Phiên đã được duyệt hoặc đã bị từ chối
 *       403:
 *         description: Không có quyền (chỉ staff/admin)
 *       404:
 *         description: Không tìm thấy phiên đấu giá
 */
router.post("/:auctionId/approve", authenticate, approveAuction as unknown as RequestHandler);

/**
 * @swagger
 * /api/auctions/admin/{auctionId}/reject:
 *   post:
 *     summary: "[STAFF] Từ chối phiên đấu giá"
 *     description: |
 *       Staff/Admin từ chối phiên đấu giá. Khi reject:
 *       - Gửi thông báo cho người bán kèm lý do
 *       - Phiên sẽ bị hủy, không hiển thị công khai
 *     tags: [Admin Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema: 
 *           type: string
 *         description: ID của phiên đấu giá cần từ chối
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do từ chối (bắt buộc)
 *                 example: "Thông tin sản phẩm chưa đầy đủ, vui lòng bổ sung giấy tờ xe"
 *     responses:
 *       200:
 *         description: Từ chối thành công
 *       400:
 *         description: Thiếu lý do hoặc phiên đã được xử lý
 *       403:
 *         description: Không có quyền (chỉ staff/admin)
 *       404:
 *         description: Không tìm thấy phiên đấu giá
 */
router.post("/:auctionId/reject", authenticate, rejectAuction as unknown as RequestHandler);

/**
 * @swagger
 * /api/auctions/admin/{auctionId}/start:
 *   post:
 *     summary: "[STAFF] Bắt đầu phiên đấu giá thủ công"
 *     description: |
 *       Staff/Admin bắt đầu phiên đấu giá ngay lập tức khi đủ người tham gia.
 *       Yêu cầu:
 *       - Phiên đã được approve
 *       - Đủ số lượng người tham gia tối thiểu
 *       - Chưa quá thời gian kết thúc
 *       
 *       Khi start:
 *       - Cập nhật status thành 'active'
 *       - Cập nhật startAt thành thời gian hiện tại
 *       - Gửi thông báo cho tất cả participants
 *       - Broadcast WebSocket event
 *     tags: [Admin Auction]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema: 
 *           type: string
 *         description: ID của phiên đấu giá cần bắt đầu
 *     responses:
 *       200:
 *         description: Bắt đầu phiên đấu giá thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Phiên đấu giá đã được bắt đầu thành công"
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: active
 *                     startAt:
 *                       type: string
 *                       format: date-time
 *                     endAt:
 *                       type: string
 *                       format: date-time
 *                     participantCount:
 *                       type: number
 *       400:
 *         description: |
 *           Lỗi validation:
 *           - Chưa được phê duyệt
 *           - Đã đang diễn ra
 *           - Không đủ người tham gia
 *           - Đã quá thời gian
 *       403:
 *         description: Không có quyền (chỉ staff/admin)
 *       404:
 *         description: Không tìm thấy phiên đấu giá
 */
router.post("/:auctionId/start", authenticate, startAuctionManually as unknown as RequestHandler);

/**
 * @swagger
 * /api/auctions/admin/cleanup-expired:
 *   post:
 *     summary: "[ADMIN] Test cleanup - Hủy các phiên pending đã quá hạn"
 *     description: "API test để trigger cleanup thủ công (thay vì chờ cron)"
 *     tags: [Admin Auction]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cleanup thành công
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
 */
router.post("/cleanup-expired", authenticate, cleanupExpiredPendingAuctions as unknown as RequestHandler);

/**
 * @swagger
 * /api/auctions/admin/config/participants:
 *   patch:
 *     summary: "[ADMIN] Cập nhật cấu hình min/max participants mặc định"
 *     description: |
 *       Chỉ admin mới có quyền cập nhật cấu hình hệ thống.
 *       Giá trị khuyến nghị: min=5, max=30
 *     tags: [Admin Auction]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               minParticipants:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 30
 *                 example: 5
 *               maxParticipants:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100
 *                 example: 30
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Validation error
 *       403:
 *         description: Chỉ admin mới có quyền
 */
router.patch("/config/participants", authenticate, updateSystemParticipantsConfig as unknown as RequestHandler);

export default router;
