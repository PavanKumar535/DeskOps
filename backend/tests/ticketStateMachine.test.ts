
import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  getReopenWindowDurationMs,
  isReopenWindowActive,
} from "../src/lib/ticketStateMachine";

describe("Ticket State Machine", () => {
  it("should allow NEW to TRIAGED", () => {
    expect(isValidTransition("NEW", "TRIAGED")).toBe(true);
  });

  it("should reject NEW to CLOSED", () => {
    expect(isValidTransition("NEW", "CLOSED")).toBe(false);
  });

  it("should allow TRIAGED to ASSIGNED", () => {
    expect(isValidTransition("TRIAGED", "ASSIGNED")).toBe(true);
  });

  it("should allow ASSIGNED to IN_PROGRESS", () => {
    expect(isValidTransition("ASSIGNED", "IN_PROGRESS")).toBe(true);
  });

  it("should allow IN_PROGRESS to ON_HOLD", () => {
    expect(isValidTransition("IN_PROGRESS", "ON_HOLD")).toBe(true);
  });

  it("should allow ON_HOLD to IN_PROGRESS", () => {
    expect(isValidTransition("ON_HOLD", "IN_PROGRESS")).toBe(true);
  });

  it("should allow IN_PROGRESS to RESOLVED", () => {
    expect(isValidTransition("IN_PROGRESS", "RESOLVED")).toBe(true);
  });

  it("should allow RESOLVED to CLOSED", () => {
    expect(isValidTransition("RESOLVED", "CLOSED")).toBe(true);
  });

  it("should allow CLOSED to REOPENED", () => {
    expect(isValidTransition("CLOSED", "REOPENED")).toBe(true);
  });

  it("should allow REOPENED to move forward", () => {
    expect(isValidTransition("REOPENED", "TRIAGED")).toBe(true);
    expect(isValidTransition("REOPENED", "ASSIGNED")).toBe(true);
    expect(isValidTransition("REOPENED", "IN_PROGRESS")).toBe(true);
  });

  it("should reject CLOSED to NEW", () => {
    expect(isValidTransition("CLOSED", "NEW")).toBe(false);
  });

  it("should validate active and expired reopening windows", () => {
    const future = new Date(Date.now() + 100000);
    const past = new Date(Date.now() - 100000);

    expect(isReopenWindowActive(future)).toBe(true);
    expect(isReopenWindowActive(past)).toBe(false);
    expect(isReopenWindowActive(null)).toBe(false);
  });

  it("should support configurable reopening window duration", () => {
    expect(getReopenWindowDurationMs()).toBeGreaterThan(0);
  });
});
