
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import prisma from "../src/lib/prisma";
import { seedDatabase } from "../src/scripts/seed";

describe("CR-1: Ticket Merge", () => {
  let adminToken: string;
  let adminId: string;
  let originalTicketId: string;
  let duplicateTicketId: string;
  let propertyId: string;
  let unitId: string;

  beforeAll(async () => {
    await seedDatabase();

    const login = await request(app).post("/api/v1/auth/login").send({
      email: "admin@acme.com",
      password: "Password123!",
    });

    expect(login.status).toBe(200);
    adminToken = login.body.data.token;

    // Fetch admin ID directly from database
    const admin = await prisma.user.findFirst({
      where: {
        email: "admin@acme.com",
      },
    });

    if (!admin) {
      throw new Error("Admin user not found in database");
    }

    adminId = admin.id;

    const property = await prisma.property.findFirst({
      where: {
        name: "Acme Tower",
        organisation: {
          name: "Acme Facilities Management",
        },
      },
    });

    if (!property) {
      throw new Error("Acme Tower property not found");
    }

    propertyId = property.id;

    const unit = await prisma.unit.findFirst({
      where: {
        unitNumber: "101",
        propertyId: property.id,
        organisationId: property.organisationId,
      },
    });

    if (!unit) {
      throw new Error("Unit 101 not found");
    }

    unitId = unit.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("should merge duplicate ticket and transfer comments and watchers", async () => {
    // Create original ticket
    const original = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Original ticket for merge",
        description: "Original ticket description",
        priority: "MEDIUM",
        category: "General",
        propertyId,
        unitId,
      });

    expect(original.status).toBe(201);
    originalTicketId = original.body.data.ticket.id;

    // Create duplicate ticket
    const duplicate = await request(app)
      .post("/api/v1/tickets")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        title: "Duplicate ticket for merge",
        description: "Duplicate ticket description",
        priority: "MEDIUM",
        category: "General",
        propertyId,
        unitId,
      });

    expect(duplicate.status).toBe(201);
    duplicateTicketId = duplicate.body.data.ticket.id;

    const organisationId = duplicate.body.data.ticket.organisationId;

    // Create a comment on duplicate ticket
    const comment = await prisma.comment.create({
      data: {
        organisationId,
        ticketId: duplicateTicketId,
        authorId: adminId,
        message: "Comment that should move to original ticket",
      },
    });

    // Add watcher to duplicate ticket
    await prisma.ticketWatcher.create({
      data: {
        organisationId,
        ticketId: duplicateTicketId,
        userId: adminId,
      },
    });

    // Merge duplicate into original
    const merge = await request(app)
      .post(`/api/v1/tickets/${originalTicketId}/merge`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ duplicateTicketId });

    expect(merge.status).toBe(200);

    // Verify duplicate ticket is closed and linked to original
    const mergedDuplicate = await prisma.ticket.findFirst({
      where: {
        id: duplicateTicketId,
        organisationId,
      },
    });

    expect(mergedDuplicate?.status).toBe("CLOSED");
    expect(mergedDuplicate?.mergedIntoId).toBe(originalTicketId);

    // Verify comment moved to original ticket
    const movedComment = await prisma.comment.findUnique({
      where: {
        id: comment.id,
      },
    });

    expect(movedComment?.ticketId).toBe(originalTicketId);
    expect(movedComment?.message).toBe(
      "Comment that should move to original ticket"
    );
    expect(movedComment?.authorId).toBe(adminId);

    // Verify no comments remain on duplicate ticket
    const remainingComments = await prisma.comment.count({
      where: {
        ticketId: duplicateTicketId,
        organisationId,
      },
    });

    expect(remainingComments).toBe(0);

    // Verify watcher moved to original ticket
    const movedWatcher = await prisma.ticketWatcher.findFirst({
      where: {
        ticketId: originalTicketId,
        userId: adminId,
        organisationId,
      },
    });

    expect(movedWatcher).not.toBeNull();

    // Verify no watchers remain on duplicate ticket
    const remainingWatchers = await prisma.ticketWatcher.count({
      where: {
        ticketId: duplicateTicketId,
        organisationId,
      },
    });

    expect(remainingWatchers).toBe(0);
  });
});
