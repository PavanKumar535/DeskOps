import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { sendError } from "../utils/apiResponse";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, "Authentication required", 401);
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    return sendError(res, "Authentication token missing", 401);
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return sendError(res, "Token has expired", 401);
    }
    return sendError(res, "Invalid authentication token", 401);
  }
}
