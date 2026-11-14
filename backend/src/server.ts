import "dotenv/config";

import express from "express";
import cors from "cors";
import prisma from "./lib/prisma";

const app = express();

app.use(cors());
app.use(express.json());

// Backend health check
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "success",
        message: "DeskOps API is running",
    });
});

// Database health check
app.get("/health/db", async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        res.status(200).json({
            status: "success",
            message: "PostgreSQL database connected successfully",
        });
    } catch (error) {
        console.error("Database connection failed:", error);

        res.status(500).json({
            status: "error",
            message: "Database connection failed",
        });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`DeskOps server running on port ${PORT}`);
});