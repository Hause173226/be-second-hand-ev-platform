import { RequestHandler } from "express";
export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.user) { res.status(401).json({ message: "Unauthorized" }); return; }
  if (req.user.role !== "admin") { res.status(403).json({ message: "Admin only" }); return; }
  next();
};
