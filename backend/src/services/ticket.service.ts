import prisma from "../lib/prisma";
import {
  isValidTransition,
  getReopenWindowDurationMs,
  isReopenWindowActive,
} from "../lib/ticketStateMachine";
import {
  TicketStatus,
  TicketPriority,
  UserRole,
} from "../generated/prisma/enums";
import { AuthenticatedUser } from "../types/express";
import { CreateTicketInput } from "../schemas/ticket.schema";

export interface ServiceError extends Error {
  statusCode: number;
}

export function createServiceError(
  message: string,
  statusCode: number
): ServiceError {
  const error = new Error(message) as ServiceError;
  error.statusCode = statusCode;
  return error;
}

/**
 * Resolves the primary store (propertyId) associated with a user (e.g. Store Manager).
 */
export async function getUserStoreId(
  userId: string,
  organisationId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: {
      id_organisationId: {
        id: userId,
        organisationId,
      },
    },
    include: {
      unit: true,
      propertyCoverage: true,
    },
  });

  if (!user) return null;
  if (user.unit?.propertyId) return user.unit.propertyId;
  if (user.propertyCoverage && user.propertyCoverage.length > 0) {
    return user.propertyCoverage[0].propertyId;
  }

  // Fallback: Check if user has created tickets for a property
  const lastTicket = await prisma.ticket.findFirst({
    where: { createdById: userId, organisationId },
    select: { propertyId: true },
    orderBy: { createdAt: "desc" },
  });

  return lastTicket?.propertyId || null;
}

/**
 * Creates a new ticket within the user's organisation and records the creation event.
 */
