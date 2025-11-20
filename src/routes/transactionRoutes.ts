import express, { RequestHandler } from "express";
import {
  confirmTransaction,
  getPendingTransactions,
  getTransactionDetails,
  getUserTransactionHistory,
  getAdminTransactionHistory,
  getAllTransactions,
  cancelTransaction,
} from "../controllers/transactionController";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/role";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Transaction management endpoints
 */

/**
 * @swagger
 * /api/transactions/confirm:
 *   post:
 *     summary: Nhân viên xác nhận giao dịch hoàn thành
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appointmentId
 *             properties:
 *               appointmentId:
 *                 type: string
 *                 description: ID của lịch hẹn
 *               contractPhotos:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Ảnh hợp đồng đã ký
 *     responses:
 *       200:
 *         description: Xác nhận giao dịch thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 transaction:
 *                   type: object
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền (chỉ staff/admin)
 *       500:
 *         description: Lỗi server
 */
router.post(
  "/confirm",
  authenticate,
  requireRole(["staff", "admin"]),
  confirmTransaction as unknown as RequestHandler
);

/**
 * @swagger
 * /api/transactions/pending:
 *   get:
 *     summary: Lấy danh sách giao dịch cần xác nhận (cho nhân viên)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           default: 10
 *         description: Số lượng mỗi trang
 *     responses:
 *       200:
 *         description: Danh sách giao dịch cần xác nhận
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
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền (chỉ staff/admin)
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/pending",
  authenticate,
  requireRole(["staff", "admin"]),
  getPendingTransactions as unknown as RequestHandler
);

/**
 * @swagger
 * /api/transactions/user/history:
 *   get:
 *     summary: User xem giao dịch của mình
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Trạng thái giao dịch (PENDING, CONFIRMED, COMPLETED, CANCELLED, REJECTED)
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
 *           default: 10
 *         description: Số lượng mỗi trang
 *     responses:
 *       200:
 *         description: Lịch sử giao dịch của user
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
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/user/history",
  authenticate,
  getUserTransactionHistory as unknown as RequestHandler
);

router.get(
  "/user/history/:appointmentId",
  authenticate,
  getTransactionDetails as unknown as RequestHandler
);

/**
 * @swagger
 * /api/transactions/admin/history:
 *   get:
 *     summary: Admin xem tất cả giao dịch trong hệ thống
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, COMPLETED, CANCELLED, REJECTED]
 *         description: Lọc theo trạng thái (tùy chọn)
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
 *         description: Danh sách tất cả giao dịch trong hệ thống
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
  "/admin/history",
  authenticate,
  requireRole(["admin", "staff"]),
  getAdminTransactionHistory as unknown as RequestHandler
);

/**
 * @swagger
 * /api/transactions/all:
 *   get:
 *     summary: Lấy tất cả giao dịch trong hệ thống (không filter, chỉ pagination)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Danh sách tất cả giao dịch trong hệ thống
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
  "/all",
  authenticate,
  requireRole(["admin", "staff"]),
  getAllTransactions as unknown as RequestHandler
);

/**
 * @swagger
 * /api/transactions/{appointmentId}:
 *   get:
 *     summary: Lấy chi tiết giao dịch
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch hẹn
 *     responses:
 *       200:
 *         description: Chi tiết giao dịch
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền xem
 *       404:
 *         description: Không tìm thấy giao dịch
 *       500:
 *         description: Lỗi server
 */
router.get(
  "/:appointmentId",
  authenticate,
  getTransactionDetails as unknown as RequestHandler
);

/**
 * @swagger
 * /api/transactions/{appointmentId}/cancel:
 *   put:
 *     summary: Hủy giao dịch (chỉ nhân viên)
 *     tags: [Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của lịch hẹn
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Lý do hủy giao dịch
 *     responses:
 *       200:
 *         description: Hủy giao dịch thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 transaction:
 *                   type: object
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền (chỉ staff/admin)
 *       404:
 *         description: Không tìm thấy giao dịch
 *       500:
 *         description: Lỗi server
 */
router.put(
  "/:appointmentId/cancel",
  authenticate,
  requireRole(["staff", "admin"]),
  cancelTransaction as unknown as RequestHandler
);

export default router;
