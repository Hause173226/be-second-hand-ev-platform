import app from "./app";
import { connectDB } from "./config/db";
import { createServer } from "http";
import { WebSocketService } from "./services/websocketService";
import "dotenv/config";
import { seedMembershipPackages } from "./services/membershipSeedService";
import { startMembershipCron } from "./jobs/membershipCron";
import { bootstrapAuctions, startAuctionSweepCron } from "./services/auctionService";

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    const server = createServer(app);

    // Seed membership packages
    try {
      await seedMembershipPackages();
    } catch (error) {
      console.error("❌ Error seeding membership packages:", error);
    }

    // Start membership cron job
    try {
      startMembershipCron();
    } catch (error) {
      console.error("❌ Error starting membership cron:", error);
    }

    // Initialize WebSocket service TRƯỚC
    const wsService = new WebSocketService(server);

    // Bootstrap auctions và start auction sweep cron SAU khi WebSocket đã ready
    try {
      await bootstrapAuctions();
      startAuctionSweepCron();
      console.log("✅ Auction service initialized");
    } catch (error) {
      console.error("❌ Error starting auction service:", error);
    }

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`WebSocket service initialized`);
    });
  })
  .catch((error) => {
    console.error("❌ Failed to connect to database:", error);
    process.exit(1);
  });