export async function createTicket(
  organisationId: string,
  actor: AuthenticatedUser,
  input: CreateTicketInput
) {
  return prisma.$transaction(async (tx) => {
    // Verify that the specified property belongs to the tenant
    const property = await tx.property.findFirst({
      where: { id: input.propertyId, organisationId },
    });
    if (!property) {
      throw createServiceError("Property not found in organisation", 404);
    }

    // Verify unit belongs to property and organisation
    const unit = await tx.unit.findFirst({
      where: {
        id: input.unitId,
        propertyId: input.propertyId,
        organisationId,
      },
    });
    if (!unit) {
      throw createServiceError("Unit not found in property", 404);
    }

    const priority = (input.priority as TicketPriority) || TicketPriority.MEDIUM;

    const ticket = await tx.ticket.create({
      data: {
        title: input.title,
        description: input.description,
        priority,
        category: input.category || "General",
        status: TicketStatus.NEW,
        organisationId,
        propertyId: input.propertyId,
        unitId: input.unitId,
        createdById: actor.id,
      },
      include: {
        property: true,
        unit: true,
        creator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // Record creation event
    await tx.ticketEvent.create({
      data: {
        organisationId,
        ticketId: ticket.id,
        actorId: actor.id,
        eventType: "TICKET_CREATED",
        newStatus: TicketStatus.NEW,
        description: `Ticket created by ${actor.name} (${actor.email})`,
      },
    });

    return ticket;
  });
}

/**
 * Retrieves tickets scoped by organisation, respecting role-based store boundaries.
 */
export async function getTickets(
  organisationId: string,
  user: AuthenticatedUser
) {
  const where: any = { organisationId };

  // Store Manager permission: Store managers can only see their own store's work
  if (user.role === UserRole.STAFF) {
    const storeId = await getUserStoreId(user.id, organisationId);
    if (storeId) {
      where.propertyId = storeId;
    }
  } else if (user.role === UserRole.RESIDENT) {
    // Residents view their own created tickets or tickets for their assigned unit
    const orConditions: any[] = [{ createdById: user.id }];
    if (user.unitId) {
      orConditions.push({ unitId: user.unitId });
    }
    where.OR = orConditions;
  }

  return prisma.ticket.findMany({
    where,
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
      assignedTo: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Retrieves a single ticket by ID, enforcing tenant boundaries and store manager permissions.
 */
export async function getTicketById(
  ticketId: string,
  organisationId: string,
  user: AuthenticatedUser
) {
  const ticket = await prisma.ticket.findUnique({
    where: {
      id_organisationId: {
        id: ticketId,
        organisationId,
      },
    },
    include: {
      property: true,
      unit: true,
      creator: {
        select: { id: true, name: true, email: true, role: true },
      },
      assignedTo: {
        select: { id: true, name: true, email: true, role: true },
      },
      events: {
        where: { organisationId },
        orderBy: { createdAt: "asc" },
        include: {
          actor: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      },
    },
  });

  if (!ticket) {
    throw createServiceError("Ticket not found", 404);
  }

  // Store Manager access restriction: only view tickets for own store
  if (user.role === UserRole.STAFF) {
    const storeId = await getUserStoreId(user.id, organisationId);
    if (storeId && ticket.propertyId !== storeId) {
      throw createServiceError("Ticket not found", 404);
    }
  }

  return ticket;
}

/**
 * Triages a ticket (NEW -> TRIAGED), optionally updating priority or category.
 */
export async function triageTicket(
  ticketId: string,
  organisationId: string,
  actor: AuthenticatedUser,
  data?: { priority?: string; category?: string }
) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findFirst({
      where: { id: ticketId, organisationId },
    });

    if (!ticket) {
      throw createServiceError("Ticket not found", 404);
    }

    if (!isValidTransition(ticket.status, TicketStatus.TRIAGED)) {
      throw createServiceError(
        `Cannot triage ticket in status ${ticket.status}. Must be NEW.`,
        400
      );
    }

    const updateData: any = {
      status: TicketStatus.TRIAGED,
    };
    if (data?.priority) {
      updateData.priority = data.priority as TicketPriority;
    }
    if (data?.category) {
      updateData.category = data.category;
    }

    const updated = await tx.ticket.update({
      where: { id_organisationId: { id: ticketId, organisationId } },
      data: updateData,
      include: {
        property: true,
        unit: true,
        creator: true,
        assignedTo: true,
      },
    });

    await tx.ticketEvent.create({
      data: {
        organisationId,
        ticketId,
        actorId: actor.id,
        eventType: "TICKET_TRIAGED",
        previousStatus: ticket.status,
        newStatus: TicketStatus.TRIAGED,
        description: `Ticket triaged by ${actor.name}`,
      },
    });

    return updated;
  });
}

/**
 * Assigns a ticket to a technician with concurrency protection.
 * Exactly 1 of 20 parallel requests will succeed; the other 19 will receive 409 Conflict.
 */
export async function assignTicket(
  ticketId: string,
  organisationId: string,
  technicianId: string,
  actor: AuthenticatedUser
) {
  // Validate technician belongs to the same organisation
  const technician = await prisma.user.findUnique({
    where: {
      id_organisationId: {
        id: technicianId,
        organisationId,
      },
    },
  });

  if (!technician) {
    throw createServiceError(
      "Technician not found in this organisation",
      404
    );
  }

  return prisma.$transaction(async (tx) => {
    // Atomic conditional update ensuring concurrency safety:
    // Only updates if ticket is in TRIAGED state and unassigned.
    const updateResult = await tx.ticket.updateMany({
      where: {
        id: ticketId,
        organisationId,
        status: TicketStatus.TRIAGED,
        assignedToId: null,
      },
      data: {
        assignedToId: technicianId,
        status: TicketStatus.ASSIGNED,
      },
    });

    if (updateResult.count === 0) {
      // Find reason for failure to provide accurate status code
      const current = await tx.ticket.findFirst({
        where: { id: ticketId, organisationId },
      });

      if (!current) {
        throw createServiceError("Ticket not found", 404);
      }

      if (current.assignedToId !== null || current.status === TicketStatus.ASSIGNED) {
        throw createServiceError(
          "Ticket has already been assigned to another technician",
          409
        );
      }

      throw createServiceError(
        `Cannot assign ticket in status ${current.status}. Ticket must be TRIAGED.`,
        400
      );
    }

    // Record assignment event
    await tx.ticketEvent.create({
      data: {
        organisationId,
        ticketId,
        actorId: actor.id,
        eventType: "TICKET_ASSIGNED",
        previousStatus: TicketStatus.TRIAGED,
        newStatus: TicketStatus.ASSIGNED,
        description: `Ticket assigned to ${technician.name} (${technician.email})`,
      },
    });

    return tx.ticket.findUnique({
      where: { id_organisationId: { id: ticketId, organisationId } },
      include: {
        property: true,
        unit: true,
        creator: true,
        assignedTo: true,
      },
    });
  });
}

/**
 * Resolves an IN_PROGRESS ticket and sets the reopening deadline.
 */
export async function resolveTicket(
  ticketId: string,
  organisationId: string,
  actor: AuthenticatedUser,
  resolutionNotes?: string
) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findFirst({
      where: { id: ticketId, organisationId },
    });

    if (!ticket) {
      throw createServiceError("Ticket not found", 404);
    }

    if (!isValidTransition(ticket.status, TicketStatus.RESOLVED)) {
      throw createServiceError(
        `Cannot resolve ticket in status ${ticket.status}. Must be IN_PROGRESS.`,
        400
      );
    }

    const now = new Date();
    const reopenUntil = new Date(now.getTime() + getReopenWindowDurationMs());

    const updated = await tx.ticket.update({
      where: { id_organisationId: { id: ticketId, organisationId } },
      data: {
        status: TicketStatus.RESOLVED,
        resolvedAt: now,
        reopenUntil,
      },
      include: {
        property: true,
        unit: true,
        creator: true,
        assignedTo: true,
      },
    });

    await tx.ticketEvent.create({
      data: {
        organisationId,
        ticketId,
        actorId: actor.id,
        eventType: "TICKET_RESOLVED",
        previousStatus: ticket.status,
        newStatus: TicketStatus.RESOLVED,
        description: resolutionNotes
          ? `Ticket resolved: ${resolutionNotes}`
          : "Ticket marked as resolved",
      },
    });

    return updated;
  });
}

/**
 * Closes a RESOLVED ticket.
 * Enforces role permission: Store Manager (STAFF) can close only for own store;
 * Head Office (ORG_ADMIN) can close tickets for any store.
 */
export async function closeTicket(
  ticketId: string,
  organisationId: string,
  actor: AuthenticatedUser
) {
  // Check permission: Residents and technicians cannot close tickets
  if (
    actor.role !== UserRole.ORG_ADMIN &&
    actor.role !== UserRole.STAFF
  ) {
    throw createServiceError(
      "Forbidden: You do not have permission to close tickets",
      403
    );
  }

  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findFirst({
      where: { id: ticketId, organisationId },
    });

    if (!ticket) {
      throw createServiceError("Ticket not found", 404);
    }

    // Role-based closure constraint:
    // Store managers can only close tickets for their own store
    if (actor.role === UserRole.STAFF) {
      const storeId = await getUserStoreId(actor.id, organisationId);
      if (storeId && ticket.propertyId !== storeId) {
        throw createServiceError(
          "Forbidden: Store managers can only close tickets for their own store",
          403
        );
      }
    }

    if (!isValidTransition(ticket.status, TicketStatus.CLOSED)) {
      throw createServiceError(
        `Cannot close ticket in status ${ticket.status}. Must be RESOLVED.`,
        400
      );
    }

    const now = new Date();
    // Maintain or set reopenUntil window
    const reopenUntil =
      ticket.reopenUntil ||
      new Date(now.getTime() + getReopenWindowDurationMs());

    const updated = await tx.ticket.update({
      where: { id_organisationId: { id: ticketId, organisationId } },
      data: {
        status: TicketStatus.CLOSED,
        closedAt: now,
        reopenUntil,
      },
      include: {
        property: true,
        unit: true,
        creator: true,
        assignedTo: true,
      },
    });

    await tx.ticketEvent.create({
      data: {
        organisationId,
        ticketId,
        actorId: actor.id,
        eventType: "TICKET_CLOSED",
        previousStatus: ticket.status,
        newStatus: TicketStatus.CLOSED,
        description: `Ticket closed by ${actor.name} (${actor.role})`,
      },
    });

    return updated;
  });
}

