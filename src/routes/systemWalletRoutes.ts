import express from "express";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/role";
import {
  getSystemWalletInfo,
  getSystemWalletTransactions,
  getSystemWalletTransactionDetail,
  getSystemWalletChartData,
  getTotalRevenueChartData,
} from "../controllers/systemWalletController";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: SystemWallet
 *   description: Quản lý ví hệ thống (admin/staff)
 */

/**
 * @swagger
 * /api/system-wallet:
 *   get:
 *     summary: Admin/staff xem thông tin ví hệ thống
 *     tags: [SystemWallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin ví hệ thống hiện tại
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "6789abcdef"
 *                     balance:
 *                       type: number
 *                       example: 120000000
 *                     totalEarned:
 *                       type: number
 *                       example: 350000000
 *                     totalTransactions:
 *                       type: number
 *                       example: 42
 *                     lastTransactionAt:
 *                       type: string
 *                       format: date-time
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền (chỉ admin/staff)
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/",
  authenticate,
  requireRole(["admin", "staff"]),
  getSystemWalletInfo
);

/**
 * @swagger
 * /api/system-wallet/transactions:
 *   get:
 *     summary: Admin/staff xem lịch sử giao dịch ví hệ thống
 *     tags: [SystemWallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [COMPLETED, CANCELLED]
 *         description: Lọc theo loại giao dịch (COMPLETED = +100%, CANCELLED = +20% phí hủy). Không truyền = xem tất cả
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Số lượng mỗi trang
 *     responses:
 *       200:
 *         description: Lịch sử giao dịch ví hệ thống
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
 *                       type:
 *                         type: string
 *                         enum: [COMPLETED, CANCELLED]
 *                       amount:
 *                         type: number
 *                       depositRequestId:
 *                         type: string
 *                       appointmentId:
 *                         type: string
 *                       description:
 *                         type: string
 *                       balanceAfter:
 *                         type: number
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền (chỉ admin/staff)
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/transactions",
  authenticate,
  requireRole(["admin", "staff"]),
  getSystemWalletTransactions
);

/**
 * @swagger
 * /api/system-wallet/transactions/{id}:
 *   get:
 *     summary: Admin/staff xem chi tiết một giao dịch ví hệ thống
 *     tags: [SystemWallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của giao dịch
 *     responses:
 *       200:
 *         description: Chi tiết giao dịch ví hệ thống
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
 *                     id:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [COMPLETED, CANCELLED]
 *                     amount:
 *                       type: number
 *                     description:
 *                       type: string
 *                     balanceAfter:
 *                       type: number
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                     appointment:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         appointmentType:
 *                           type: string
 *                         buyerId:
 *                           type: string
 *                         sellerId:
 *                           type: string
 *                         buyer:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             id:
 *                               type: string
 *                             fullName:
 *                               type: string
 *                             email:
 *                               type: string
 *                             phone:
 *                               type: string
 *                             avatar:
 *                               type: string
 *                         seller:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             id:
 *                               type: string
 *                             fullName:
 *                               type: string
 *                             email:
 *                               type: string
 *                             phone:
 *                               type: string
 *                             avatar:
 *                               type: string
 *                         scheduledDate:
 *                           type: string
 *                           format: date-time
 *                         status:
 *                           type: string
 *                         type:
 *                           type: string
 *                         location:
 *                           type: string
 *                         notes:
 *                           type: string
 *                         completedAt:
 *                           type: string
 *                           format: date-time
 *                         cancelledAt:
 *                           type: string
 *                           format: date-time
 *                     depositRequest:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         listingId:
 *                           type: string
 *                         buyerId:
 *                           type: string
 *                         sellerId:
 *                           type: string
 *                         depositAmount:
 *                           type: number
 *                         status:
 *                           type: string
 *                         listing:
 *                           type: object
 *                           nullable: true
 *                           properties:
 *                             id:
 *                               type: string
 *                             title:
 *                               type: string
 *                             price:
 *                               type: number
 *                             images:
 *                               type: array
 *                               items:
 *                                 type: object
 *                             make:
 *                               type: string
 *                             model:
 *                               type: string
 *                             year:
 *                               type: number
 *                             condition:
 *                               type: string
 *                             type:
 *                               type: string
 *                         buyer:
 *                           type: object
 *                           nullable: true
 *                         seller:
 *                           type: object
 *                           nullable: true
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền (chỉ admin/staff)
 *       404:
 *         description: Giao dịch không tồn tại
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/transactions/:id",
  authenticate,
  requireRole(["admin", "staff"]),
  getSystemWalletTransactionDetail
);

/**
 * @swagger
 * /api/system-wallet/chart:
 *   get:
 *     summary: Admin/staff xem dữ liệu chart giao dịch ví hệ thống
 *     tags: [SystemWallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, month, year]
 *           default: day
 *         description: Chu kỳ thống kê (day = theo ngày, month = theo tháng, year = theo năm)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày bắt đầu (ISO 8601). Nếu không có, mặc định lấy 30 ngày gần nhất
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày kết thúc (ISO 8601). Nếu không có, mặc định là hôm nay
 *     responses:
 *       200:
 *         description: Dữ liệu chart giao dịch ví hệ thống
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
 *                     labels:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Danh sách các nhãn thời gian (ngày/tháng/năm)
 *                     datasets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           label:
 *                             type: string
 *                           data:
 *                             type: array
 *                             items:
 *                               type: number
 *                           backgroundColor:
 *                             type: string
 *                           borderColor:
 *                             type: string
 *                           borderWidth:
 *                             type: number
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalRevenue:
 *                           type: number
 *                           description: Tổng doanh thu (COMPLETED)
 *                         totalFees:
 *                           type: number
 *                           description: Tổng phí hủy (CANCELLED)
 *                         totalTransactions:
 *                           type: number
 *                           description: Tổng số giao dịch
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền (chỉ admin/staff)
 *       400:
 *         description: Tham số không hợp lệ
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/chart",
  authenticate,
  requireRole(["admin", "staff"]),
  getSystemWalletChartData
);

/**
 * @swagger
 * /api/system-wallet/revenue-chart:
 *   get:
 *     summary: Admin/staff xem dữ liệu chart doanh thu tổng hợp (giao dịch + membership)
 *     tags: [SystemWallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, month, year]
 *           default: day
 *         description: Chu kỳ thống kê (day = theo ngày, month = theo tháng, year = theo năm)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày bắt đầu (ISO 8601). Nếu không có, mặc định lấy 30 ngày gần nhất
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Ngày kết thúc (ISO 8601). Nếu không có, mặc định là hôm nay
 *     responses:
 *       200:
 *         description: Dữ liệu chart doanh thu tổng hợp
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
 *                     labels:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Danh sách các nhãn thời gian (ngày/tháng/năm)
 *                     datasets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           label:
 *                             type: string
 *                           data:
 *                             type: array
 *                             items:
 *                               type: number
 *                           backgroundColor:
 *                             type: string
 *                           borderColor:
 *                             type: string
 *                           borderWidth:
 *                             type: number
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalTransactionRevenue:
 *                           type: number
 *                           description: Tổng doanh thu từ giao dịch mua bán xe
 *                         totalMembershipRevenue:
 *                           type: number
 *                           description: Tổng doanh thu từ membership
 *                         totalRevenue:
 *                           type: number
 *                           description: Tổng doanh thu (giao dịch + membership)
 *                         totalTransactions:
 *                           type: number
 *                           description: Tổng số giao dịch
 *                         totalMemberships:
 *                           type: number
 *                           description: Tổng số membership đã bán
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền (chỉ admin/staff)
 *       400:
 *         description: Tham số không hợp lệ
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/revenue-chart",
  authenticate,
  requireRole(["admin", "staff"]),
  getTotalRevenueChartData
);

export default router;
