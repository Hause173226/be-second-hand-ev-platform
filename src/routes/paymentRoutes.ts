import express from "express";
import {
  walletVNPayReturn,
  walletVNPayCallback,
  depositVNPayReturn,
  remainingAmountVNPayReturn,
  fullPaymentVNPayReturn,
} from "../controllers/paymentController";

const paymentRouter = express.Router();

// Wallet payment routes
paymentRouter.get("/wallet/vnpay-return", walletVNPayReturn);
paymentRouter.get("/wallet/vnpay-ipn", walletVNPayCallback);

// Deposit payment routes (đặt cọc - nạp vào ví người dùng)
paymentRouter.get("/deposit/vnpay-return", depositVNPayReturn);

// Remaining amount payment routes (số tiền còn lại - chuyển vào ví hệ thống)
paymentRouter.get("/remaining/vnpay-return", remainingAmountVNPayReturn);

// Full payment routes (mua full - chuyển vào ví hệ thống)
paymentRouter.get("/full/vnpay-return", fullPaymentVNPayReturn);

export default paymentRouter;