/**
 * Reopens a CLOSED ticket if within the permitted reopening window.
 */
export async function reopenTicket(
  ticketId: string,
  organisationId: string,
  actor: AuthenticatedUser,
  reason?: string
) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findFirst({
      where: { id: ticketId, organisationId },
    });

    if (!ticket) {
      throw createServiceError("Ticket not found", 404);
    }

    if (!isValidTransition(ticket.status, TicketStatus.REOPENED)) {
      throw createServiceError(
        `Cannot reopen ticket in status ${ticket.status}. Must be CLOSED.`,
        400
      );
    }

    // Validate reopening window
    if (!isReopenWindowActive(ticket.reopenUntil)) {
      throw createServiceError(
        "Reopening window has expired. Ticket cannot be reopened.",
        400
      );
    }

    const updated = await tx.ticket.update({
      where: { id_organisationId: { id: ticketId, organisationId } },
      data: {
        status: TicketStatus.REOPENED,
      },
      include: {
        property: true,
        unit: true,
        creator: true,
        assignedTo: true,
      },
    });

    await tx.ticketEvent.create({
      data: {
        organisationId,
        ticketId,
        actorId: actor.id,
        eventType: "TICKET_REOPENED",
        previousStatus: ticket.status,
        newStatus: TicketStatus.REOPENED,
        description: reason
          ? `Ticket reopened: ${reason}`
          : `Ticket reopened by ${actor.name}`,
      },
    });

    return updated;
  });
}

