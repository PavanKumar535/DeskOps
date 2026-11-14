import { Response } from "express";

export interface ApiResponse<T = any> {
  status: "success" | "error";
  message?: string;
  data?: T;
  errors?: any;
}

export function sendSuccess<T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200
): Response {
  const body: ApiResponse<T> = {
    status: "success",
  };
  if (message) body.message = message;
  if (data !== undefined) body.data = data;
  return res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  errors?: any
): Response {
  const body: ApiResponse = {
    status: "error",
    message,
  };
  if (errors !== undefined) body.errors = errors;
  return res.status(statusCode).json(body);
}
