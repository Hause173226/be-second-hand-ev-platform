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
