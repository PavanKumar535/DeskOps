# DeskOps â€“ Tenant Isolation & Cross-Tenant Security Audit Report

**Document:** `docs/tenant-isolation-report.md`
**Engineer:** Engineer D (Infrastructure, Security & Backend)
**Date:** 16 November 2026
**Status:** âœ… Fully Implemented and Verified

---

## 1. Executive Summary

This report documents the security audit, query hardening, and automated verification of multi-tenant data isolation in the DeskOps platform to meet the LogicVeda Walking Skeleton milestone (M1.2) and Non-Functional Requirement NFR-01.

All database queries across the application were audited to ensure they strictly scope queries using the server-side authenticated `organisationId` derived from the validated JWT token, rather than relying on frontend-supplied parameters. A dedicated, automated cross-tenant security integration test suite was authored and verified against live PostgreSQL, achieving **100% pass rate (70/70 tests across 4 suites)**.

---

## 2. Prisma Schema Audit (Step 1)

Every model in `backend/prisma/schema.prisma` was inspected for tenant relationships, foreign key constraints, and composite unique keys.

### Model Inventory & Tenant Mapping

| Model | Contains `organisationId` | Relationship to `Organisation` | Composite Unique Keys / Indexes | Relational Foreign Keys & Tenant Enforcement |
|---|---|---|---|---|
| `Organisation` | N/A (Root) | Primary Tenant Entity | Primary key `id` | Root entity; all tenants have isolated UUIDs. |
| `User` | âœ… Yes | Direct relation `[organisationId] -> Organisation[id]` | `@@unique([email, organisationId])`<br>`@@unique([id, organisationId])`<br>`@@index([organisationId, role])` | Scoped to organisation. Optional unit reference scoped to `[unitId, organisationId]`. |
| `Property` (Store) | âœ… Yes | Direct relation `[organisationId] -> Organisation[id]` | `@@unique([id, organisationId])`<br>`@@index([organisationId])` | Stores strictly partitioned by `organisationId`. |
| `Unit` | âœ… Yes | Direct relation `[organisationId] -> Organisation[id]` | `@@unique([propertyId, unitNumber])`<br>`@@unique([id, organisationId])`<br>`@@index([organisationId])` | Foreign key to Property is composite: `[propertyId, organisationId] -> Property[id, organisationId]`. |
| `TechnicianSkill` | âœ… Yes | Direct relation `[organisationId] -> Organisation[id]` | `@@unique([technicianId, skillName])`<br>`@@index([organisationId])` | Foreign key to User is composite: `[technicianId, organisationId] -> User[id, organisationId]`. |
| `TechnicianPropertyCoverage` | âœ… Yes | Direct relation `[organisationId] -> Organisation[id]` | `@@unique([technicianId, propertyId])`<br>`@@index([organisationId])` | Foreign keys to User and Property are composite: `[technicianId, organisationId]` and `[propertyId, organisationId]`. |
| `Ticket` | âœ… Yes | Direct relation `[organisationId] -> Organisation[id]` | `@@unique([id, organisationId])`<br>`@@unique([replyToken, organisationId])`<br>`@@index([organisationId, status, createdAt])` | Composite foreign keys ensure ticket cannot reference entities outside tenant: `[propertyId, organisationId]`, `[unitId, organisationId]`, `[createdById, organisationId]`, `[assignedToId, organisationId]`. |
| `TicketEvent` | âœ… Yes | Direct relation `[organisationId] -> Organisation[id]` | `@@index([organisationId, ticketId, createdAt])` | Composite foreign key to Ticket: `[ticketId, organisationId] -> Ticket[id, organisationId]`, Actor: `[actorId, organisationId] -> User[id, organisationId]`. |
| `Comment` | âœ… Yes | Direct relation `[organisationId] -> Organisation[id]` | `@@index([organisationId, ticketId, createdAt])` | Composite foreign keys: `[ticketId, organisationId]` and `[authorId, organisationId]`. |
| `Attachment` | âœ… Yes | Direct relation `[organisationId] -> Organisation[id]` | `@@index([organisationId, ticketId])` | Composite foreign keys: `[ticketId, organisationId]` and `[uploadedById, organisationId]`. |
| `TicketWatcher` | âœ… Yes | Direct relation `[organisationId] -> Organisation[id]` | `@@unique([ticketId, userId])`<br>`@@index([organisationId])` | Composite foreign keys: `[ticketId, organisationId]` and `[userId, organisationId]`. |
| `InboundEmail` | âœ… Yes | Direct relation `[organisationId] -> Organisation[id]` | `@@unique([organisationId, providerMessageId])`<br>`@@index([organisationId, replyToken])` | Optional ticket link: `[ticketId, organisationId] -> Ticket[id, organisationId]`. |
| `AuditLog` | âœ… Yes | Direct relation `[organisationId] -> Organisation[id]` | `@@index([organisationId, entityType, entityId])`<br>`@@index([organisationId, createdAt])` | Actor link: `[actorId, organisationId] -> User[id, organisationId]`. |
| `IdempotencyKey` | âœ… Yes | Direct relation `[organisationId] -> Organisation[id]` | `@@unique([organisationId, key])` | Partitioned strictly by tenant. |
| `ClientRule` | âœ… Yes | Direct relation `[organisationId] -> Organisation[id]` | `@@unique([organisationId, ruleKey])` | Partitioned strictly by tenant. |