/**
 * Generic status transition (e.g. ASSIGNED -> IN_PROGRESS, IN_PROGRESS <-> ON_HOLD).
 */
export async function updateTicketStatus({
  ticketId,
  organisationId,
  actor,
  newStatus,
}: {
  ticketId: string;
  organisationId: string;
  actor: AuthenticatedUser;
  newStatus: TicketStatus;
}) {
  // Delegate specialized endpoints when appropriate
  if (newStatus === TicketStatus.RESOLVED) {
    return resolveTicket(ticketId, organisationId, actor);
  }
  if (newStatus === TicketStatus.CLOSED) {
    return closeTicket(ticketId, organisationId, actor);
  }
  if (newStatus === TicketStatus.REOPENED) {
    return reopenTicket(ticketId, organisationId, actor);
  }

  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findFirst({
      where: { id: ticketId, organisationId },
    });

    if (!ticket) {
      throw createServiceError("Ticket not found", 404);
    }

    if (!isValidTransition(ticket.status, newStatus)) {
      throw createServiceError(
        `Invalid ticket status transition from ${ticket.status} to ${newStatus}.`,
        400
      );
    }

    const updated = await tx.ticket.update({
      where: { id_organisationId: { id: ticketId, organisationId } },
      data: { status: newStatus },
      include: {
        property: true,
        unit: true,
        creator: true,
        assignedTo: true,
      },
    });

    await tx.ticketEvent.create({
      data: {
        organisationId,
        ticketId,
        actorId: actor.id,
        eventType: "STATUS_CHANGED",
        previousStatus: ticket.status,
        newStatus,
        description: `Ticket status transitioned from ${ticket.status} to ${newStatus}`,
      },
    });

    return updated;
  });
}

/**
 * Retrieves chronological audit event history for a ticket.
 */
export async function getTicketEvents(
  ticketId: string,
  organisationId: string
) {
  // Confirm ticket exists in tenant
  const ticket = await prisma.ticket.findUnique({
    where: {
      id_organisationId: {
        id: ticketId,
        organisationId,
      },
    },
    select: { id: true },
  });

  if (!ticket) {
    throw createServiceError("Ticket not found", 404);
  }

  return prisma.ticketEvent.findMany({
    where: { ticketId, organisationId },
    orderBy: { createdAt: "asc" },
    include: {
      actor: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
  });
}
