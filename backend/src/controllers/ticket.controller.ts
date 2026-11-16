
import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { updateTicketStatus } from "../services/ticket.service";
import { TicketStatus } from "../generated/prisma/enums";

// Get all tickets
export async function getTickets(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tickets = await prisma.ticket.findMany({
      where: {
        organisationId: req.tenantId,
      },
      include: {
        property: {
          select: { id: true, name: true, address: true },
        },
        unit: {
          select: { id: true, unitNumber: true },
        },
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return sendSuccess(res, { tickets });
  } catch (err) {
    next(err);
  }
}

// Get ticket by ID
export async function getTicketById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const ticket = await prisma.ticket.findFirst({
      where: {
        id,
        organisationId: req.tenantId,
      },
      include: {
        property: true,
        unit: true,
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    if (!ticket) {
      return sendError(res, "Ticket not found", 404);
    }

    return sendSuccess(res, { ticket });
  } catch (err) {
    next(err);
  }
}

// Update ticket status
export async function updateTicketStatusController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return sendError(res, "Authentication required", 401);
    }

    const ticketId = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    const updatedTicket = await updateTicketStatus({
      ticketId,
      organisationId: req.tenantId!,
      actorId: req.user.id,
      newStatus: req.body.status as TicketStatus,
    });

    return sendSuccess(res, { ticket: updatedTicket });
  } catch (err) {
    next(err);
  }
}
