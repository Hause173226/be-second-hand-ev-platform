import express, { RequestHandler } from 'express';
import {
  createDepositRequest,
  sellerConfirmDeposit,
  getBuyerDepositRequests,
  getSellerDepositRequests,
  cancelDepositRequest,
  cancelTransactionInEscrow
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
 *               depositAmount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Đặt cọc thành công hoặc cần nạp tiền
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     message:
 *                       type: string
 *                     depositRequest:
 *                       $ref: "#/components/schemas/DepositRequest"
 *                 - type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     vnpayUrl:
 *                       type: string
 *                     requiredAmount:
 *                       type: number
 *                     currentBalance:
 *                       type: number
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

export default router;
