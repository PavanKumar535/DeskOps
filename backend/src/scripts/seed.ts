import prisma from "../lib/prisma";
import { hashPassword } from "../utils/password";
import { UserRole, TicketStatus, TicketPriority } from "../generated/prisma/enums";

export async function seedDatabase() {
  console.log("Starting DeskOps database seed...");

  const defaultPasswordHash = await hashPassword("Password123!");

  // 1. Seed Organisation A (Acme Facilities)
  let orgA = await prisma.organisation.findFirst({
    where: { name: "Acme Facilities Management" },
  });

  if (!orgA) {
    orgA = await prisma.organisation.create({
      data: {
        name: "Acme Facilities Management",
      },
    });
    console.log(`Created Organisation A: ${orgA.name} (${orgA.id})`);
  }

  // Organisation A Property & Unit
  let propA = await prisma.property.findFirst({
    where: { organisationId: orgA.id, name: "Acme Tower" },
  });
  if (!propA) {
    propA = await prisma.property.create({
      data: {
        name: "Acme Tower",
        address: "100 Market St",
        organisationId: orgA.id,
      },
    });
  }

  let unitA = await prisma.unit.findFirst({
    where: { organisationId: orgA.id, propertyId: propA.id, unitNumber: "101" },
  });
  if (!unitA) {
    unitA = await prisma.unit.create({
      data: {
        unitNumber: "101",
        propertyId: propA.id,
        organisationId: orgA.id,
      },
    });
  }

  // Organisation A Users
  let adminA = await prisma.user.findFirst({
    where: { email: "admin@acme.com", organisationId: orgA.id },
  });
  if (!adminA) {
    adminA = await prisma.user.create({
      data: {
        name: "Alice Acme Admin",
        email: "admin@acme.com",
        password: defaultPasswordHash,
        role: UserRole.ORG_ADMIN,
        organisationId: orgA.id,
      },
    });
    console.log(`Created Org A Admin: ${adminA.email}`);
  }

  let residentA = await prisma.user.findFirst({
    where: { email: "resident@acme.com", organisationId: orgA.id },
  });
  if (!residentA) {
    residentA = await prisma.user.create({
      data: {
        name: "Robert Resident",
        email: "resident@acme.com",
        password: defaultPasswordHash,
        role: UserRole.RESIDENT,
        organisationId: orgA.id,
        unitId: unitA.id,
      },
    });
    console.log(`Created Org A Resident: ${residentA.email}`);
  }

  // Organisation A Ticket
  const ticketACount = await prisma.ticket.count({
    where: { organisationId: orgA.id },
  });
  if (ticketACount === 0) {
    const ticketA = await prisma.ticket.create({
      data: {
        title: "Leaking faucet in bathroom",
        description: "The master bathroom faucet is dripping continuously.",
        status: TicketStatus.NEW,
        priority: TicketPriority.MEDIUM,
        category: "Plumbing",
        organisationId: orgA.id,
        propertyId: propA.id,
        unitId: unitA.id,
        createdById: residentA.id,
      },
    });
    console.log(`Created Org A sample ticket: "${ticketA.title}" (${ticketA.id})`);
  }

  // 2. Seed Organisation B (Apex Properties)
  let orgB = await prisma.organisation.findFirst({
    where: { name: "Apex Property Holdings" },
  });

  if (!orgB) {
    orgB = await prisma.organisation.create({
      data: {
        name: "Apex Property Holdings",
      },
    });
    console.log(`Created Organisation B: ${orgB.name} (${orgB.id})`);
  }

  // Organisation B Property & Unit
  let propB = await prisma.property.findFirst({
    where: { organisationId: orgB.id, name: "Apex Heights" },
  });
  if (!propB) {
    propB = await prisma.property.create({
      data: {
        name: "Apex Heights",
        address: "200 Grand Ave",
        organisationId: orgB.id,
      },
    });
  }

  let unitB = await prisma.unit.findFirst({
    where: { organisationId: orgB.id, propertyId: propB.id, unitNumber: "404" },
  });
  if (!unitB) {
    unitB = await prisma.unit.create({
      data: {
        unitNumber: "404",
        propertyId: propB.id,
        organisationId: orgB.id,
      },
    });
  }

  // Organisation B Users
  let adminB = await prisma.user.findFirst({
    where: { email: "admin@apex.com", organisationId: orgB.id },
  });
  if (!adminB) {
    adminB = await prisma.user.create({
      data: {
        name: "Bob Apex Admin",
        email: "admin@apex.com",
        password: defaultPasswordHash,
        role: UserRole.ORG_ADMIN,
        organisationId: orgB.id,
      },
    });
    console.log(`Created Org B Admin: ${adminB.email}`);
  }

  let residentB = await prisma.user.findFirst({
    where: { email: "resident@apex.com", organisationId: orgB.id },
  });
  if (!residentB) {
    residentB = await prisma.user.create({
      data: {
        name: "Bella Resident",
        email: "resident@apex.com",
        password: defaultPasswordHash,
        role: UserRole.RESIDENT,
        organisationId: orgB.id,
        unitId: unitB.id,
      },
    });
    console.log(`Created Org B Resident: ${residentB.email}`);
  }

  // Organisation B Ticket
  const ticketBCount = await prisma.ticket.count({
    where: { organisationId: orgB.id },
  });
  if (ticketBCount === 0) {
    const ticketB = await prisma.ticket.create({
      data: {
        title: "HVAC cooling failure",
        description: "AC unit is blowing warm air on the 4th floor.",
        status: TicketStatus.IN_PROGRESS,
        priority: TicketPriority.HIGH,
        category: "HVAC",
        organisationId: orgB.id,
        propertyId: propB.id,
        unitId: unitB.id,
        createdById: residentB.id,
      },
    });
    console.log(`Created Org B sample ticket: "${ticketB.title}" (${ticketB.id})`);
  }

  console.log("Database seed completed successfully.");
}

// Execute when run directly via CLI
if (require.main === module || process.argv[1]?.endsWith("seed.ts")) {
  seedDatabase()
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
