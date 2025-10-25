// src/app.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";

import userRoutes from "./routes/userRoutes";
import listingRoutes from "./routes/listingRoutes";
import adminListingRoutes from "./routes/adminListingRoutes";
import searchHistoryRoutes from "./routes/searchHistoryRoutes";
import chatRoutes from "./routes/chatRoutes";
import appointmentRoutes from "./routes/appointmentRoutes";
import offerRoutes from "./routes/offerRoutes";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

// CORS — allowlist tuỳ bạn chỉnh
const allowlist = [
  "http://localhost:5173",
  "http://localhost:5174",
  // "https://fe-bus-ticket-sales-system.vercel.app",
  // "https://admin-bus-ticket-sales-system.vercel.app",
];
app.use(
  cors({
    origin(origin, cb) {
      // cho phép gọi từ tools (postman/swagger) không có Origin
      if (!origin || allowlist.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Static files (nên dùng thư mục runtime ở project root)
const uploadsDir = path.resolve(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsDir));

// Routes
app.use("/api/users", userRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/admin", adminListingRoutes);
app.use("/api/search", searchHistoryRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/offers", offerRoutes);

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));



// Error handler — để CUỐI CÙNG
app.use(errorHandler);

export default app;
// src/app.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";

import userRoutes from "./routes/userRoutes";
import profileRoutes from "./routes/profileRoutes";
import listingRoutes from "./routes/listingRoutes";
import adminListingRoutes from "./routes/adminListingRoutes";
import searchHistoryRoutes from "./routes/searchHistoryRoutes";
import chatRoutes from "./routes/chatRoutes";
import appointmentRoutes from "./routes/appointmentRoutes";
import offerRoutes from "./routes/offerRoutes";

import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();


// 🧩 CORS — hợp nhất từ 2 bản
const allowlist = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:8081",
  "https://fe-bus-ticket-sales-system.vercel.app",
  "https://admin-bus-ticket-sales-system.vercel.app",
];

app.use(
  cors({
    origin(origin, cb) {
      // Cho phép gọi từ Postman / Swagger (không có Origin)
      if (!origin || allowlist.includes(origin)) return cb(null, true);
      console.warn(`❌ Blocked by CORS: ${origin}`);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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


// 📘 Swagger Docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// ❗ Error handler — luôn để cuối
app.use(errorHandler);

export default app;

