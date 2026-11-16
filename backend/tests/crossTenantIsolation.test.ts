import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import prisma from "../src/lib/prisma";
import { hashPassword } from "../src/utils/password";
import { TicketStatus, TicketPriority, UserRole } from "../src/generated/prisma/enums";

describe("Strict Cross-Tenant Database & API Isolation Suite (NFR-01)", () => {
  let orgA: any;
  let orgB: any;
  let propA: any;
  let propB: any;
  let unitA: any;
  let unitB: any;
  let userA: any;
  let userB: any;
  let ticketA: any;
  let ticketB: any;

  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    const passwordHash = await hashPassword("TestPassword123!");

    // 1. Create Organisation A and Organisation B
    orgA = await prisma.organisation.create({
      data: { name: `Isolation Tenant A ${timestamp}` },
    });

    orgB = await prisma.organisation.create({
      data: { name: `Isolation Tenant B ${timestamp}` },
    });

    // 2. Create Properties and Units for each organisation
    propA = await prisma.property.create({
      data: {
        name: `Property A ${timestamp}`,
        address: "100 Tenant A Blvd",
        organisationId: orgA.id,
      },
    });

    propB = await prisma.property.create({
      data: {
        name: `Property B ${timestamp}`,
        address: "200 Tenant B Way",
        organisationId: orgB.id,
      },
    });

    unitA = await prisma.unit.create({
      data: {
        unitNumber: "101-A",
        propertyId: propA.id,
        organisationId: orgA.id,
      },
    });

    unitB = await prisma.unit.create({
      data: {
        unitNumber: "201-B",
        propertyId: propB.id,
        organisationId: orgB.id,
      },
    });

    // 3. Create authenticated users for each organisation
    userA = await prisma.user.create({
      data: {
        name: "Alice Tenant A Admin",
        email: `alice.${timestamp}@tenant-a.com`,
        password: passwordHash,
        role: UserRole.ORG_ADMIN,
        organisationId: orgA.id,
        unitId: unitA.id,
      },
    });

    userB = await prisma.user.create({
      data: {
        name: "Bob Tenant B Admin",
        email: `bob.${timestamp}@tenant-b.com`,
        password: passwordHash,
        role: UserRole.ORG_ADMIN,
        organisationId: orgB.id,
        unitId: unitB.id,
      },
    });

    // 4. Create Ticket belonging to Organisation A
    ticketA = await prisma.ticket.create({
      data: {
        title: "Confidential Tenant A Maintenance Request",
        description: "Private maintenance details for Organisation A only.",
        status: TicketStatus.NEW,
        priority: TicketPriority.MEDIUM,
        category: "Facilities",
        organisationId: orgA.id,
        propertyId: propA.id,
        unitId: unitA.id,
        createdById: userA.id,
      },
    });

    await prisma.ticketEvent.create({
      data: {
        organisationId: orgA.id,
        ticketId: ticketA.id,
        actorId: userA.id,
        eventType: "TICKET_CREATED",
        newStatus: TicketStatus.NEW,
        description: "Ticket created in Organisation A",
      },
    });

    // 5. Create Ticket belonging to Organisation B
    ticketB = await prisma.ticket.create({
      data: {
        title: "Confidential Tenant B Executive Server Issue",
        description: "Highly sensitive internal server outage for Organisation B only.",
        status: TicketStatus.NEW,
        priority: TicketPriority.URGENT,
        category: "IT Security",
        organisationId: orgB.id,
        propertyId: propB.id,
        unitId: unitB.id,
        createdById: userB.id,
      },
    });

    await prisma.ticketEvent.create({
      data: {
        organisationId: orgB.id,
        ticketId: ticketB.id,
        actorId: userB.id,
        eventType: "TICKET_CREATED",
        newStatus: TicketStatus.NEW,
        description: "Ticket created in Organisation B",
      },
    });

    // 6. Authenticate via actual auth endpoints
    const [resA, resB] = await Promise.all([
      request(app).post("/api/v1/auth/login").send({
        email: userA.email,
        password: "TestPassword123!",
      }),
      request(app).post("/api/v1/auth/login").send({
        email: userB.email,
        password: "TestPassword123!",
      }),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    tokenA = resA.body.data.token;
    tokenB = resB.body.data.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("Official Milestone Requirement (Step 4)", () => {
    it("Step 4.1: Requesting Organisation B's ticket ID as Organisation A must return HTTP 404", async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${ticketB.id}`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Ticket not found");
    });

    it("Step 4.2: Response must not expose any confidential information belonging to Organisation B", async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${ticketB.id}`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.data).toBeUndefined();
      const stringified = JSON.stringify(res.body);
      expect(stringified).not.toContain("Confidential Tenant B");
      expect(stringified).not.toContain("Executive Server Issue");
      expect(stringified).not.toContain("Highly sensitive");
      expect(stringified).not.toContain(orgB.id);
      expect(stringified).not.toContain(userB.email);
    });

    it("Step 4.3: Organisation A can successfully access its own ticket", async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${ticketA.id}`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      expect(res.body.data.ticket.id).toBe(ticketA.id);
      expect(res.body.data.ticket.title).toBe("Confidential Tenant A Maintenance Request");
      expect(res.body.data.ticket.organisationId).toBe(orgA.id);
    });

    it("Step 4.4: Organisation B can access its own ticket, but cannot access Organisation A's ticket", async () => {
      // Access own ticket
      const ownRes = await request(app)
        .get(`/api/v1/tickets/${ticketB.id}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(ownRes.status).toBe(200);
      expect(ownRes.body.data.ticket.id).toBe(ticketB.id);

      // Access cross-tenant ticket
      const crossRes = await request(app)
        .get(`/api/v1/tickets/${ticketA.id}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(crossRes.status).toBe(404);
      expect(crossRes.body.status).toBe("error");
      expect(crossRes.body.message).toBe("Ticket not found");
    });
  });

  describe("Cross-Tenant Ticket Listing & Event History Scoping", () => {
    it("Listing tickets only returns tickets belonging to the authenticated tenant", async () => {
      const res = await request(app)
        .get("/api/v1/tickets")
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      const tickets = res.body.data.tickets;
      const ids = tickets.map((t: any) => t.id);

      expect(ids).toContain(ticketA.id);
      expect(ids).not.toContain(ticketB.id);

      // Verify every returned ticket matches Org A's ID
      for (const t of tickets) {
        expect(t.organisationId).toBe(orgA.id);
      }
    });

    it("Attempting to read events for Organisation B's ticket must return 404", async () => {
      const res = await request(app)
        .get(`/api/v1/tickets/${ticketB.id}/events`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Ticket not found");
    });
  });

  describe("Cross-Tenant Lifecycle Action Prevention", () => {
    it("Organisation A cannot triage Organisation B's ticket", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${ticketB.id}/triage`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ priority: "HIGH" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Ticket not found");
    });

    it("Organisation A cannot assign Organisation B's ticket", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${ticketB.id}/assign`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ technicianId: userA.id });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Ticket not found");
    });

    it("Organisation A cannot update status of Organisation B's ticket", async () => {
      const res = await request(app)
        .patch(`/api/v1/tickets/${ticketB.id}/status`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ status: "IN_PROGRESS" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Ticket not found");
    });

    it("Organisation A cannot resolve Organisation B's ticket", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${ticketB.id}/resolve`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ resolutionNotes: "Malicious cross-tenant attempt" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Ticket not found");
    });

    it("Organisation A cannot close Organisation B's ticket", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${ticketB.id}/close`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Ticket not found");
    });

    it("Organisation A cannot reopen Organisation B's ticket", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${ticketB.id}/reopen`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ reason: "Malicious cross-tenant attempt" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Ticket not found");
    });
  });

  describe("Cross-Tenant Relational Traversal & Spoofing Prevention", () => {
    it("Creating a ticket in Org A referencing Org B's property must fail with 404", async () => {
      const res = await request(app)
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          title: "Malicious Cross-Tenant Property Ticket",
          description: "Attempting to attach ticket to another organisation's property",
          priority: "MEDIUM",
          propertyId: propB.id, // Belongs to Org B!
          unitId: unitA.id,
        });

      expect(res.status).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Property not found in organisation");
    });

    it("Creating a ticket in Org A referencing Org B's unit must fail with 404", async () => {
      const res = await request(app)
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          title: "Malicious Cross-Tenant Unit Ticket",
          description: "Attempting to attach ticket to another organisation's unit",
          priority: "MEDIUM",
          propertyId: propA.id,
          unitId: unitB.id, // Belongs to Org B!
        });

      expect(res.status).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Unit not found in property");
    });

    it("Attempting to spoof organisationId in request body must be rejected with 403", async () => {
      const res = await request(app)
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          title: "Spoofed Org Ticket",
          description: "Attempting body organisationId injection",
          organisationId: orgB.id, // Spoofed!
          propertyId: propA.id,
          unitId: unitA.id,
        });

      expect(res.status).toBe(403);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Forbidden: Cross-tenant access attempted");
    });

    it("Attempting to spoof organisationId in query parameters must be rejected with 403", async () => {
      const res = await request(app)
        .get(`/api/v1/tickets?organisationId=${orgB.id}`)
        .set("Authorization", `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Forbidden: Cross-tenant access attempted");
    });

    it("Attempting to spoof organisationId in x-organisation-id header must be rejected with 403", async () => {
      const res = await request(app)
        .get("/api/v1/tickets")
        .set("Authorization", `Bearer ${tokenA}`)
        .set("x-organisation-id", orgB.id);

      expect(res.status).toBe(403);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Forbidden: Cross-tenant access attempted");
    });
  });
});
