import { RequestHandler } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

type JWTPayload = JwtPayload & {
  _id?: string;        // nếu lúc ký dùng _id
  userId?: string;     // nếu lúc ký dùng userId
  role?: "user" | "admin" | "staff";
  isActive?: boolean;
  [k: string]: any;
};

export const authenticate: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Không có token" });
    return;
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Chuẩn hoá key để các middleware khác dùng: req.user._id / role / isActive
    const userId = decoded._id ?? decoded.userId;
    
    // Loại bỏ các field đã set để tránh duplicate
    const { _id, userId: decodedUserId, role, isActive, ...rest } = decoded;
    
    (req as any).user = {
      _id: userId,
      id: userId, // Thêm id để tương thích
      role: decoded.role,
      isActive: decoded.isActive,
      email: decoded.email, // Giữ email nếu có
      ...rest, // Chỉ spread các field khác (iat, exp, etc.)
    };

    next();
    return;
  } catch {
    res.status(401).json({ error: "Token không hợp lệ" });
    return;
  }
};

// Alias for backward compatibility
export const authenticateJWT = authenticate;

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
