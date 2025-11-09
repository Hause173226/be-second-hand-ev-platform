import express from "express";
import { membershipController } from "../controllers/membershipController";
import { authenticate } from "../middlewares/authenticate";

const router = express.Router();

// ===== PUBLIC ROUTES (không cần đăng nhập) =====
router.get("/packages", membershipController.getPackages);
router.get("/vnpay-return", membershipController.handleVNPayReturn);

// ===== PROTECTED ROUTES (yêu cầu đăng nhập) =====
router.get("/current", authenticate, membershipController.getCurrentMembership);
router.get(
  "/check-limit",
  authenticate,
  membershipController.checkListingLimit
);
router.get("/history", authenticate, membershipController.getMembershipHistory);
router.post("/purchase", authenticate, membershipController.purchasePackage);
router.post("/renew", authenticate, membershipController.renewMembership);
router.post("/cancel", authenticate, membershipController.cancelMembership);

export default router;
