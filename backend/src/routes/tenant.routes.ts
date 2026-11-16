import { Router } from "express";
import prisma from "../lib/prisma";
import { UserRole } from "../generated/prisma/enums";
import { requireAuth } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { validateBody } from "../middleware/validate";
import { sendSuccess } from "../utils/apiResponse";

import { getOrganisation } from "../controllers/organisation.controller";
import * as ticketController from "../controllers/ticket.controller";

import {
  createTicketSchema,
  updateTicketStatusSchema,
  triageTicketSchema,
  assignTicketSchema,
  resolveTicketSchema,
  reopenTicketSchema,
} from "../schemas/ticket.schema";

const router = Router();

// Enforce authentication and tenant isolation across all routes
router.use(requireAuth, tenantMiddleware);

// Organisation details
router.get("/organisation", getOrganisation);

// Auxiliary tenant endpoints for UI dropdowns
router.get("/properties", async (req, res, next) => {
  try {
    const properties = await prisma.property.findMany({
      where: { organisationId: req.tenantId },
      include: {
        units: {
          select: { id: true, unitNumber: true },
          orderBy: { unitNumber: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
    return sendSuccess(res, { properties });
  } catch (err) {
    next(err);
  }
});

router.get("/technicians", async (req, res, next) => {
  try {
    const technicians = await prisma.user.findMany({
      where: {
        organisationId: req.tenantId,
        role: UserRole.TECHNICIAN,
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
    return sendSuccess(res, { technicians });
  } catch (err) {
    next(err);
  }
});

// Ticket lifecycle endpoints
router.post(
  "/tickets",
  validateBody(createTicketSchema),
  ticketController.createTicketController
);

router.get("/tickets", ticketController.getTickets);
router.get("/tickets/:id", ticketController.getTicketById);

router.post(
  "/tickets/:id/triage",
  validateBody(triageTicketSchema),
  ticketController.triageTicketController
);

router.post(
  "/tickets/:id/assign",
  validateBody(assignTicketSchema),
  ticketController.assignTicketController
);

router.patch(
  "/tickets/:id/status",
  validateBody(updateTicketStatusSchema),
  ticketController.updateTicketStatusController
);

router.post(
  "/tickets/:id/resolve",
  validateBody(resolveTicketSchema),
  ticketController.resolveTicketController
);

router.post("/tickets/:id/close", ticketController.closeTicketController);

router.post(
  "/tickets/:id/reopen",
  validateBody(reopenTicketSchema),
  ticketController.reopenTicketController
);

router.get("/tickets/:id/events", ticketController.getTicketEventsController);

export default router;
