import { Router } from "express";
import prisma from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";

const router = Router();

// Liveness probe
router.get("/health", (req, res) => {
  return sendSuccess(res, { timestamp: new Date().toISOString() }, "DeskOps API is running");
});

// Readiness probe
router.get("/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return sendSuccess(res, { ready: true }, "DeskOps API is ready to accept traffic");
  } catch (error: any) {
    return sendError(res, "DeskOps API is not ready: database unreachable", 503);
  }
});

// Database connectivity check
router.get("/health/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return sendSuccess(res, { connected: true }, "PostgreSQL database connected successfully");
  } catch (error: any) {
    return sendError(res, "Database connection failed", 500, error.message);
  }
});

export default router;
