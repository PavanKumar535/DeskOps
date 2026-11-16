
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";

import { getOrganisation } from "../controllers/organisation.controller";
import {
  getTickets,
  getTicketById,
  updateTicketStatusController,
} from "../controllers/ticket.controller";

import { updateTicketStatusSchema } from "../schemas/ticket.schema";

const router = Router();

// Authentication and organisation-level access
router.use(requireAuth, tenantMiddleware);

// Organisation
router.get("/organisation", getOrganisation);

// Tickets
router.get("/tickets", getTickets);
router.get("/tickets/:id", getTicketById);

// Update ticket status
router.patch(
  "/tickets/:id/status",
  validateBody(updateTicketStatusSchema),
  updateTicketStatusController
);

export default router;
