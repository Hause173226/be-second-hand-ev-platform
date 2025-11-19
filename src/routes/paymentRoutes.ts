import express from "express";
import {
  walletVNPayReturn,
  walletVNPayCallback,
  depositVNPayReturn,
  remainingAmountVNPayReturn,
  fullPaymentVNPayReturn,
  appointmentDeposit10Callback,
  appointmentFullPaymentCallback,
  appointmentRemaining90Callback,
  appointmentDeposit10Return,
  appointmentFullPaymentReturn,
  appointmentRemaining90Return,
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

// Appointment payment return routes (khi user quay lại từ VNPay)
paymentRouter.get("/appointment-deposit-return", appointmentDeposit10Return);
paymentRouter.get("/appointment-full-payment-return", appointmentFullPaymentReturn);
paymentRouter.get("/appointment-remaining-return", appointmentRemaining90Return);

// Appointment deposit callback routes (VNPay có thể gọi qua GET hoặc POST)
// Lưu ý: Cần phân biệt bằng vnpOrderId format (DEP_appointmentId_, FULL_appointmentId_, REM_appointmentId_)
paymentRouter.get(
  "/appointment-deposit-callback",
  appointmentDeposit10Callback
);
paymentRouter.post(
  "/appointment-deposit-callback",
  appointmentDeposit10Callback
);
paymentRouter.get(
  "/appointment-full-payment-callback",
  appointmentFullPaymentCallback
);
paymentRouter.post(
  "/appointment-full-payment-callback",
  appointmentFullPaymentCallback
);
paymentRouter.get(
  "/appointment-remaining-callback",
  appointmentRemaining90Callback
);
paymentRouter.post(
  "/appointment-remaining-callback",
  appointmentRemaining90Callback
);

export default paymentRouter;
