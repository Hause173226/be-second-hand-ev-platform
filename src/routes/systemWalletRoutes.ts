import express from "express";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/role";
import { getSystemWalletInfo } from "../controllers/systemWalletController";

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

export default router;
