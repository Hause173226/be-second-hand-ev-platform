import { RequestHandler } from "express";

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (!req.user) { res.status(401).json({ message: "Unauthorized" }); return; }
  if (req.user.role !== "admin") { res.status(403).json({ message: "Admin only" }); return; }
  next();
};

export const requireRole = (roles: string[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    
    if (!req.user.role || !roles.includes(req.user.role)) {
      res.status(403).json({ 
        message: `Access denied. Required roles: ${roles.join(', ')}` 
      });
      return;
    }
    
    next();
  };
};
