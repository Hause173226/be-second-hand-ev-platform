import { Request, Response, NextFunction } from "express";
import { User } from "../models/User";

export async function requireProfile(req: Request, res: Response, next: NextFunction) {
  try {
    // userId được gắn bởi authenticateJWT
    const uid = (req as any).user?.userId;
    if (!uid) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await User.findById(uid).lean();
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: "Account not active" });
    }

    // (Tuỳ chọn) kiểm tra hồ sơ tối thiểu
    // if (!user.fullName || !user.phone) {
    //   return res.status(400).json({ message: "Profile incomplete" });
    // }

    // Gắn lại user “chuẩn” vào req để các handler khác dùng
    (req as any).user = {
      ...((req as any).user || {}),
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    };

    next();
  } catch (err) {
    next(err);
  }
}
