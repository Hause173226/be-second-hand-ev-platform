// src/middlewares/errorHandler.ts
import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // Nếu response đã được gửi rồi thì chỉ log, KHÔNG gửi lại nữa
  if (res.headersSent) {
    console.error("[Error after headers sent]", err);
    return;
  }

  const status = (err as any)?.status || 500;
  const msg =
    (err as any)?.message ||
    (typeof err === "string" ? err : "Internal Server Error");

  console.error("[Unhandled Error]", msg, (err as any)?.stack);

  res.status(status).json({
    error: process.env.NODE_ENV === "production" ? "Internal Server Error" : msg,
  });
};
