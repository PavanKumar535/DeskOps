
export const allowedTransitions = {
  NEW: ["TRIAGED"],
  TRIAGED: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["ON_HOLD", "RESOLVED"],
  ON_HOLD: ["IN_PROGRESS"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
  REOPENED: [],
} as const;

export function isValidTransition(
  currentStatus: keyof typeof allowedTransitions,
  nextStatus: string
): boolean {
  const allowed = allowedTransitions[currentStatus];

  return (allowed as readonly string[]).includes(nextStatus);
}
