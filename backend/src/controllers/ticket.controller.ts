import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";

export async function getTickets(req: Request, res: Response, next: NextFunction) {
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

export async function getTicketById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

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
