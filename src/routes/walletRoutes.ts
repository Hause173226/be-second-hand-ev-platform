import express from 'express';
import walletService from '../services/walletService';
import { authenticate } from '../middlewares/authenticate';

const router = express.Router();

// Lấy thông tin ví
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
router.post('/deposit', authenticate, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const wallet = await walletService.deposit(req.user.id, amount, description);
    res.json({
      success: true,
      message: 'Nạp tiền thành công',
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

// Tạo link nạp tiền qua VNPay
router.post('/vnpay/deposit', authenticate, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const vnpayUrl = await walletService.createDepositUrl(req.user.id, amount, description);
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
