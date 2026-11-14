import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/apiResponse";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message || err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  return sendError(res, message, statusCode);
}
