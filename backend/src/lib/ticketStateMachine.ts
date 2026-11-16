import { TicketStatus } from "../generated/prisma/enums";

/**
 * Ticket State Machine Definitions:
 * NEW -> TRIAGED -> ASSIGNED -> IN_PROGRESS -> (ON_HOLD / RESOLVED) -> CLOSED -> REOPENED
 */
export const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.NEW]: [TicketStatus.TRIAGED],
  [TicketStatus.TRIAGED]: [TicketStatus.ASSIGNED],
  [TicketStatus.ASSIGNED]: [TicketStatus.IN_PROGRESS],
  [TicketStatus.IN_PROGRESS]: [TicketStatus.ON_HOLD, TicketStatus.RESOLVED],
  [TicketStatus.ON_HOLD]: [TicketStatus.IN_PROGRESS],
  [TicketStatus.RESOLVED]: [TicketStatus.CLOSED],
  [TicketStatus.CLOSED]: [TicketStatus.REOPENED],
  [TicketStatus.REOPENED]: [
    TicketStatus.TRIAGED,
    TicketStatus.ASSIGNED,
    TicketStatus.IN_PROGRESS,
  ],
};

/**
 * Validates whether a status transition from currentStatus to nextStatus is permitted.
 */
export function isValidTransition(
  currentStatus: TicketStatus | string,
  nextStatus: TicketStatus | string
): boolean {
  const allowed = allowedTransitions[currentStatus as TicketStatus];
  if (!allowed) return false;
  return allowed.includes(nextStatus as TicketStatus);
}

/**
 * Returns the duration of the ticket reopening window in milliseconds.
 * Configured via TICKET_REOPEN_WINDOW_HOURS or TICKET_REOPEN_WINDOW_DAYS.
 * Note: Official policy duration is pending final mentor review; defaults to 7 days if unset.
 */
export function getReopenWindowDurationMs(): number {
  if (process.env.TICKET_REOPEN_WINDOW_HOURS) {
    const hours = parseFloat(process.env.TICKET_REOPEN_WINDOW_HOURS);
    if (!isNaN(hours) && hours > 0) {
      return hours * 60 * 60 * 1000;
    }
  }

  if (process.env.TICKET_REOPEN_WINDOW_DAYS) {
    const days = parseFloat(process.env.TICKET_REOPEN_WINDOW_DAYS);
    if (!isNaN(days) && days > 0) {
      return days * 24 * 60 * 60 * 1000;
    }
  }

  // Default fallback pending mentor confirmation: 7 days (168 hours)
  return 7 * 24 * 60 * 60 * 1000;
}

/**
 * Validates whether a closed ticket's reopening window is still active.
 */
export function isReopenWindowActive(
  reopenUntil: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!reopenUntil) return false;
  return now.getTime() <= new Date(reopenUntil).getTime();
}
