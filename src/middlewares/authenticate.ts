import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

export const authenticateJWT = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      (req as any).user = decoded;
      next();
      return; // <-- Thêm dòng này để đảm bảo trả về void
    } catch (err) {
      res.status(401).json({ error: "Token không hợp lệ" });
      return; // <-- Thêm dòng này
    }
  } else {
    res.status(401).json({ error: "Không có token" });
    return; // <-- Thêm dòng này
  }
};

export const checkAdmin = (req: Request, res: Response, next: NextFunction) => {
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
// src/middlewares/authenticate.ts
import { RequestHandler } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

type JWTPayload = JwtPayload & {
  _id?: string; // nếu lúc ký dùng _id
  userId?: string; // nếu lúc ký dùng userId
  role?: "user" | "admin";
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
    (req as any).user = {
      _id: decoded._id ?? decoded.userId,
      role: decoded.role,
      isActive: decoded.isActive,
      ...decoded,
    };

    next();
    return;
  } catch {
    res.status(401).json({ error: "Token không hợp lệ" });
    return;
  }
};
