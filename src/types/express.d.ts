import "express-serve-static-core";
declare module "express-serve-static-core" {
  interface Request {
    user?: { _id?: string; id?: string; role?: "user" | "admin" | "staff"; isActive?: boolean; [k: string]: any };
  }
}
