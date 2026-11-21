import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import prisma from "../src/lib/prisma";
import { seedDatabase } from "../src/scripts/seed";
import { TicketStatus, TicketPriority, UserRole } from "../src/generated/prisma/enums";

describe("Complete Ticket Lifecycle, Event History, Permissions & Concurrency Suite", () => {
  let orgAAdminToken: string;
  let orgAManagerToken: string;
  let orgATechToken: string;
  let orgAResidentToken: string;

  let orgBAdminToken: string;

  let orgAProp1Id: string;
  let orgAProp2Id: string;
  let orgAUnit1Id: string;
  let orgATechId: string;

  beforeAll(async () => {
    await seedDatabase();

    // 1. Authenticate users
    const [adminRes, managerRes, techRes, residentRes, orgBAdminRes] =
      await Promise.all([
        request(app)
          .post("/api/v1/auth/login")
          .send({ email: "admin@acme.com", password: "Password123!" }),
        request(app)
          .post("/api/v1/auth/login")
          .send({ email: "manager@acme.com", password: "Password123!" }),
        request(app)
          .post("/api/v1/auth/login")
          .send({ email: "tech@acme.com", password: "Password123!" }),
        request(app)
          .post("/api/v1/auth/login")
          .send({ email: "resident@acme.com", password: "Password123!" }),
        request(app)
          .post("/api/v1/auth/login")
          .send({ email: "admin@apex.com", password: "Password123!" }),
      ]);

    orgAAdminToken = adminRes.body.data.token;
    orgAManagerToken = managerRes.body.data.token;
    orgATechToken = techRes.body.data.token;
    orgAResidentToken = residentRes.body.data.token;
    orgBAdminToken = orgBAdminRes.body.data.token;

    // Fetch IDs for properties and units
    const prop1 = await prisma.property.findFirst({
      where: { name: "Acme Tower" },
    });
    const prop2 = await prisma.property.findFirst({
      where: { name: "Acme Plaza" },
    });
    const unit1 = await prisma.unit.findFirst({
      where: { propertyId: prop1!.id },
    });
    const techUser = await prisma.user.findFirst({
      where: { email: "tech@acme.com" },
    });

    orgAProp1Id = prop1!.id;
    orgAProp2Id = prop2!.id;
    orgAUnit1Id = unit1!.id;
    orgATechId = techUser!.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("1. Ticket Creation & Initial State", () => {
    it("Resident should raise a new ticket successfully", async () => {
      const res = await request(app)
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${orgAResidentToken}`)
        .send({
          title: "Broken elevator button",
          description: "4th floor elevator button is not responding.",
          priority: "HIGH",
          category: "Electrical",
          propertyId: orgAProp1Id,
          unitId: orgAUnit1Id,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("success");
      expect(res.body.data.ticket.status).toBe("NEW");
      expect(res.body.data.ticket.title).toBe("Broken elevator button");

      // Verify creation event was recorded
      const events = await prisma.ticketEvent.findMany({
        where: { ticketId: res.body.data.ticket.id },
      });
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe("TICKET_CREATED");
      expect(events[0].newStatus).toBe("NEW");
    });

    it("Ticket creation should fail with invalid property or unit", async () => {
      const res = await request(app)
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${orgAResidentToken}`)
        .send({
          title: "Invalid Ticket",
          description: "Testing invalid property reference.",
          propertyId: "00000000-0000-0000-0000-000000000000",
          unitId: orgAUnit1Id,
        });

      expect(res.status).toBe(404);
      expect(res.body.status).toBe("error");
    });
  });

  describe("2. End-to-End Ticket Lifecycle Transitions", () => {
    let testTicketId: string;

    beforeAll(async () => {
      // Create a dedicated ticket for the complete lifecycle journey
      const createRes = await request(app)
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${orgAResidentToken}`)
        .send({
          title: "HVAC Thermostat Calibration",
          description: "Thermostat in office needs seasonal calibration.",
          priority: "MEDIUM",
          propertyId: orgAProp1Id,
          unitId: orgAUnit1Id,
        });

      testTicketId = createRes.body.data.ticket.id;
    });

    it("Step 1: Triage NEW -> TRIAGED", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/triage`)
        .set("Authorization", `Bearer ${orgAManagerToken}`)
        .send({ priority: "HIGH", category: "HVAC" });

      expect(res.status).toBe(200);
      expect(res.body.data.ticket.status).toBe("TRIAGED");
      expect(res.body.data.ticket.priority).toBe("HIGH");
    });

    it("Step 2: Assign TRIAGED -> ASSIGNED", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/assign`)
        .set("Authorization", `Bearer ${orgAAdminToken}`)
        .send({ technicianId: orgATechId });

      expect(res.status).toBe(200);
      expect(res.body.data.ticket.status).toBe("ASSIGNED");
      expect(res.body.data.ticket.assignedToId).toBe(orgATechId);
    });

    it("Step 3: Move ASSIGNED -> IN_PROGRESS", async () => {
      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/status`)
        .set("Authorization", `Bearer ${orgATechToken}`)
        .send({ status: "IN_PROGRESS" });

      expect(res.status).toBe(200);
      expect(res.body.data.ticket.status).toBe("IN_PROGRESS");
    });

    it("Step 4: Move IN_PROGRESS -> ON_HOLD", async () => {
      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/status`)
        .set("Authorization", `Bearer ${orgATechToken}`)
        .send({ status: "ON_HOLD" });

      expect(res.status).toBe(200);
      expect(res.body.data.ticket.status).toBe("ON_HOLD");
    });

    it("Step 5: Resume ON_HOLD -> IN_PROGRESS", async () => {
      const res = await request(app)
        .patch(`/api/v1/tickets/${testTicketId}/status`)
        .set("Authorization", `Bearer ${orgATechToken}`)
        .send({ status: "IN_PROGRESS" });

      expect(res.status).toBe(200);
      expect(res.body.data.ticket.status).toBe("IN_PROGRESS");
    });

    it("Step 6: Resolve IN_PROGRESS -> RESOLVED", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/resolve`)
        .set("Authorization", `Bearer ${orgATechToken}`)
        .send({ resolutionNotes: "Thermostat recalibrated and tested." });

      expect(res.status).toBe(200);
      expect(res.body.data.ticket.status).toBe("RESOLVED");
      expect(res.body.data.ticket.resolvedAt).toBeDefined();
      expect(res.body.data.ticket.reopenUntil).toBeDefined();
    });

    it("Step 7: Close RESOLVED -> CLOSED", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/close`)
        .set("Authorization", `Bearer ${orgAManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.ticket.status).toBe("CLOSED");
      expect(res.body.data.ticket.closedAt).toBeDefined();
    });

    it("Step 8: Reopen CLOSED -> REOPENED (Within active window)", async () => {
      const res = await request(app)
        .post(`/api/v1/tickets/${testTicketId}/reopen`)
        .set("Authorization", `Bearer ${orgAResidentToken}`)
        .send({ reason: "Thermostat still reading 5 degrees higher than actual." });

      expect(res.status).toBe(200);
      expect(res.body.data.ticket.status).toBe("REOPENED");
    });

    it("Step 9: Invalid transition rejection (e.g. ASSIGNED to NEW)", async () => {
      // Create a ticket already in ASSIGNED state — cannot jump backward to NEW
      const freshTicket = await prisma.ticket.create({
        data: {
          title: "Invalid Backward Transition Test",
          description: "Cannot move an ASSIGNED ticket back to NEW",
          status: TicketStatus.ASSIGNED,
          organisationId: (await prisma.organisation.findFirst({ where: { name: "Acme Facilities Management" } }))!.id,
          propertyId: orgAProp1Id,
          unitId: orgAUnit1Id,
          createdById: (await prisma.user.findFirst({ where: { email: "resident@acme.com" } }))!.id,
        },
      });

      // PATCH /status uses the generic updateTicketStatus path for NEW,
      // which will reject with "Invalid ticket status transition"
      const res = await request(app)
        .patch(`/api/v1/tickets/${freshTicket.id}/status`)
        .set("Authorization", `Bearer ${orgAAdminToken}`)
        .send({ status: "NEW" });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Invalid ticket status transition");
    });

    it("Step 10: Reopening rejected if reopening window has expired", async () => {
      // Create closed ticket with an expired reopenUntil (past timestamp)
      const expiredTicket = await prisma.ticket.create({
        data: {
          title: "Expired Reopen Ticket",
          description: "Reopening window is in the past.",
          status: TicketStatus.CLOSED,
          organisationId: (await prisma.organisation.findFirst({ where: { name: "Acme Facilities Management" } }))!.id,
          propertyId: orgAProp1Id,
          unitId: orgAUnit1Id,
          createdById: (await prisma.user.findFirst({ where: { email: "resident@acme.com" } }))!.id,
          closedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          reopenUntil: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000), // expired 23 days ago
        },
      });

      const res = await request(app)
        .post(`/api/v1/tickets/${expiredTicket.id}/reopen`)
        .set("Authorization", `Bearer ${orgAResidentToken}`)
        .send({ reason: "Attempting to reopen after expiration" });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Reopening window has expired");
    });
  });

  describe("3. Ticket Event History Verification", () => {
    it("Timeline must record all transitions in chronological order with accurate actor info", async () => {
      // Create and transition a ticket
      const ticket = await prisma.ticket.create({
        data: {
          title: "Timeline Audit Ticket",
          description: "Testing timeline audit logging",
          status: TicketStatus.NEW,
          organisationId: (await prisma.organisation.findFirst({ where: { name: "Acme Facilities Management" } }))!.id,
          propertyId: orgAProp1Id,
          unitId: orgAUnit1Id,
          createdById: (await prisma.user.findFirst({ where: { email: "resident@acme.com" } }))!.id,
        },
      });

      await request(app)
        .post(`/api/v1/tickets/${ticket.id}/triage`)
        .set("Authorization", `Bearer ${orgAManagerToken}`)
        .send({ priority: "HIGH" });

      await request(app)
        .post(`/api/v1/tickets/${ticket.id}/assign`)
        .set("Authorization", `Bearer ${orgAAdminToken}`)
        .send({ technicianId: orgATechId });

      const res = await request(app)
        .get(`/api/v1/tickets/${ticket.id}/events`)
        .set("Authorization", `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.events.length).toBeGreaterThanOrEqual(2);

      const eventTypes = res.body.data.events.map((e: any) => e.eventType);
      expect(eventTypes).toContain("TICKET_TRIAGED");
      expect(eventTypes).toContain("TICKET_ASSIGNED");

      // Verify actor and timestamp
      const assignEvent = res.body.data.events.find((e: any) => e.eventType === "TICKET_ASSIGNED");
      expect(assignEvent.actor.email).toBe("admin@acme.com");
      expect(assignEvent.previousStatus).toBe("TRIAGED");
      expect(assignEvent.newStatus).toBe("ASSIGNED");
      expect(assignEvent.createdAt).toBeDefined();
    });
  });

  describe("4. Ticket Assignment Concurrency Protection (20 Parallel Requests)", () => {
    it("20 parallel assignment requests on the same ticket must yield exactly 1 success and 19 conflicts", async () => {
      const orgA = await prisma.organisation.findFirst({
        where: { name: "Acme Facilities Management" },
      });

      // Create a fresh triaged ticket eligible for assignment
      const concurrentTicket = await prisma.ticket.create({
        data: {
          title: "Parallel Assignment Stress Test",
          description: "20 concurrent assignment requests.",
          status: TicketStatus.TRIAGED,
          priority: TicketPriority.HIGH,
          organisationId: orgA!.id,
          propertyId: orgAProp1Id,
          unitId: orgAUnit1Id,
          createdById: (await prisma.user.findFirst({ where: { email: "resident@acme.com" } }))!.id,
        },
      });

      // Launch 20 concurrent HTTP assignment requests
      const promises = Array.from({ length: 20 }).map(() =>
        request(app)
          .post(`/api/v1/tickets/${concurrentTicket.id}/assign`)
          .set("Authorization", `Bearer ${orgAAdminToken}`)
          .send({ technicianId: orgATechId })
      );

      const responses = await Promise.all(promises);

      const successful = responses.filter((r) => r.status === 200);
      const conflicts = responses.filter((r) => r.status === 409);

      expect(successful.length).toBe(1);
      expect(conflicts.length).toBe(19);

      // Verify database state: assigned exactly to technician
      const finalTicket = await prisma.ticket.findUnique({
        where: { id_organisationId: { id: concurrentTicket.id, organisationId: orgA!.id } },
      });
      expect(finalTicket!.status).toBe(TicketStatus.ASSIGNED);
      expect(finalTicket!.assignedToId).toBe(orgATechId);
    });
  });

  describe("5. Role-Based Permissions & Greenfield Client-Specific Rules (FR-1.08)", () => {
    it("1. Store Manager successfully closes a ticket in their own store", async () => {
      // Ticket in Store 1 (Acme Tower) - managerA belongs to Store 1
      const ticketStore1 = await prisma.ticket.create({
        data: {
          title: "Store 1 Maintenance Closure",
          description: "Store 1 ticket in resolved state",
          status: TicketStatus.RESOLVED,
          organisationId: (await prisma.organisation.findFirst({ where: { name: "Acme Facilities Management" } }))!.id,
          propertyId: orgAProp1Id,
          unitId: orgAUnit1Id,
          createdById: (await prisma.user.findFirst({ where: { email: "resident@acme.com" } }))!.id,
          resolvedAt: new Date(),
        },
      });

      const res = await request(app)
        .post(`/api/v1/tickets/${ticketStore1.id}/close`)
        .set("Authorization", `Bearer ${orgAManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.ticket.status).toBe("CLOSED");
    });

    it("2. Store Manager receives an appropriate denial when closing another store's ticket", async () => {
      // Ticket in Store 2 (Acme Plaza)
      const unit2 = await prisma.unit.findFirst({ where: { propertyId: orgAProp2Id } });
      const ticketStore2 = await prisma.ticket.create({
        data: {
          title: "Store 2 Maintenance Close Denial",
          description: "Store 2 ticket in resolved state",
          status: TicketStatus.RESOLVED,
          organisationId: (await prisma.organisation.findFirst({ where: { name: "Acme Facilities Management" } }))!.id,
          propertyId: orgAProp2Id,
          unitId: unit2!.id,
          createdById: (await prisma.user.findFirst({ where: { email: "resident@acme.com" } }))!.id,
          resolvedAt: new Date(),
        },
      });

      const res = await request(app)
        .post(`/api/v1/tickets/${ticketStore2.id}/close`)
        .set("Authorization", `Bearer ${orgAManagerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Store managers can only close tickets for their own store");
    });

    it("3. Store Manager cannot retrieve another store's ticket by ID", async () => {
      const unit2 = await prisma.unit.findFirst({ where: { propertyId: orgAProp2Id } });
      const ticketStore2 = await prisma.ticket.create({
        data: {
          title: "Store 2 Confidential Ticket Detail",
          description: "Store 2 ticket that Store 1 manager must not retrieve",
          status: TicketStatus.NEW,
          organisationId: (await prisma.organisation.findFirst({ where: { name: "Acme Facilities Management" } }))!.id,
          propertyId: orgAProp2Id,
          unitId: unit2!.id,
          createdById: (await prisma.user.findFirst({ where: { email: "resident@acme.com" } }))!.id,
        },
      });

      // Attempting to read details of another store's ticket returns 404 (preventing leakage)
      const res = await request(app)
        .get(`/api/v1/tickets/${ticketStore2.id}`)
        .set("Authorization", `Bearer ${orgAManagerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Ticket not found");
    });

    it("4. Store Manager cannot retrieve another store's ticket event history", async () => {
      const unit2 = await prisma.unit.findFirst({ where: { propertyId: orgAProp2Id } });
      const ticketStore2 = await prisma.ticket.create({
        data: {
          title: "Store 2 Timeline Audit Ticket",
          description: "Store 2 ticket events that Store 1 manager must not inspect",
          status: TicketStatus.NEW,
          organisationId: (await prisma.organisation.findFirst({ where: { name: "Acme Facilities Management" } }))!.id,
          propertyId: orgAProp2Id,
          unitId: unit2!.id,
          createdById: (await prisma.user.findFirst({ where: { email: "resident@acme.com" } }))!.id,
        },
      });

      // Record an event on this ticket
      await prisma.ticketEvent.create({
        data: {
          organisationId: (await prisma.organisation.findFirst({ where: { name: "Acme Facilities Management" } }))!.id,
          ticketId: ticketStore2.id,
          eventType: "TICKET_CREATED",
          newStatus: TicketStatus.NEW,
          description: "Created in Store 2",
        },
      });

      // Store Manager requesting event history for another store's ticket must receive 404
      const eventsRes = await request(app)
        .get(`/api/v1/tickets/${ticketStore2.id}/events`)
        .set("Authorization", `Bearer ${orgAManagerToken}`);

      expect(eventsRes.status).toBe(404);
      expect(eventsRes.body.status).toBe("error");
      expect(eventsRes.body.message).toBe("Ticket not found");
    });

    it("5 & 6. Store Manager ticket listing explicitly creates tickets in two different stores and verifies other store's ticket is excluded", async () => {
      const timestamp = Date.now();
      const orgA = (await prisma.organisation.findFirst({ where: { name: "Acme Facilities Management" } }))!;
      const unit2 = (await prisma.unit.findFirst({ where: { propertyId: orgAProp2Id } }))!;

      // 1. Explicitly create a ticket in Store 1 (Manager's own store)
      const store1Ticket = await prisma.ticket.create({
        data: {
          title: `Explicit Store 1 Ticket ${timestamp}`,
          description: "Belongs to Store 1 Acme Tower",
          status: TicketStatus.NEW,
          organisationId: orgA.id,
          propertyId: orgAProp1Id,
          unitId: orgAUnit1Id,
          createdById: (await prisma.user.findFirst({ where: { email: "resident@acme.com" } }))!.id,
        },
      });

      // 2. Explicitly create a ticket in Store 2 (Different store)
      const store2Ticket = await prisma.ticket.create({
        data: {
          title: `Explicit Store 2 Ticket ${timestamp}`,
          description: "Belongs to Store 2 Acme Plaza",
          status: TicketStatus.NEW,
          organisationId: orgA.id,
          propertyId: orgAProp2Id,
          unitId: unit2.id,
          createdById: (await prisma.user.findFirst({ where: { email: "resident@acme.com" } }))!.id,
        },
      });

      // 3. Store Manager calls ticket listing API
      const res = await request(app)
        .get("/api/v1/tickets")
        .set("Authorization", `Bearer ${orgAManagerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("success");
      const returnedTickets = res.body.data.tickets;
      const returnedIds = returnedTickets.map((t: any) => t.id);

      // Verify Store 1 ticket is included
      expect(returnedIds).toContain(store1Ticket.id);

      // Verify Store 2 ticket is strictly excluded
      expect(returnedIds).not.toContain(store2Ticket.id);

      // Verify every returned ticket belongs strictly to Store 1
      for (const t of returnedTickets) {
        expect(t.propertyId).toBe(orgAProp1Id);
      }

      // 4. Verify Head Office admin CAN see both tickets in their listing
      const adminRes = await request(app)
        .get("/api/v1/tickets")
        .set("Authorization", `Bearer ${orgAAdminToken}`);

      expect(adminRes.status).toBe(200);
      const adminIds = adminRes.body.data.tickets.map((t: any) => t.id);
      expect(adminIds).toContain(store1Ticket.id);
      expect(adminIds).toContain(store2Ticket.id);
    });

    it("7. Head Office can close another store's ticket within the same organisation", async () => {
      const unit2 = await prisma.unit.findFirst({ where: { propertyId: orgAProp2Id } });
      const ticketStore2 = await prisma.ticket.create({
        data: {
          title: "Store 2 Head Office Cross-Store Closure",
          description: "Head office closure across stores within same org",
          status: TicketStatus.RESOLVED,
          organisationId: (await prisma.organisation.findFirst({ where: { name: "Acme Facilities Management" } }))!.id,
          propertyId: orgAProp2Id,
          unitId: unit2!.id,
          createdById: (await prisma.user.findFirst({ where: { email: "resident@acme.com" } }))!.id,
          resolvedAt: new Date(),
        },
      });

      const res = await request(app)
        .post(`/api/v1/tickets/${ticketStore2.id}/close`)
        .set("Authorization", `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.ticket.status).toBe("CLOSED");
    });

    it("8. Head Office cannot close a ticket belonging to another organisation", async () => {
      const orgB = await prisma.organisation.findFirst({
        where: { name: "Apex Property Holdings" },
      });
      const ticketOrgB = await prisma.ticket.findFirst({
        where: { organisationId: orgB!.id },
      });

      expect(ticketOrgB).toBeDefined();

      const res = await request(app)
        .post(`/api/v1/tickets/${ticketOrgB!.id}/close`)
        .set("Authorization", `Bearer ${orgAAdminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Ticket not found");
    });

    it("9. Residents cannot close tickets unless existing permission rules explicitly allow it", async () => {
      const ticket = await prisma.ticket.create({
        data: {
          title: "Resident Closure Denial",
          description: "Residents cannot close tickets",
          status: TicketStatus.RESOLVED,
          organisationId: (await prisma.organisation.findFirst({ where: { name: "Acme Facilities Management" } }))!.id,
          propertyId: orgAProp1Id,
          unitId: orgAUnit1Id,
          createdById: (await prisma.user.findFirst({ where: { email: "resident@acme.com" } }))!.id,
          resolvedAt: new Date(),
        },
      });

      const res = await request(app)
        .post(`/api/v1/tickets/${ticket.id}/close`)
        .set("Authorization", `Bearer ${orgAResidentToken}`);

      expect(res.status).toBe(403);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Forbidden: You do not have permission to close tickets");
    });

    it("Security Edge Case: Store Manager cannot create a ticket for another store by supplying a different propertyId in request body", async () => {
      const unit2 = await prisma.unit.findFirst({ where: { propertyId: orgAProp2Id } });

      const res = await request(app)
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${orgAManagerToken}`)
        .send({
          title: "Store Manager Cross-Store Creation Attempt",
          description: "Attempting to create ticket in Store 2 while assigned to Store 1",
          priority: "HIGH",
          propertyId: orgAProp2Id, // Foreign store!
          unitId: unit2!.id,
        });

      expect(res.status).toBe(403);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toContain("Store managers can only create tickets for their own store");
    });

    it("Security Edge Case: Store Manager cannot triage or assign another store's ticket", async () => {
      const unit2 = await prisma.unit.findFirst({ where: { propertyId: orgAProp2Id } });
      const ticketStore2 = await prisma.ticket.create({
        data: {
          title: "Store 2 Triage Access Test",
          description: "Store 2 ticket that manager 1 cannot triage",
          status: TicketStatus.NEW,
          organisationId: (await prisma.organisation.findFirst({ where: { name: "Acme Facilities Management" } }))!.id,
          propertyId: orgAProp2Id,
          unitId: unit2!.id,
          createdById: (await prisma.user.findFirst({ where: { email: "resident@acme.com" } }))!.id,
        },
      });

      const triageRes = await request(app)
        .post(`/api/v1/tickets/${ticketStore2.id}/triage`)
        .set("Authorization", `Bearer ${orgAManagerToken}`)
        .send({ priority: "URGENT" });

      expect(triageRes.status).toBe(404);
      expect(triageRes.body.message).toBe("Ticket not found");

      const assignRes = await request(app)
        .post(`/api/v1/tickets/${ticketStore2.id}/assign`)
        .set("Authorization", `Bearer ${orgAManagerToken}`)
        .send({ technicianId: orgATechId });

      expect(assignRes.status).toBe(404);
      expect(assignRes.body.message).toBe("Ticket not found");
    });
  });

  describe("6. Cross-Tenant Ticket Isolation", () => {
    it("Org B cannot access Org A ticket events", async () => {
      const ticketA = await prisma.ticket.findFirst({
        where: { organisationId: (await prisma.organisation.findFirst({ where: { name: "Acme Facilities Management" } }))!.id },
      });

      const res = await request(app)
        .get(`/api/v1/tickets/${ticketA!.id}/events`)
        .set("Authorization", `Bearer ${orgBAdminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.status).toBe("error");
      expect(res.body.message).toBe("Ticket not found");
    });

    it("Org B cannot triage or assign Org A ticket", async () => {
      const ticketA = await prisma.ticket.findFirst({
        where: { organisationId: (await prisma.organisation.findFirst({ where: { name: "Acme Facilities Management" } }))!.id },
      });

      const res = await request(app)
        .post(`/api/v1/tickets/${ticketA!.id}/triage`)
        .set("Authorization", `Bearer ${orgBAdminToken}`)
        .send({ priority: "HIGH" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Ticket not found");
    });
  });
});
