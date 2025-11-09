import express from "express";
import walletService from "../services/walletService";
import { authenticateJWT } from "../middlewares/authenticate";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Wallet
 *   description: Wallet management endpoints
 */

/**
 * @swagger
 * /api/wallet:
 *   get:
 *     summary: Lấy thông tin ví
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin ví
 *       401:
 *         description: Chưa đăng nhập
 */
router.get("/", authenticateJWT, async (req, res) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?._id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
      return;
    }

    const wallet = await walletService.getWallet(userId.toString());

    // ✅ Tính tổng tiền đang trong escrow (ACTIVE) của user
    const EscrowAccount = (await import('../models/EscrowAccount')).default;
    const activeEscrows = await EscrowAccount.find({
      buyerId: userId.toString(),
      status: 'ACTIVE'
    });
    
    const escrowAmount = activeEscrows.reduce((sum, escrow) => sum + escrow.amount, 0);

    res.json({
      success: true,
      data: {
        ...wallet.toObject(),
        escrowAmount: escrowAmount, // ✅ Tổng tiền đang trong escrow
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/wallet/deposit/vnpay:
 *   post:
 *     summary: Tạo link nạp tiền qua VNPay
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
 *                 description: Số tiền cần nạp (VND)
 *                 example: 50000
 *               description:
 *                 type: string
 *                 description: Mô tả giao dịch
 *                 example: "Nạp tiền vào ví"
 *     responses:
 *       200:
 *         description: Tạo link thanh toán thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 paymentUrl:
 *                   type: string
 *                   example: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?..."
 *                 message:
 *                   type: string
 *                   example: "Tạo link thanh toán thành công"
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.post("/deposit/vnpay", authenticateJWT, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?._id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
      return;
    }

    // Validate amount
    if (!amount || amount <= 0) {
      res.status(400).json({
        success: false,
        message: "Số tiền không hợp lệ",
      });
      return;
    }

    // Số tiền tối thiểu 10,000 VND
    if (amount < 10000) {
      res.status(400).json({
        success: false,
        message: "Số tiền nạp tối thiểu là 10,000 VND",
      });
      return;
    }

    // Tạo payment URL
    const vnpayUrl = await walletService.createDepositUrl(
      userId.toString(),
      amount,
      description || "Nạp tiền vào ví",
      req
    );

    res.json({
      success: true,
      paymentUrl: vnpayUrl,
      message: "Tạo link thanh toán thành công",
    });
  } catch (error: any) {
    console.error("Create VNPay URL error:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi tạo link thanh toán",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/wallet/deposit/manual:
 *   post:
 *     summary: Nạp tiền thủ công (Admin only)
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
 *               - userId
 *               - amount
 *             properties:
 *               userId:
 *                 type: string
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Nạp tiền thành công
 */
router.post("/deposit/manual", authenticateJWT, async (req, res) => {
  try {
    const { userId, amount, description } = req.body;

    // TODO: Check if user is admin
    // if ((req as any).user?.role !== 'admin') {
    //   return res.status(403).json({ success: false, message: "Chỉ admin mới có quyền" });
    // }

    const wallet = await walletService.deposit(
      userId,
      amount,
      description || "Admin nạp tiền thủ công"
    );

    res.json({
      success: true,
      message: "Nạp tiền thành công",
      data: wallet,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/wallet/withdraw:
 *   post:
 *     summary: Rút tiền từ ví
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
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rút tiền thành công
 */
router.post("/withdraw", authenticateJWT, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const userId = (req as any).user?.userId || (req as any).user?._id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
      return;
    }

    if (!amount || amount <= 0) {
      res.status(400).json({
        success: false,
        message: "Số tiền không hợp lệ",
      });
      return;
    }

    const wallet = await walletService.withdraw(
      userId.toString(),
      amount,
      description || "Rút tiền từ ví"
    );

    res.json({
      success: true,
      message: "Rút tiền thành công",
      data: wallet,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi hệ thống",
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /api/wallet/transactions:
 *   get:
 *     summary: Lấy lịch sử giao dịch
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Số bản ghi mỗi trang
 *     responses:
 *       200:
 *         description: Danh sách giao dịch
 */
router.get("/transactions", authenticateJWT, async (req, res) => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?._id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Chưa đăng nhập",
      });
      return;
    }

    // TODO: Implement transaction history
    res.json({
      success: true,
      data: [],
      message: "Tính năng đang phát triển",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Lỗi hệ thống",
      error: error.message,
    });
  }
});

export default router;
