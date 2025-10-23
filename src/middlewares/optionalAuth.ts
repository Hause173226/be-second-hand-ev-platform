import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            // Không có token, tiếp tục mà không set req.user
            return next();
        }

        const token = authHeader.substring(7); // Remove "Bearer " prefix

        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET not configured");
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
        const user = await User.findById(decoded.userId).select("-password -refreshToken");

        if (!user || !user.isActive) {
            // Token không hợp lệ hoặc user không active, tiếp tục mà không set req.user
            return next();
        }

        (req as any).user = user;
        next();
    } catch (error) {
        // Token không hợp lệ, tiếp tục mà không set req.user
        next();
    }
};
