import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errorHandler";

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = "Lỗi server nội bộ";

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Dữ liệu không hợp lệ";
  } else if (error.name === "CastError") {
    statusCode = 400;
    message = "ID không hợp lệ";
  } else if (error.name === "MongoError" && (error as any).code === 11000) {
    statusCode = 409;
    message = "Dữ liệu đã tồn tại";
  }

  console.error("Error:", error);

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
};
