// src/app.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";

import userRoutes from "./routes/userRoutes";
import orderRoutes from "./routes/orderRoutes"; // Thêm dòng này
import profileRoutes from "./routes/profileRoutes";
import listingRoutes from "./routes/listingRoutes";
import adminListingRoutes from "./routes/adminListingRoutes";
import searchHistoryRoutes from "./routes/searchHistoryRoutes";
import chatRoutes from "./routes/chatRoutes";
import appointmentRoutes from "./routes/appointmentRoutes";
import offerRoutes from "./routes/offerRoutes";
import depositRoutes from "./routes/depositRoutes";
import contractRoutes from "./routes/contractRoutes";
import dealRoutes from "./routes/dealRoutes";
import transactionRoutes from "./routes/transactionRoutes";
import walletRoutes from "./routes/walletRoutes";
import paymentRoutes from "./routes/paymentRoutes";
import notificationDepositRoutes from "./routes/notificationDepositRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import auctionRoutes from "./routes/auctionRoutes";
import auctionDepositRoutes from "./routes/auctionDepositRoutes";
import membershipRoutes from "./routes/membershipRoutes";
import ekycRoutes from "./routes/ekycRoutes";
import systemWalletRoutes from "./routes/systemWalletRoutes";

import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://fe-bus-ticket-sales-system.vercel.app",
      "https://admin-bus-ticket-sales-system.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 🧠 Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 📁 Static files (ảnh upload, v.v.)
const uploadsDir = path.resolve(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsDir));

// 🚏 Routes — gộp tất cả routes của 2 bản
app.use("/api/users", userRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/admin", adminListingRoutes);
app.use("/api/search", searchHistoryRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/deposits", depositRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/deals", dealRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/notifications", notificationDepositRoutes);
app.use("/api/notification-messages", notificationRoutes);
app.use("/api/auctions", auctionRoutes);
app.use("/api/memberships", membershipRoutes);
app.use("/api/auctions", auctionDepositRoutes);
app.use("/api/ekyc", ekycRoutes);
app.use("/api/system-wallet", systemWalletRoutes);

// 📘 Swagger Docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ❗ Error handler — luôn để cuối
app.use(errorHandler);

export default app;