### Schema Audit Finding
Every single child model in the database has `organisationId` and utilizes composite foreign keys of the format `[entityId, organisationId] REFERENCES Parent[id, organisationId]`. This ensures that even at the raw SQL PostgreSQL engine level, cross-tenant relational integrity is physically enforced.

---

## 3. Query Inspection & Hardening (Steps 2 & 3)

### Security Enhancements Implemented

1. **Composite Unique Lookup (`id_organisationId`)**:
   - In `backend/src/services/ticket.service.ts`, queries fetching a ticket (`getTicketById`), fetching ticket events (`getTicketEvents`), and validating assigned technicians (`assignTicket`) were upgraded to use `prisma.ticket.findUnique({ where: { id_organisationId: { id, organisationId } } })` and `prisma.user.findUnique({ where: { id_organisationId: { id, organisationId } } })`.
   - This directly utilizes the composite unique constraint `@@unique([id, organisationId])` in PostgreSQL.

2. **Defense-in-Depth Relational Filtering**:
   - In `getTicketById`, the `events` relation include was hardened with an explicit tenant clause:
     ```typescript
     events: {
       where: { organisationId },
       orderBy: { createdAt: "asc" },
       ...
     }
     ```

3. **Multi-Vector Tenant Spoofing Prevention in Middleware**:
   - `backend/src/middleware/tenant.ts` was enhanced. In addition to validating `req.body.organisationId`, it now explicitly intercepts and blocks:
     - Malicious `req.query.organisationId` injections with HTTP 403.
     - Malicious `X-Organisation-Id` custom header spoofing attempts with HTTP 403.
     - Enforces `req.tenantId = req.user.organisationId` as the single authoritative source of truth.

---

## 4. Database Migrations (Step 5)

- **Existing Migrations Inspected**:
  - `20261114092838_init`
  - `20261114093302_complete_phase1_schema`
- **Result**: No schema modifications or new migrations were necessary. The existing database schema already features complete composite keys and foreign keys. Destructive reset commands (`prisma migrate reset`) were strictly avoided, preserving all existing database tables and data.

---

## 5. Automated Cross-Tenant Integration Test (Step 4)

A dedicated, un-mocked integration test file was created: `backend/tests/crossTenantIsolation.test.ts`.

### Test Scenarios Covered

1. **Step 4.1 â€“ Cross-Tenant Ticket Access Attempt**:
   - Authenticated user in Organisation A queries Organisation B's ticket ID: `GET /api/v1/tickets/:orgBTicketId`.
   - **Result:** HTTP 404 Not Found.
