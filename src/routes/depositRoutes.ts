import express, { RequestHandler } from 'express';
import {
  createDepositRequest,
  sellerConfirmDeposit,
  getBuyerDepositRequests,
  getSellerDepositRequests,
  cancelDepositRequest,
  cancelTransactionInEscrow,
  generateRemainingAmountQrCode,
  generateFullPaymentQrCode
} from '../controllers/depositController';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

/**
 * @swagger
 * /api/deposits:
 *   post:
 *     summary: Tạo yêu cầu đặt cọc
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - listingId
 *               - depositAmount
 *             properties:
 *               listingId:
 *                 type: string
 *                 description: ID của listing (xe)
 *               depositAmount:
 *                 type: number
 *                 description: Số tiền đặt cọc
 *     responses:
 *       200:
 *         description: Đặt cọc thành công hoặc cần nạp tiền
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 # Trường hợp đủ tiền - trả về QR code
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: true
 *                     message:
 *                       type: string
 *                       example: "Vui lòng quét mã QR để thanh toán đặt cọc"
 *                     qrCode:
 *                       type: string
 *                       description: Data URL của QR code (base64 image)
 *                       example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *                     paymentUrl:
 *                       type: string
 *                       description: URL thanh toán VNPay
 *                     orderId:
 *                       type: string
 *                       description: Mã đơn hàng
 *                     depositRequestId:
 *                       type: string
 *                       description: ID của deposit request
 *                     depositAmount:
 *                       type: number
 *                       description: Số tiền đặt cọc
 *                     action:
 *                       type: string
 *                       example: "PAY_DEPOSIT"
 *                 # Trường hợp không đủ tiền - trả về URL nạp tiền
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: false
 *                     message:
 *                       type: string
 *                       example: "Số dư không đủ để đặt cọc"
 *                     vnpayUrl:
 *                       type: string
 *                       description: URL VNPay để nạp tiền vào ví
 *                     requiredAmount:
 *                       type: number
 *                       description: Tổng tiền đặt cọc cần
 *                     currentBalance:
 *                       type: number
 *                       description: Số dư hiện tại trong ví
 *                     missingAmount:
 *                       type: number
 *                       description: Số tiền còn thiếu cần nạp
 */
// Tạo yêu cầu đặt cọc
router.post('/', authenticate, createDepositRequest as unknown as RequestHandler);

/**
 * @swagger
 * /api/deposits/{depositRequestId}/confirm:
 *   post:
 *     summary: Người bán xác nhận hoặc từ chối đặt cọc
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: depositRequestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [CONFIRM, REJECT]
 *     responses:
 *       200:
 *         description: Xác nhận/ từ chối thành công
 */
router.post('/:depositRequestId/confirm', authenticate, sellerConfirmDeposit as unknown as RequestHandler);

/**
 * @swagger
 * /api/deposits/buyer:
 *   get:
 *     summary: Lấy danh sách yêu cầu đặt cọc của người mua
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách yêu cầu đặt cọc
 */
router.get('/buyer', authenticate, getBuyerDepositRequests as unknown as RequestHandler);

/**
 * @swagger
 * /api/deposits/seller:
 *   get:
 *     summary: Lấy danh sách yêu cầu đặt cọc của người bán
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách yêu cầu đặt cọc
 */
router.get('/seller', authenticate, getSellerDepositRequests as unknown as RequestHandler);

/**
 * @swagger
 * /api/deposits/{depositRequestId}:
 *   delete:
 *     summary: Hủy yêu cầu đặt cọc
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: depositRequestId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Hủy đặt cọc thành công
 */
router.delete('/:depositRequestId', authenticate, cancelDepositRequest as unknown as RequestHandler);

/**
 * @swagger
 * /api/deposits/{depositRequestId}/cancel-transaction:
 *   post:
 *     summary: Hủy giao dịch khi tiền đã vào escrow (Buyer)
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: depositRequestId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Hủy giao dịch thành công, tiền đã hoàn về ví
 */
router.post('/:depositRequestId/cancel-transaction', authenticate, cancelTransactionInEscrow as unknown as RequestHandler);

/**
 * @swagger
 * /api/deposits/generate-remaining-qr:
 *   post:
 *     summary: Tạo QR code thanh toán số tiền còn lại (sau khi đã đặt cọc)
 *     description: Sau khi đã đặt cọc và seller xác nhận, khách hàng có thể thanh toán số tiền còn lại bằng QR code này
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - listingId
 *               - depositRequestId
 *             properties:
 *               listingId:
 *                 type: string
 *                 description: ID của listing (xe)
 *               depositRequestId:
 *                 type: string
 *                 description: ID của deposit request đã được seller xác nhận
 *     responses:
 *       200:
 *         description: Tạo QR code thành công
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
 *                   example: "Tạo QR code thanh toán số tiền còn lại thành công"
 *                 qrCode:
 *                   type: string
 *                   description: Data URL của QR code (base64 image)
 *                   example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *                 paymentUrl:
 *                   type: string
 *                   description: URL thanh toán VNPay
 *                 orderId:
 *                   type: string
 *                   description: Mã đơn hàng
 *                 remainingAmount:
 *                   type: number
 *                   description: Số tiền còn lại cần thanh toán
 *                 depositAmount:
 *                   type: number
 *                   description: Số tiền đã đặt cọc
 *                 totalAmount:
 *                   type: number
 *                   description: Tổng giá trị xe
 *       400:
 *         description: Lỗi validation hoặc số tiền còn lại không hợp lệ
 *       404:
 *         description: Không tìm thấy listing hoặc deposit request
 */
router.post('/generate-remaining-qr', authenticate, generateRemainingAmountQrCode as unknown as RequestHandler);

/**
 * @swagger
 * /api/deposits/generate-full-qr:
 *   post:
 *     summary: Tạo QR code thanh toán toàn bộ (mua full không đặt cọc)
 *     description: Khi khách hàng muốn mua xe ngay mà không cần đặt cọc, sử dụng endpoint này để tạo QR code thanh toán toàn bộ
 *     tags: [Deposits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - listingId
 *             properties:
 *               listingId:
 *                 type: string
 *                 description: ID của listing (xe)
 *     responses:
 *       200:
 *         description: Tạo QR code thành công
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
 *                   example: "Tạo QR code thanh toán toàn bộ thành công"
 *                 qrCode:
 *                   type: string
 *                   description: Data URL của QR code (base64 image)
 *                   example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *                 paymentUrl:
 *                   type: string
 *                   description: URL thanh toán VNPay
 *                 orderId:
 *                   type: string
 *                   description: Mã đơn hàng
 *                 fullAmount:
 *                   type: number
 *                   description: Tổng giá trị xe (số tiền cần thanh toán)
 *       400:
 *         description: Lỗi validation, xe không còn bán, hoặc không thể mua xe của chính mình
 *       404:
 *         description: Không tìm thấy listing
 */
router.post('/generate-full-qr', authenticate, generateFullPaymentQrCode as unknown as RequestHandler);

export default router;
