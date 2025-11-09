import cron from "node-cron";
import { membershipService } from "../services/membershipService";

/**
 * Cron job để kiểm tra và expire các membership hết hạn
 * Chạy mỗi ngày lúc 00:00
 */
export const startMembershipCron = () => {
  // Chạy mỗi ngày lúc 00:00
  cron.schedule("0 0 * * *", async () => {
    console.log("🔄 [CRON] Running membership expiration check...");
    try {
      const expiredCount = await membershipService.checkExpiredMemberships();
      console.log(`✅ [CRON] Expired ${expiredCount} memberships`);
    } catch (error) {
      console.error("❌ [CRON] Membership expiration error:", error);
    }
  });

  console.log("Membership cron job started");
};
