
import { describe, it, expect } from "vitest";
import { isValidTransition } from "../src/lib/ticketStateMachine";

describe("Ticket State Machine", () => {
  it("should allow NEW to TRIAGED", () => {
    expect(isValidTransition("NEW", "TRIAGED")).toBe(true);
  });

  it("should reject NEW to CLOSED", () => {
    expect(isValidTransition("NEW", "CLOSED")).toBe(false);
  });

  it("should allow IN_PROGRESS to ON_HOLD", () => {
    expect(isValidTransition("IN_PROGRESS", "ON_HOLD")).toBe(true);
  });

  it("should allow ON_HOLD to IN_PROGRESS", () => {
    expect(isValidTransition("ON_HOLD", "IN_PROGRESS")).toBe(true);
  });

  it("should reject CLOSED to NEW", () => {
    expect(isValidTransition("CLOSED", "NEW")).toBe(false);
  });
});
