import express from "express";
import cors from "cors";
import userRoutes from "./routes/userRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check route - Added by HauPTD
app.get("/", (req, res) => {
  res.json({
    message: "Second Hand EV Platform API",
    status: "Server is running!",
    version: "1.0.0",
    developer: "HauPTD",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/users", userRoutes);

// Error handling middleware
app.use(errorHandler);

export default app;
