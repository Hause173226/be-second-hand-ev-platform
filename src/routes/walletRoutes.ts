import express from 'express';
import walletService from '../services/walletService';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

/**
 * @swagger
 * /api/wallet:
 *   get:
 *     summary: Lấy thông tin ví điện tử
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin ví
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: "#/components/schemas/Wallet"
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const wallet = await walletService.getWallet(req.user.id);
    res.json({
      success: true,
      data: wallet
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error.message
    });
  }
});

// Nạp tiền vào ví
// router.post('/deposit', authenticate, async (req, res) => {
//   try {
//     console.log(req.body);
//     const { amount, description } = req.body;
//     console.log(req.user);
//     const wallet = await walletService.deposit(req.user.id, amount, description);
    
//     res.json({
//       success: true,
//       message: 'Nạp tiền thành công',
//       data: wallet
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: 'Lỗi hệ thống',
//       error: error.message
//     });
//   }
// });

// Rút tiền từ ví
router.post('/withdraw', authenticate, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const wallet = await walletService.withdraw(req.user.id, amount, description);
    res.json({
      success: true,
      message: 'Rút tiền thành công',
      data: wallet
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/wallet/vnpay/deposit:
 *   post:
 *     summary: Tạo link nạp tiền vào ví qua VNPay
 *     tags: [Wallet]
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
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 100000
 *               description:
 *                 type: string
 *                 example: "Nạp tiền vào ví"
 *     responses:
 *       200:
 *         description: Link VNPay đã được tạo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 vnpayUrl:
 *                   type: string
 */
// Tạo link nạp tiền qua VNPay
router.post('/vnpay/deposit', authenticate, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const vnpayUrl = await walletService.createDepositUrl(req.user.id, amount, description, req);
    res.json({
      success: true,
      vnpayUrl: vnpayUrl
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error.message
    });
  }
});

export default router;
