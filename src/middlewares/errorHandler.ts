// src/middlewares/errorHandler.ts
import type { ErrorRequestHandler } from "express";
import { AppError } from "../utils/errorHandler";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Nếu response đã được gửi rồi thì chỉ log lại, KHÔNG gửi thêm response
  if (res.headersSent) {
    console.error("[Error after headers sent]", err);
    return;
  }

  let statusCode = 500;
  let message = "Lỗi server nội bộ";

  // --- Xử lý các loại lỗi cụ thể ---
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Dữ liệu không hợp lệ";
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = "ID không hợp lệ";
  } else if (err.name === "MongoError" && (err as any).code === 11000) {
    statusCode = 409;
    message = "Dữ liệu đã tồn tại";
  } else if ((err as any).status) {
    // Nếu controller có đặt err.status
    statusCode = (err as any).status;
    message = (err as any).message || message;
  }

  // --- Log lỗi chi tiết ---
  console.error("[Unhandled Error]", message, err.stack);

  // --- Response ---
  res.status(statusCode).json({
    success: false,
    error:
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
