import express from "express";
import {
  createVNPayPayment,
  vnpayReturn,
  vnpayCallback,
  paymentSuccess,
} from "../controllers/paymentController";
import { authenticate } from "../middlewares/authenticate";

const paymentRouter = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment management endpoints
 */

/**
 * @swagger
 * /api/payment/vnpay:
 *   post:
 *     summary: Tạo thanh toán nạp tiền ví qua VNPay
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - description
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Số tiền cần nạp
 *               description:
 *                 type: string
 *                 description: Mô tả giao dịch
 *     responses:
 *       200:
 *         description: URL thanh toán VNPay được tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 payUrl:
 *                   type: string
 *                   description: URL để redirect đến trang thanh toán VNPay
 *                 message:
 *                   type: string
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
paymentRouter.post("/vnpay", authenticate, createVNPayPayment);

/**
 * @swagger
 * /api/payment/vnpay-return:
 *   get:
 *     summary: Xử lý kết quả thanh toán từ VNPay (Client Return URL)
 *     tags: [Payments]
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
 *         description: Mã đơn hàng
 *     responses:
 *       302:
 *         description: Redirect về trang kết quả thanh toán
 */
paymentRouter.get("/vnpay-return", vnpayReturn);

/**
 * @swagger
 * /api/payment/vnpay-ipn:
 *   get:
 *     summary: Xử lý thông báo thanh toán tức thì từ VNPay (IPN URL)
 *     tags: [Payments]
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
 *         description: Mã đơn hàng
 *     responses:
 *       200:
 *         description: Phản hồi cho VNPay
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 RspCode:
 *                   type: string
 *                   description: Mã phản hồi
 *                 Message:
 *                   type: string
 *                   description: Thông báo
 */
paymentRouter.get("/vnpay-ipn", vnpayCallback);

/**
 * @swagger
 * /api/payment/success:
 *   get:
 *     summary: Xử lý thanh toán thành công
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: orderId
 *         schema:
 *           type: string
 *         description: Mã đơn hàng
 *       - in: query
 *         name: amount
 *         schema:
 *           type: number
 *         description: Số tiền thanh toán
 *     responses:
 *       200:
 *         description: Thanh toán thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 orderId:
 *                   type: string
 *                 amount:
 *                   type: number
 *       500:
 *         description: Lỗi server
 */
paymentRouter.get("/success", paymentSuccess);

export default paymentRouter;
