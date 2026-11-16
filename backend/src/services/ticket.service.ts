
import prisma from "../lib/prisma";
import { isValidTransition } from "../lib/ticketStateMachine";
import { TicketStatus } from "../generated/prisma/enums";

interface UpdateTicketStatusParams {
  ticketId: string;
  organisationId: string;
  actorId: string;
  newStatus: TicketStatus;
}

interface ServiceError extends Error {
  statusCode: number;
}

function createServiceError(message: string, statusCode: number): ServiceError {
  const error = new Error(message) as ServiceError;
  error.statusCode = statusCode;
  return error;
}

export async function updateTicketStatus({
  ticketId,
  organisationId,
  actorId,
  newStatus,
}: UpdateTicketStatusParams) {
  return prisma.$transaction(async (tx) => {
    // Find the ticket within the authenticated user's organisation.
    const ticket = await tx.ticket.findFirst({
      where: {
        id: ticketId,
        organisationId,
      },
    });

    if (!ticket) {
      throw createServiceError("Ticket not found", 404);
    }

    // Check whether the requested status transition is allowed.
    if (!isValidTransition(ticket.status, newStatus)) {
      throw createServiceError(
        `Invalid ticket status transition from ${ticket.status} to ${newStatus}.`,
        400
      );
    }

    // Update the ticket status.
    const updatedTicket = await tx.ticket.update({
      where: {
        id_organisationId: {
          id: ticketId,
          organisationId,
        },
      },
      data: {
        status: newStatus,
      },
    });

    // Record the status change in ticket event history.
    await tx.ticketEvent.create({
      data: {
        organisationId,
        ticketId,
        actorId,
        eventType: "STATUS_CHANGED",
        previousStatus: ticket.status,
        newStatus,
        description: `Ticket status changed from ${ticket.status} to ${newStatus}`,
      },
    });

    return updatedTicket;
  });
}
