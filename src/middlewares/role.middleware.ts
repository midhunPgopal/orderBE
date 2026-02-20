import { Request, Response, NextFunction } from "express";
import { Role } from "../models/role";

export const authorizeAdmin = (
  req: any,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.user.role !== Role.ADMIN) {
    return res.status(403).json({ error: "Admin access required" });
  }

  next();
};
