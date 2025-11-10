import express from "express";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/role";
import {
  getSystemWalletInfo,
  getSystemWalletTransactions,
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
router.get("/", authenticate, requireRole(["admin", "staff"]), getSystemWalletInfo);

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

export default router;
