// requireProfile.ts
import { RequestHandler } from "express";
export const requireProfile: RequestHandler = (req, res, next) => {
  if (!req.user?.isActive) { res.status(403).json({ message: "Account not active" }); return; }
  next();
};