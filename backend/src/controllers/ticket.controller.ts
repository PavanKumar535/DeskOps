import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendError } from "../utils/apiResponse";
import * as ticketService from "../services/ticket.service";
import { TicketStatus } from "../generated/prisma/enums";

function getParamId(req: Request): string {
  return Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
}

// 1. Create a ticket
export async function createTicketController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.tenantId) {
      return sendError(res, "Authentication required", 401);
    }

    const ticket = await ticketService.createTicket(
      req.tenantId,
      req.user,
      req.body
    );

    return sendSuccess(res, { ticket }, "Ticket created successfully", 201);
  } catch (err: any) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
}

// 2. List tenant-scoped tickets
export async function getTickets(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.tenantId) {
      return sendError(res, "Authentication required", 401);
    }

    const tickets = await ticketService.getTickets(req.tenantId, req.user);
    return sendSuccess(res, { tickets });
  } catch (err) {
    next(err);
  }
}

// 3. Get ticket by ID
export async function getTicketById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.tenantId) {
      return sendError(res, "Authentication required", 401);
    }

    const id = getParamId(req);
    const ticket = await ticketService.getTicketById(
      id,
      req.tenantId,
      req.user
    );

    return sendSuccess(res, { ticket });
  } catch (err: any) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
}

// 4. Triage ticket
export async function triageTicketController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.tenantId) {
      return sendError(res, "Authentication required", 401);
    }

    const id = getParamId(req);
    const ticket = await ticketService.triageTicket(
      id,
      req.tenantId,
      req.user,
      req.body
    );

    return sendSuccess(res, { ticket }, "Ticket triaged successfully");
  } catch (err: any) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
}

// 5. Assign ticket (concurrency safe)
export async function assignTicketController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.tenantId) {
      return sendError(res, "Authentication required", 401);
    }

    const id = getParamId(req);
    const { technicianId } = req.body;

    const ticket = await ticketService.assignTicket(
      id,
      req.tenantId,
      technicianId,
      req.user
    );

    return sendSuccess(res, { ticket }, "Ticket assigned successfully");
  } catch (err: any) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
}

// 6. Generic status transition
export async function updateTicketStatusController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.tenantId) {
      return sendError(res, "Authentication required", 401);
    }

    const id = getParamId(req);
    const updatedTicket = await ticketService.updateTicketStatus({
      ticketId: id,
      organisationId: req.tenantId,
      actor: req.user,
      newStatus: req.body.status as TicketStatus,
    });

    return sendSuccess(res, { ticket: updatedTicket }, "Ticket status updated");
  } catch (err: any) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
}

// 7. Resolve ticket
export async function resolveTicketController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.tenantId) {
      return sendError(res, "Authentication required", 401);
    }

    const id = getParamId(req);
    const ticket = await ticketService.resolveTicket(
      id,
      req.tenantId,
      req.user,
      req.body?.resolutionNotes
    );

    return sendSuccess(res, { ticket }, "Ticket marked as resolved");
  } catch (err: any) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
}

// 8. Close ticket
export async function closeTicketController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.tenantId) {
      return sendError(res, "Authentication required", 401);
    }

    const id = getParamId(req);
    const ticket = await ticketService.closeTicket(
      id,
      req.tenantId,
      req.user
    );

    return sendSuccess(res, { ticket }, "Ticket closed successfully");
  } catch (err: any) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
}

// 9. Reopen ticket
export async function reopenTicketController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.tenantId) {
      return sendError(res, "Authentication required", 401);
    }

    const id = getParamId(req);
    const ticket = await ticketService.reopenTicket(
      id,
      req.tenantId,
      req.user,
      req.body?.reason
    );

    return sendSuccess(res, { ticket }, "Ticket reopened successfully");
  } catch (err: any) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
}

// 10. Get ticket timeline events
export async function getTicketEventsController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user || !req.tenantId) {
      return sendError(res, "Authentication required", 401);
    }

    const id = getParamId(req);
    const events = await ticketService.getTicketEvents(id, req.tenantId);

    return sendSuccess(res, { events });
  } catch (err: any) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }
    next(err);
  }
}
