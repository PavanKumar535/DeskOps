
import { TicketStatus } from "../generated/prisma/enums";

/**
 * Ticket State Machine
 */
export const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.NEW]: [TicketStatus.TRIAGED],
  [TicketStatus.TRIAGED]: [TicketStatus.ASSIGNED],
  [TicketStatus.ASSIGNED]: [TicketStatus.IN_PROGRESS],
  [TicketStatus.IN_PROGRESS]: [
    TicketStatus.ON_HOLD,
    TicketStatus.RESOLVED,
  ],
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
 * Validates whether a status transition is permitted.
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
 * Returns reopening window duration in milliseconds.
 */
export function getReopenWindowDurationMs(): number {
  if (process.env.TICKET_REOPEN_WINDOW_HOURS) {
    const hours = Number(process.env.TICKET_REOPEN_WINDOW_HOURS);

    if (Number.isFinite(hours) && hours > 0) {
      return hours * 60 * 60 * 1000;
    }
  }

  if (process.env.TICKET_REOPEN_WINDOW_DAYS) {
    const days = Number(process.env.TICKET_REOPEN_WINDOW_DAYS);

    if (Number.isFinite(days) && days > 0) {
      return days * 24 * 60 * 60 * 1000;
    }
  }

  // Provisional default; confirm duration with mentor.
  return 7 * 24 * 60 * 60 * 1000;
}

/**
 * Checks whether the reopening window is active.
 */
export function isReopenWindowActive(
  reopenUntil: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!reopenUntil) return false;

  return now.getTime() <= new Date(reopenUntil).getTime();
}
