import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import {
  createAuctionDeposit,
  cancelAuctionDeposit,
  getAuctionDeposits,
  checkDepositStatus,
  deductWinnerDeposit,
  getParticipationFee
} from '../controllers/auctionDepositController';

const router = Router();

/**
 * @swagger
 * /api/auctions/deposit/fee:
 *   get:
 *     summary: Lấy phí cọc tham gia đấu giá (cố định 1 triệu VNĐ)
 *     tags: [Auction Deposits]
 *     responses:
 *       200:
 *         description: Thông tin phí cọc
 */
router.get('/deposit/fee', getParticipationFee);

/**
 * @swagger
 * /api/auctions/{auctionId}/deposit:
 *   post:
 *     summary: Đặt cọc để tham gia đấu giá
 *     tags: [Auction Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của phiên đấu giá
 *     responses:
 *       200:
 *         description: Đặt cọc thành công hoặc yêu cầu nạp tiền
 *       400:
 *         description: Lỗi trong quá trình đặt cọc
 *       401:
 *         description: Chưa đăng nhập
 */
router.post('/:auctionId/deposit', authenticate, createAuctionDeposit);

/**
 * @swagger
 * /api/auctions/{auctionId}/deposit:
 *   delete:
 *     summary: Hủy đặt cọc (trước khi đấu giá bắt đầu)
 *     tags: [Auction Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của phiên đấu giá
 *     responses:
 *       200:
 *         description: Hủy cọc thành công
 *       400:
 *         description: Không thể hủy cọc
 *       401:
 *         description: Chưa đăng nhập
 */
router.delete('/:auctionId/deposit', authenticate, cancelAuctionDeposit);

/**
 * @swagger
 * /api/auctions/{auctionId}/deposits:
 *   get:
 *     summary: Lấy danh sách người đã đặt cọc cho phiên đấu giá
 *     tags: [Auction Deposits]
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của phiên đấu giá
 *     responses:
 *       200:
 *         description: Danh sách người đã đặt cọc
 *       400:
 *         description: Lỗi trong quá trình lấy dữ liệu
 */
router.get('/:auctionId/deposits', getAuctionDeposits);

/**
 * @swagger
 * /api/auctions/{auctionId}/deposit/status:
 *   get:
 *     summary: Kiểm tra trạng thái đặt cọc của user
 *     tags: [Auction Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của phiên đấu giá
 *     responses:
 *       200:
 *         description: Trạng thái đặt cọc
 *       401:
 *         description: Chưa đăng nhập
 */
router.get('/:auctionId/deposit/status', authenticate, checkDepositStatus);

/**
 * @swagger
 * /api/auctions/{auctionId}/deposit/deduct:
 *   post:
 *     summary: Chiết khấu tiền cọc của người thắng (Admin/System)
 *     tags: [Auction Deposits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: auctionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của phiên đấu giá
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - winnerId
 *             properties:
 *               winnerId:
 *                 type: string
 *                 description: ID của người thắng cuộc
 *     responses:
 *       200:
 *         description: Chiết khấu thành công
 *       400:
 *         description: Lỗi trong quá trình chiết khấu
 */
router.post('/:auctionId/deposit/deduct', authenticate, deductWinnerDeposit);

export default router;
