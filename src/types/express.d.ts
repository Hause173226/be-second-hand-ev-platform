import "express-serve-static-core";
declare module "express-serve-static-core" {
  interface Request {
    user?: { _id?: string; role?: "user" | "admin"; isActive?: boolean; [k: string]: any };
  }
}
