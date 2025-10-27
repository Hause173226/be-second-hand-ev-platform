import express from "express";
import {
  updateDeliveryStatus,
  confirmDelivery,
  getOrderById,
} from "../controllers/orderController";
import { authenticate } from "../middlewares/authenticate";

const router = express.Router();

/**
 * @swagger
 * /api/orders/{orderId}/delivery-status:
 *   put:
 *     summary: Seller cập nhật tình trạng bàn giao
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               delivery_status:
 *                 type: string
 *                 enum: [IN_DELIVERY, INSPECTING, DELIVERED]
 *                 description: Tình trạng bàn giao
 *               notes:
 *                 type: string
 *                 description: Ghi chú (optional)
 *             required:
 *               - delivery_status
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy order
 */
router.put("/:orderId/delivery-status", authenticate, updateDeliveryStatus);

/**
 * @swagger
 * /api/orders/{orderId}/confirm-delivery:
 *   post:
 *     summary: Buyer xác nhận đã nhận hàng và đúng mô tả
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_correct:
 *                 type: boolean
 *                 description: true = đúng mô tả, false = có vấn đề
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Đánh giá (1-5 sao, optional)
 *               comment:
 *                 type: string
 *                 description: Nhận xét (optional)
 *               issues:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Danh sách vấn đề (bắt buộc nếu is_correct = false)
 *             required:
 *               - is_correct
 *     responses:
 *       200:
 *         description: Xác nhận thành công
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       403:
 *         description: Không có quyền
 *       404:
 *         description: Không tìm thấy order
 */
router.post("/:orderId/confirm-delivery", authenticate, confirmDelivery);

/**
 * @swagger
 * /api/orders/{orderId}:
 *   get:
 *     summary: Lấy thông tin order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Thông tin order
 *       404:
 *         description: Không tìm thấy order
 */
router.get("/:orderId", authenticate, getOrderById);

export default router;
