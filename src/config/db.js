import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    // Sửa tên biến môi trường cho khớp với .env
    if (!process.env.MONGODB_URI) {
      throw new Error("Missing MONGODB_URI in environment variables");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected successfully");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB error:", err);
});
