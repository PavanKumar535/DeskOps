import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import tenantRoutes from "./routes/tenant.routes";
import { errorHandler } from "./middleware/errorHandler";
import { sendError } from "./utils/apiResponse";

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsOrigin === "*") return callback(null, true);
      const allowedList = corsOrigin.split(",").map((o) => o.trim().replace(/\/$/, ""));
      const isAllowed = allowedList.some((allowed) => {
        const withProtocol = allowed.startsWith("http") ? allowed : `https://${allowed}`;
        return origin === allowed || origin === withProtocol;
      });
      if (isAllowed) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Request logging (suppress in tests)
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// Body parser
app.use(express.json());

// Top-level health checks
app.use(healthRoutes);

// Versioned API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", tenantRoutes);

// Catch 404 for undefined routes
app.use((req, res) => {
  return sendError(res, `Route not found: ${req.method} ${req.path}`, 404);
});

// Centralized error handler
app.use(errorHandler);

export default app;
