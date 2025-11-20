import express, { RequestHandler } from "express";
import {
  addPaymentRecord,
  createDeal,
  getAdminDeals,
  getDealById,
  getUserDeals,
  updateDealStatus,
  updatePaperworkStep,
} from "../controllers/dealController";
import { authenticate } from "../middlewares/authenticate";
import { requireRole } from "../middlewares/role";

const router = express.Router();

router.post(
  "/",
  authenticate,
  requireRole(["staff", "admin"]),
  createDeal as unknown as RequestHandler
);

router.get(
  "/user",
  authenticate,
  getUserDeals as unknown as RequestHandler
);

router.get(
  "/admin",
  authenticate,
  requireRole(["staff", "admin"]),
  getAdminDeals as unknown as RequestHandler
);

router.get(
  "/:dealId",
  authenticate,
  getDealById as unknown as RequestHandler
);

router.post(
  "/:dealId/payments",
  authenticate,
  requireRole(["staff", "admin"]),
  addPaymentRecord as unknown as RequestHandler
);

router.patch(
  "/:dealId/paperwork/:step",
  authenticate,
  requireRole(["staff", "admin"]),
  updatePaperworkStep as unknown as RequestHandler
);

router.patch(
  "/:dealId/status",
  authenticate,
  requireRole(["staff", "admin"]),
  updateDealStatus as unknown as RequestHandler
);

export default router;

