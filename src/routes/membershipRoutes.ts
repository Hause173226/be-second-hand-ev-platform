import express from "express";
import { membershipController } from "../controllers/membershipController";
import { authenticate } from "../middlewares/authenticate";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Membership
 *     description: API quản lý gói thành viên và thanh toán
 */

/**
 * @swagger
 * /api/membership/packages:
 *   get:
 *     summary: Lấy danh sách các gói thành viên
 *     description: Lấy tất cả các gói thành viên có sẵn (không cần đăng nhập)
 *     tags: [Membership]
 *     responses:
 *       200:
 *         description: Danh sách gói thành viên
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       price:
 *                         type: number
 *                       duration:
 *                         type: number
 *                       features:
 *                         type: array
 *                         items:
 *                           type: string
 *                       listingLimit:
 *                         type: number
 */
router.get("/packages", membershipController.getPackages);

/**
 * @swagger
 * /api/membership/vnpay-return:
 *   get:
 *     summary: Xử lý callback từ VNPay
 *     description: Endpoint nhận kết quả thanh toán từ VNPay (không cần đăng nhập)
 *     tags: [Membership]
 *     parameters:
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema:
 *           type: string
 *         description: Mã phản hồi từ VNPay
 *       - in: query
 *         name: vnp_TxnRef
 *         schema:
 *           type: string
 *         description: Mã giao dịch
 *       - in: query
 *         name: vnp_Amount
 *         schema:
 *           type: string
 *         description: Số tiền
 *       - in: query
 *         name: vnp_SecureHash
 *         schema:
 *           type: string
 *         description: Mã bảo mật
 *     responses:
 *       200:
 *         description: Xử lý callback thành công
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
 *                   type: object
 *       400:
 *         description: Thanh toán thất bại
 */
router.get("/vnpay-return", membershipController.handleVNPayReturn);

/**
 * @swagger
 * /api/membership/current:
 *   get:
 *     summary: Lấy thông tin gói thành viên hiện tại
 *     description: Lấy thông tin gói thành viên đang sử dụng của người dùng
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin gói thành viên hiện tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     packageName:
 *                       type: string
 *                     startDate:
 *                       type: string
 *                       format: date-time
 *                     endDate:
 *                       type: string
 *                       format: date-time
 *                     listingLimit:
 *                       type: number
 *                     usedListings:
 *                       type: number
 *                     status:
 *                       type: string
 *                       enum: [active, expired, cancelled]
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Không tìm thấy gói thành viên
 */
router.get("/current", authenticate, membershipController.getCurrentMembership);

/**
 * @swagger
 * /api/membership/check-limit:
 *   get:
 *     summary: Kiểm tra giới hạn đăng tin
 *     description: Kiểm tra số lượng tin đăng còn lại của người dùng
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin giới hạn đăng tin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     listingLimit:
 *                       type: number
 *                       description: Giới hạn tổng số tin đăng
 *                     usedListings:
 *                       type: number
 *                       description: Số tin đã đăng
 *                     remainingListings:
 *                       type: number
 *                       description: Số tin còn lại
 *                     canPost:
 *                       type: boolean
 *                       description: Có thể đăng tin mới không
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/check-limit",
  authenticate,
  membershipController.checkListingLimit
);

/**
 * @swagger
 * /api/membership/history:
 *   get:
 *     summary: Lấy lịch sử gói thành viên
 *     description: Lấy lịch sử mua và gia hạn gói thành viên của người dùng
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *         description: Số lượng kết quả trả về
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *         description: Trang hiện tại
 *     responses:
 *       200:
 *         description: Lịch sử gói thành viên
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       packageName:
 *                         type: string
 *                       price:
 *                         type: number
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                       transactionId:
 *                         type: string
 *                 count:
 *                   type: number
 *                 totalPages:
 *                   type: number
 *       401:
 *         description: Unauthorized
 */
router.get("/history", authenticate, membershipController.getMembershipHistory);

/**
 * @swagger
 * /api/membership/purchase:
 *   post:
 *     summary: Mua gói thành viên
 *     description: Khởi tạo giao dịch mua gói thành viên và tạo link thanh toán VNPay
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - packageId
 *             properties:
 *               packageId:
 *                 type: string
 *                 description: ID của gói thành viên cần mua
 *                 example: "64a1b2c3d4e5f6g7h8i9j0k1"
 *               returnUrl:
 *                 type: string
 *                 description: URL để chuyển hướng sau khi thanh toán
 *                 example: "https://example.com/payment-result"
 *     responses:
 *       200:
 *         description: Tạo link thanh toán thành công
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
 *                   type: object
 *                   properties:
 *                     paymentUrl:
 *                       type: string
 *                       description: URL thanh toán VNPay
 *                     transactionId:
 *                       type: string
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc đã có gói đang hoạt động
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Không tìm thấy gói thành viên
 */
router.post("/purchase", authenticate, membershipController.purchasePackage);

/**
 * @swagger
 * /api/membership/renew:
 *   post:
 *     summary: Gia hạn gói thành viên
 *     description: Gia hạn gói thành viên hiện tại
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               duration:
 *                 type: number
 *                 description: Số tháng gia hạn
 *                 example: 1
 *                 default: 1
 *               returnUrl:
 *                 type: string
 *                 description: URL để chuyển hướng sau khi thanh toán
 *     responses:
 *       200:
 *         description: Tạo link thanh toán gia hạn thành công
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
 *                   type: object
 *                   properties:
 *                     paymentUrl:
 *                       type: string
 *                     transactionId:
 *                       type: string
 *       400:
 *         description: Không có gói thành viên để gia hạn
 *       401:
 *         description: Unauthorized
 */
router.post("/renew", authenticate, membershipController.renewMembership);

/**
 * @swagger
 * /api/membership/cancel:
 *   post:
 *     summary: Hủy gói thành viên
 *     description: Hủy gói thành viên hiện tại của người dùng
 *     tags: [Membership]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do hủy gói
 *                 example: "Không còn nhu cầu sử dụng"
 *     responses:
 *       200:
 *         description: Hủy gói thành viên thành công
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
 *                   type: object
 *                   properties:
 *                     cancelledAt:
 *                       type: string
 *                       format: date-time
 *                     refundAmount:
 *                       type: number
 *       400:
 *         description: Không có gói thành viên để hủy
 *       401:
 *         description: Unauthorized
 */
router.post("/cancel", authenticate, membershipController.cancelMembership);

export default router;
