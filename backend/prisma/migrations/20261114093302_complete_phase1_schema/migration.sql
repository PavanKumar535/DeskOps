/*
  Warnings:

  - A unique constraint covering the columns `[id,organisationId]` on the table `Property` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organisationId]` on the table `Unit` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,organisationId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organisationId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organisationId` to the `Unit` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CommentVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateEnum
CREATE TYPE "AttachmentStatus" AS ENUM ('PENDING', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED');

-- DropForeignKey
ALTER TABLE "Unit" DROP CONSTRAINT "Unit_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_unitId_fkey";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "organisationId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "TechnicianSkill" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicianSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianPropertyCoverage" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicianPropertyCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "replyToken" TEXT NOT NULL,
    "mergedIntoId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "reopenUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEvent" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "previousStatus" "TicketStatus",
    "newStatus" "TicketStatus",
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "visibility" "CommentVisibility" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'PENDING',
    "thumbnailKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketWatcher" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketWatcher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "ticketId" TEXT,
    "providerMessageId" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "replyToken" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRule" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "configuration" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechnicianSkill_organisationId_idx" ON "TechnicianSkill"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianSkill_technicianId_skillName_key" ON "TechnicianSkill"("technicianId", "skillName");

-- CreateIndex
CREATE INDEX "TechnicianPropertyCoverage_organisationId_idx" ON "TechnicianPropertyCoverage"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicianPropertyCoverage_technicianId_propertyId_key" ON "TechnicianPropertyCoverage"("technicianId", "propertyId");

-- CreateIndex
CREATE INDEX "Ticket_organisationId_status_createdAt_idx" ON "Ticket"("organisationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_organisationId_assignedToId_idx" ON "Ticket"("organisationId", "assignedToId");

-- CreateIndex
CREATE INDEX "Ticket_organisationId_propertyId_idx" ON "Ticket"("organisationId", "propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_id_organisationId_key" ON "Ticket"("id", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_replyToken_organisationId_key" ON "Ticket"("replyToken", "organisationId");

-- CreateIndex
CREATE INDEX "TicketEvent_organisationId_ticketId_createdAt_idx" ON "TicketEvent"("organisationId", "ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_organisationId_ticketId_createdAt_idx" ON "Comment"("organisationId", "ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Attachment_organisationId_ticketId_idx" ON "Attachment"("organisationId", "ticketId");

-- CreateIndex
CREATE INDEX "TicketWatcher_organisationId_idx" ON "TicketWatcher"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketWatcher_ticketId_userId_key" ON "TicketWatcher"("ticketId", "userId");

-- CreateIndex
CREATE INDEX "InboundEmail_organisationId_replyToken_idx" ON "InboundEmail"("organisationId", "replyToken");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_organisationId_providerMessageId_key" ON "InboundEmail"("organisationId", "providerMessageId");

-- CreateIndex
CREATE INDEX "AuditLog_organisationId_entityType_entityId_idx" ON "AuditLog"("organisationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_organisationId_createdAt_idx" ON "AuditLog"("organisationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_organisationId_key_key" ON "IdempotencyKey"("organisationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ClientRule_organisationId_ruleKey_key" ON "ClientRule"("organisationId", "ruleKey");

-- CreateIndex
CREATE INDEX "Property_organisationId_idx" ON "Property"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_id_organisationId_key" ON "Property"("id", "organisationId");

-- CreateIndex
CREATE INDEX "Unit_organisationId_idx" ON "Unit"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_id_organisationId_key" ON "Unit"("id", "organisationId");

-- CreateIndex
CREATE INDEX "User_organisationId_role_idx" ON "User"("organisationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_organisationId_key" ON "User"("email", "organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_organisationId_key" ON "User"("id", "organisationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_unitId_organisationId_fkey" FOREIGN KEY ("unitId", "organisationId") REFERENCES "Unit"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_organisationId_fkey" FOREIGN KEY ("propertyId", "organisationId") REFERENCES "Property"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianSkill" ADD CONSTRAINT "TechnicianSkill_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianSkill" ADD CONSTRAINT "TechnicianSkill_technicianId_organisationId_fkey" FOREIGN KEY ("technicianId", "organisationId") REFERENCES "User"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianPropertyCoverage" ADD CONSTRAINT "TechnicianPropertyCoverage_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianPropertyCoverage" ADD CONSTRAINT "TechnicianPropertyCoverage_technicianId_organisationId_fkey" FOREIGN KEY ("technicianId", "organisationId") REFERENCES "User"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicianPropertyCoverage" ADD CONSTRAINT "TechnicianPropertyCoverage_propertyId_organisationId_fkey" FOREIGN KEY ("propertyId", "organisationId") REFERENCES "Property"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_propertyId_organisationId_fkey" FOREIGN KEY ("propertyId", "organisationId") REFERENCES "Property"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_unitId_organisationId_fkey" FOREIGN KEY ("unitId", "organisationId") REFERENCES "Unit"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_createdById_organisationId_fkey" FOREIGN KEY ("createdById", "organisationId") REFERENCES "User"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedToId_organisationId_fkey" FOREIGN KEY ("assignedToId", "organisationId") REFERENCES "User"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_mergedIntoId_organisationId_fkey" FOREIGN KEY ("mergedIntoId", "organisationId") REFERENCES "Ticket"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_organisationId_fkey" FOREIGN KEY ("ticketId", "organisationId") REFERENCES "Ticket"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_actorId_organisationId_fkey" FOREIGN KEY ("actorId", "organisationId") REFERENCES "User"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_ticketId_organisationId_fkey" FOREIGN KEY ("ticketId", "organisationId") REFERENCES "Ticket"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_organisationId_fkey" FOREIGN KEY ("authorId", "organisationId") REFERENCES "User"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_ticketId_organisationId_fkey" FOREIGN KEY ("ticketId", "organisationId") REFERENCES "Ticket"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_organisationId_fkey" FOREIGN KEY ("uploadedById", "organisationId") REFERENCES "User"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketWatcher" ADD CONSTRAINT "TicketWatcher_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketWatcher" ADD CONSTRAINT "TicketWatcher_ticketId_organisationId_fkey" FOREIGN KEY ("ticketId", "organisationId") REFERENCES "Ticket"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketWatcher" ADD CONSTRAINT "TicketWatcher_userId_organisationId_fkey" FOREIGN KEY ("userId", "organisationId") REFERENCES "User"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_ticketId_organisationId_fkey" FOREIGN KEY ("ticketId", "organisationId") REFERENCES "Ticket"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_organisationId_fkey" FOREIGN KEY ("actorId", "organisationId") REFERENCES "User"("id", "organisationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRule" ADD CONSTRAINT "ClientRule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