2. **Step 4.2 â€“ Zero Data Leakage**:
   - Verified that the response body contains no data, and does not leak Organisation B's title, description, UUIDs, or email addresses.
   - **Result:** Verified.
3. **Step 4.3 â€“ Legitimate Own-Tenant Access**:
   - Authenticated user in Organisation A queries Organisation A's ticket ID: `GET /api/v1/tickets/:orgATicketId`.
   - **Result:** HTTP 200 OK with full ticket details.
4. **Step 4.4 â€“ Bidirectional Isolation**:
   - Organisation B can access its own ticket, but receives HTTP 404 when querying Organisation A's ticket.
   - **Result:** Verified.
5. **Cross-Tenant Ticket Listing**:
   - `GET /api/v1/tickets` strictly filters by tenant; Organisation A only sees its own tickets.
   - **Result:** Verified.
6. **Cross-Tenant Audit Event Access**:
   - `GET /api/v1/tickets/:orgBTicketId/events` returns HTTP 404.
   - **Result:** Verified.
7. **Cross-Tenant Lifecycle Mutations**:
   - Prevented triage, assignment, status update, resolution, closure, and reopening on cross-tenant tickets (all return HTTP 404).
   - **Result:** Verified.
8. **Relational Boundary Enforcement**:
   - Creating a ticket in Org A referencing Org B's property or unit returns HTTP 404 ("Property not found in organisation").
   - **Result:** Verified.
9. **Spoofing Rejection**:
   - Body spoofing, query parameter spoofing, and header spoofing attempts are rejected with HTTP 403 Forbidden.
   - **Result:** Verified.

---

## 6. Verification & Test Execution (Step 6)

Tests executed against PostgreSQL in Docker (`localhost:5433`):

```bash
cd backend && npm test -- --reporter=verbose
```

### Full Test Suite Results

```text
 âœ“ tests/ticketStateMachine.test.ts (13 tests)
 âœ“ tests/api.test.ts (20 tests)
 âœ“ tests/crossTenantIsolation.test.ts (17 tests)
 âœ“ tests/ticketLifecycle.test.ts (20 tests)

Test Files:  4 passed (4)
Tests:       70 passed (70)
Duration:    2.79s
```

### TypeScript & Frontend Build Results
- **Backend TypeScript compilation (`npm run build`)**: Exited with code 0 (clean).
- **Frontend Vite build (`npm run build`)**: Exited with code 0 (21 modules transformed, 0 errors).

---

## 7. GitHub Actions CI Integration (Step 7)

`.github/workflows/ci.yml` was audited and verified:
- Spins up PostgreSQL 16 container service with `pg_isready` health check.
- Generates Prisma client and executes `npx prisma migrate deploy`.
- Executes `npm test` covering all 4 test suites.
- If any test in `crossTenantIsolation.test.ts` fails, the CI pipeline halts and fails.
- Successfully builds both backend and frontend.

---

## 8. Files Created or Modified

| File | Action | Description |
|---|---|---|
| `backend/src/middleware/tenant.ts` | Modified | Hardened tenant middleware to reject query parameter and header spoofing attempts. |
| `backend/src/services/ticket.service.ts` | Modified | Upgraded queries to use composite unique `id_organisationId` and added relation tenant filtering. |
| `backend/tests/crossTenantIsolation.test.ts` | Created | Complete un-mocked Vitest/Supertest cross-tenant security integration suite. |
| `docs/tenant-isolation-report.md` | Created | Official technical report documenting audit, implementation, and test results. |

---

## 9. Conclusion & Recommendations

Tenant isolation across the DeskOps database and API layer is complete, robust, and verified.
- **Physical Isolation**: Guaranteed by composite foreign key constraints at the database layer.
- **Application Isolation**: Enforced by `tenantMiddleware` using authenticated JWT context and composite unique lookups.
- **Zero Cross-Tenant Leakage**: Confirmed by 17 automated integration assertions.
- **No Remaining Issues**: The implementation is ready for staging deployment.
