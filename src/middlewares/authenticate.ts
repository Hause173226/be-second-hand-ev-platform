// src/middlewares/authenticate.ts
import { RequestHandler } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "../models/User";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

type JWTPayload = JwtPayload & {
  _id?: string;
  userId?: string;
  role?: "user" | "staff" | "admin";
  email?: string;
  [k: string]: any;
};

type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED" | string;

/**
 * Xác thực JWT + kiểm tra trạng thái tài khoản.
 * - Không có / sai token  -> 401
 * - User không tồn tại     -> 401
 * - User bị SUSPENDED/DELETED -> 403 (ACCOUNT_DISABLED)
 */
export const authenticate: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Không có token" });
    return;
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    const userId = decoded._id ?? decoded.userId;
    if (!userId) {
      res.status(401).json({ error: "Token không hợp lệ (không có userId)" });
      return;
    }

    // 🔍 Lấy user mới nhất từ DB
    const userDoc = await User.findById(userId);
    if (!userDoc) {
      res.status(401).json({ error: "Người dùng không tồn tại" });
      return;
    }

    const status = (userDoc.status || "ACTIVE") as UserStatus;

    // 🔥 Nếu tài khoản không còn ACTIVE -> chặn luôn
    if (status !== "ACTIVE") {
      res.status(403).json({
        code: "ACCOUNT_DISABLED",
        error: "Tài khoản của bạn đã bị khoá hoặc đã bị xoá.",
        status,
      });
      return;
    }

    // Gắn user vào req để controller khác dùng
    (req as any).user = {
      _id: userDoc._id.toString(),
      id: userDoc._id.toString(),
      userId: userDoc._id.toString(),
      email: userDoc.email,
      phone: userDoc.phone,
      role: userDoc.role,          // "user" | "staff" | "admin"
      roles: userDoc.roles,        // mảng roles nếu cần
      status: userDoc.status,      // "ACTIVE"
      ekycStatus: userDoc.ekycStatus,
      fullName: userDoc.fullName,
      // thông tin thêm từ token (nếu cần)
      tokenInfo: {
        iat: decoded.iat,
        exp: decoded.exp,
      },
    };

    next();
    return;
  } catch (err) {
    res.status(401).json({ error: "Token không hợp lệ" });
    return;
  }
};

// Alias cho code cũ
export const authenticateJWT = authenticate;

/**
 * Chỉ cho ADMIN truy cập
 */
export const checkAdmin: RequestHandler = (req, res, next) => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: "Không có token" });
    return;
  }

  if (user.role !== "admin") {
    res
      .status(403)
      .json({ error: "Không có quyền truy cập. Chỉ admin mới được phép." });
    return;
  }

  next();
};

/**
 * (Tuỳ chọn) Chỉ cho STAFF truy cập
 * Nếu không cần thì không dùng middleware này ở routes.
 */
export const checkStaff: RequestHandler = (req, res, next) => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: "Không có token" });
    return;
  }

  if (user.role !== "staff") {
    res
      .status(403)
      .json({ error: "Không có quyền truy cập. Chỉ staff mới được phép." });
    return;
  }

  next();
};
