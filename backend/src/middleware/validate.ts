import { Request, Response, NextFunction } from "express";
import { ZodType, ZodError } from "zod";
import { sendError } from "../utils/apiResponse";

export function validateBody(schema: ZodType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return sendError(res, "Validation failed", 400, issues);
      }
      return sendError(res, "Invalid request payload", 400);
    }
  };
}
