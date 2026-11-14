import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import prisma from "../src/lib/prisma";
import { seedDatabase } from "../src/scripts/seed";
import { signToken } from "../src/utils/jwt";

describe("DeskOps API & Multi-Tenant Isolation Test Suite", () => {
  let orgAToken: string;
  let orgBToken: string;
  let orgATicketId: string;
  let orgBTicketId: string;

  beforeAll(async () => {
    // Ensure test data exists
    await seedDatabase();

    // Fetch seeded ticket IDs
    const ticketA = await prisma.ticket.findFirst({
      where: { title: "Leaking faucet in bathroom" },
    });
    const ticketB = await prisma.ticket.findFirst({
      where: { title: "HVAC cooling failure" },
    });

    expect(ticketA).toBeDefined();
    expect(ticketB).toBeDefined();

    orgATicketId = ticketA!.id;
    orgBTicketId = ticketB!.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("1. Health & Readiness Checks", () => {
    it("GET /health should return 200 and running status", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.message).toContain("running");
    });

    it("GET /ready should return 200 and readiness status", async () => {
      const res = await request(app).get("/ready");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.ready).toBe(true);
    });

    it("GET /health/db should return 200 and database connected message", async () => {
      const res = await request(app).get("/health/db");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.connected).toBe(true);
    });
  });

  describe("2. Authentication Flows", () => {
    it("POST /api/v1/auth/login should fail with invalid password", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "admin@acme.com",
        password: "WrongPassword999!",
      });

      expect(res.status).toBe(401);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Invalid email or password");
    });

    it("POST /api/v1/auth/login should fail with non-existent email", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "unknown@nobody.com",
        password: "Password123!",
      });

      expect(res.status).toBe(401);
      expect(res.body.status).toBe("error");
    });

    it("POST /api/v1/auth/login should reject malformed payload", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "not-an-email",
        password: "",
      });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Validation failed");
    });

    it("POST /api/v1/auth/login should succeed for Org A Admin", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "admin@acme.com",
        password: "Password123!",
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe("admin@acme.com");
      expect(res.body.data.user.organisation.name).toBe("Acme Facilities Management");

      orgAToken = res.body.data.token;
    });

    it("POST /api/v1/auth/login should succeed for Org B Admin", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({
        email: "admin@apex.com",
        password: "Password123!",
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.email).toBe("admin@apex.com");
      expect(res.body.data.user.organisation.name).toBe("Apex Property Holdings");

      orgBToken = res.body.data.token;
    });

    it("GET /api/v1/auth/me should reject unauthenticated requests", async () => {
      const res = await request(app).get("/api/v1/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.status).toBe("error");
    });

    it("GET /api/v1/auth/me should return user details with valid token", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${orgAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.user.email).toBe("admin@acme.com");
      expect(res.body.data.user.organisation.name).toBe("Acme Facilities Management");
    });

    it("POST /api/v1/auth/logout should return success", async () => {
      const res = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${orgAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
    });

    it("signToken must throw an error in production if JWT_SECRET is unset", () => {
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.JWT_SECRET;
      try {
        process.env.NODE_ENV = "production";
        delete process.env.JWT_SECRET;
        expect(() =>
          signToken({
            id: "test",
            email: "test@example.com",
            name: "Test",
            role: "RESIDENT" as any,
            organisationId: "test-org",
          })
        ).toThrow("FATAL: JWT_SECRET environment variable is mandatory in production.");
      } finally {
        process.env.NODE_ENV = originalEnv;
        if (originalSecret) process.env.JWT_SECRET = originalSecret;
      }
    });
  });

  describe("3. Multi-Tenant Isolation (NFR-01)", () => {
    it("Unauthenticated request to tenant endpoint must be rejected", async () => {
      const res = await request(app).get("/api/v1/organisation");
      expect(res.status).toBe(401);
    });

    it("Org A user can only access Org A organisation information", async () => {
      const res = await request(app)
        .get("/api/v1/organisation")
        .set("Authorization", `Bearer ${orgAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.organisation.name).toBe("Acme Facilities Management");
    });

    it("Org B user can only access Org B organisation information", async () => {
      const res = await request(app)
        .get("/api/v1/organisation")
        .set("Authorization", `Bearer ${orgBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.organisation.name).toBe("Apex Property Holdings");
    });

    it("Org A user can list Org A tickets, but cannot see Org B tickets", async () => {
      const res = await request(app)
        .get("/api/v1/tickets")
        .set("Authorization", `Bearer ${orgAToken}`);

      expect(res.status).toBe(200);
      const tickets = res.body.data.tickets;
      expect(tickets.length).toBeGreaterThan(0);

      // Verify all tickets belong exclusively to Org A
      const hasFaucetTicket = tickets.some((t: any) => t.title === "Leaking faucet in bathroom");
      const hasHvacTicket = tickets.some((t: any) => t.title === "HVAC cooling failure");

      expect(hasFaucetTicket).toBe(true);
      expect(hasHvacTicket).toBe(false);
    });

    it("Org B user can list Org B tickets, but cannot see Org A tickets", async () => {
      const res = await request(app)
        .get("/api/v1/tickets")
        .set("Authorization", `Bearer ${orgBToken}`);

      expect(res.status).toBe(200);
      const tickets = res.body.data.tickets;
      expect(tickets.length).toBeGreaterThan(0);

      const hasFaucetTicket = tickets.some((t: any) => t.title === "Leaking faucet in bathroom");
      const hasHvacTicket = tickets.some((t: any) => t.title === "HVAC cooling failure");

      expect(hasHvacTicket).toBe(true);
      expect(hasFaucetTicket).toBe(false);
    });

    it("Org A user querying Org B's ticket ID must receive 404 Not Found (Cross-tenant isolation)", async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${orgBTicketId}`)
        .set("Authorization", `Bearer ${orgAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Ticket not found");
    });

    it("Org B user querying Org A's ticket ID must receive 404 Not Found (Cross-tenant isolation)", async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${orgATicketId}`)
        .set("Authorization", `Bearer ${orgBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Ticket not found");
    });

    it("Attempting cross-tenant spoofing in request body must be rejected with 403 Forbidden", async () => {
      const res = await request(app)
        .post("/api/v1/organisation")
        .set("Authorization", `Bearer ${orgAToken}`)
        .send({
          organisationId: "some-other-organisation-id",
        });

      expect(res.status).toBe(403);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Cross-tenant access attempted");
    });
  });
});
