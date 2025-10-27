import express from "express";
import {
  walletVNPayReturn,
  walletVNPayCallback,
} from "../controllers/paymentController";

const paymentRouter = express.Router();

// Wallet payment routes
paymentRouter.get("/wallet/vnpay-return", walletVNPayReturn);
paymentRouter.get("/wallet/vnpay-ipn", walletVNPayCallback);

export default paymentRouter;
