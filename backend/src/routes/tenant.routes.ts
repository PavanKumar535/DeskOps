import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { getOrganisation } from "../controllers/organisation.controller";
import { getTickets, getTicketById } from "../controllers/ticket.controller";

const router = Router();

// Protect all routes with auth and tenant middleware
router.use(requireAuth, tenantMiddleware);

// Tenant organisation info
router.get("/organisation", getOrganisation);

// Tenant-scoped tickets
router.get("/tickets", getTickets);
router.get("/tickets/:id", getTicketById);

export default router;
