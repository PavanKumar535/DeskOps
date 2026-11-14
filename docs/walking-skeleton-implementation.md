# DeskOps – Walking Skeleton Implementation Guide (Milestone M1.2)

## 1. Executive & Architecture Overview

DeskOps is a multi-tenant maintenance ticketing platform built for facilities management companies. Each company (organisation) manages its own properties, units, staff, technicians, and resident maintenance requests.

The **Walking Skeleton (Milestone M1.2)** provides a fully integrated, functional vertical slice across every tier of the system:
- **Frontend**: React (TypeScript + Vite) with responsive multi-tenant authentication and dashboard.
- **Backend API**: Node.js 22 + Express 5 in TypeScript, featuring JWT authentication, role verification, Zod input validation, Helmet security headers, and strict multi-tenant middleware.
- **Database**: PostgreSQL 16 managed via Prisma 7 ORM with driver adapters and relational composite tenant constraints.
- **Containerization**: Docker Compose orchestrating PostgreSQL, backend, and frontend containers.
- **Continuous Integration**: GitHub Actions workflow running dependency caching, Prisma Client generation, database migrations, automated unit and tenant isolation tests, and Docker image builds.

```mermaid
flowchart LR
    Client["Browser / React Client"] -->|"JWT Auth & API Requests"| API["Express Backend (Node.js 22)"]
    API -->|"requireAuth Middleware"| Auth["JWT Validator"]
    API -->|"tenantMiddleware"| Tenant["Tenant Isolation Enforcement"]
    API -->|"Prisma 7 ORM"| DB[("PostgreSQL 16 Database")]
```

---

## 2. Authentication Flow

Authentication is stateless and uses cryptographic JSON Web Tokens (JWT).

1. **Submission**: User submits email and password to `POST /api/v1/auth/login`.
2. **Validation**: The request body is validated against a Zod schema (`loginSchema`).
3. **Lookup & Verification**:
   - The user record is fetched from PostgreSQL.
   - The supplied plaintext password is compared against the stored hash using `bcryptjs.compare()`.
4. **Token Generation**:
   - On successful match, a JWT signed with `JWT_SECRET` is generated containing the user's:
     - `id` (User UUID)
     - `email`
     - `name`
     - `role` (e.g. `ORG_ADMIN`, `RESIDENT`, `STAFF`, `TECHNICIAN`)
     - `organisationId` (Tenant UUID)
5. **Session Handling**:
   - The token is returned to the client and stored in `localStorage`.
   - All subsequent requests include `Authorization: Bearer <token>`.
6. **Authentication Middleware (`requireAuth`)**:
   - Intercepts requests, validates the signature and expiration, and binds the payload to `req.user`.

---

## 3. Multi-Tenant Isolation Flow (NFR-01)

The single most critical requirement of DeskOps is **complete data isolation between organisations**. Facilities Company A must never view or manipulate records belonging to Facilities Company B.

### Three Layers of Defense:

1. **Server-Side Token Derivation**:
   - Tenant identity is **never** accepted from untrusted request bodies, URLs, or query parameters.
   - `tenantMiddleware` extracts `organisationId` solely from `req.user.organisationId` (which was cryptographically signed on login).
   - If a client attempts to supply a mismatched `organisationId` in the payload, the request is immediately rejected with `403 Forbidden: Cross-tenant access attempted`.

2. **Server-Enforced Query Scoping**:
   - Every database operation explicitly scopes by `organisationId: req.tenantId`.
   - Example:
     ```ts
     const tickets = await prisma.ticket.findMany({
       where: { organisationId: req.tenantId }
     });
     ```

3. **Database-Level Composite Foreign Keys**:
   - Prisma schema enforces composite unique constraints across all related tables:
     `@@unique([id, organisationId])`
   - Child records (properties, units, tickets, comments, events) strictly reference both `id` and `organisationId` of their parent tables.

---

## 4. Database Structure

The schema contains 14 domain models in [backend/prisma/schema.prisma](file:///c:/Users/bapat/OneDrive/Documents/logic_veda_internship/DeskOps/backend/prisma/schema.prisma).

### Primary Walking Skeleton Models:
- **`Organisation`**: Represents the tenant company (e.g., Acme Facilities Management).
- **`User`**: Associated with an organisation (`organisationId`), role enum (`ORG_ADMIN`, `RESIDENT`, etc.), and hashed password.
- **`Property` & `Unit`**: Physical buildings and spaces managed under the organisation.
- **`Ticket`**: Maintenance issue belonging to an organisation, property, unit, and resident creator.

---

## 5. Docker Architecture

The application is containerized using multi-stage Alpine Linux containers:

- **`deskops-postgres`**: Standard PostgreSQL 16 image with health check (`pg_isready`) and persistent volume `deskops_postgres_data`.
- **`deskops-backend`**: Node 22 Alpine, generates Prisma Client during build, runs on port 5000 (mapped to host `5001`).
- **`deskops-frontend`**: Node 22 Alpine, serves React application on port 5173.

---

## 6. Continuous Integration (CI) Pipeline

GitHub Actions is defined in [.github/workflows/ci.yml](file:///c:/Users/bapat/OneDrive/Documents/logic_veda_internship/DeskOps/.github/workflows/ci.yml):

1. **`backend` Job**:
   - Starts a managed PostgreSQL 16 service container.
   - Sets up Node.js 22 with npm dependency caching.
   - Runs `npm ci`.
   - Runs `npm run db:generate` (Prisma Client).
   - Runs `npx prisma migrate deploy` to verify migration compatibility on a fresh database.
   - Runs `npm test` executing all 19 automated tests (including tenant isolation).
   - Runs `npm run build` (TypeScript compilation).
2. **`frontend` Job**:
   - Sets up Node.js 22.
   - Runs `npm ci`.
   - Runs `npm run build` (Vite production bundle).
3. **`docker` Job**:
   - Runs after `backend` and `frontend` pass.
   - Validates that both backend and frontend Dockerfiles build cleanly.

---

## 7. Environment Variables

### Backend (`backend/.env` / `backend/.env.example`):
| Variable | Description | Example Value |
|---|---|---|
| `PORT` | Backend listening port | `5000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://deskops_user:deskops_dev_password@localhost:5433/deskops_db?schema=public` |
| `JWT_SECRET` | Secret key for signing auth tokens | `deskops_dev_jwt_secret_key_12345` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |

### Frontend (`frontend/.env` / `frontend/.env.example`):
| Variable | Description | Example Value |
|---|---|---|
| `VITE_API_URL` | Backend URL accessible by the browser | `http://localhost:5001` |

---

## 8. Local Startup Instructions

### Quick Start with Docker Compose:
```bash
# Build and start all services in detached mode
docker compose up --build -d

# Verify all containers are running and healthy
docker compose ps
```

Access the applications:
- **Frontend UI**: [http://localhost:5173](http://localhost:5173)
- **Backend Health Check**: [http://localhost:5001/health](http://localhost:5001/health)
- **Database Health Check**: [http://localhost:5001/health/db](http://localhost:5001/health/db)

To seed initial test data (if not already seeded):
```bash
cd backend
npm run seed
```

---

## 9. Testing Instructions

To run the automated test suite locally:

```bash
cd backend
npm test
```

Expected result:
```text
✓ tests/api.test.ts (19 tests)
Test Files  1 passed (1)
Tests       19 passed (19)
```

The tests cover:
- Health (`/health`), readiness (`/ready`), and DB connection (`/health/db`).
- Login with invalid password, non-existent user, and malformed payload.
- Valid login for Organisation A and Organisation B.
- Unauthenticated access rejection on protected routes (401).
- Profile retrieval (`/api/v1/auth/me`).
- **Tenant isolation**:
  - Org A listing tickets (sees only Org A records).
  - Org B listing tickets (sees only Org B records).
  - Cross-tenant ticket lookup by ID returning `404 Not Found`.
  - Cross-tenant payload spoofing returning `403 Forbidden`.

---

## 10. Staging Deployment Instructions (Render Blueprint)

A complete Infrastructure-as-Code blueprint is provided in [render.yaml](file:///c:/Users/bapat/OneDrive/Documents/logic_veda_internship/DeskOps/render.yaml):

1. Push your branch to GitHub.
2. Sign in to your [Render.com](https://render.com) account.
3. Click **New +** -> **Blueprint**.
4. Connect the `DeskOps` repository.
5. Render will detect `render.yaml` and automatically configure:
   - `deskops-staging-db` (Managed PostgreSQL 16)
   - `deskops-backend-staging` (Web Service running Node 22)
   - `deskops-frontend-staging` (Static Site running React build)
6. Once deployed:
   - Run the initial migration and seed via Render Shell or backend start script:
     ```bash
     npx prisma migrate deploy && npm run seed
     ```
   - Open your staging frontend URL and test the login flow.

---

## 11. Known Limitations & Next Steps (Phase 2 Roadmap)

- **Refresh Tokens**: Currently uses 24-hour access tokens. Refresh-token rotation will be added in Phase 2.
- **Granular Ticket State Machine**: The ticket model contains workflow enums (`NEW`, `TRIAGED`, `ASSIGNED`, `IN_PROGRESS`, etc.). Full transition validation and technician assignment workflow will be completed in Engineer B's milestone.
- **Rate Limiting**: To be added in staging production hardening.

---

## 12. Simple Demonstration Script (For Internship Review)

When presenting this project to your mentor or team, you can explain it in 5 simple steps:

1. **Show System Health**:
   - Open `http://localhost:5173`.
   - Point out the **"All Systems Operational"** badge, demonstrating that the React frontend is successfully communicating with the Express backend, and the backend is connected to PostgreSQL.
2. **Log in as Organisation A (Acme Facilities)**:
   - Click the quick-fill button for `admin@acme.com`.
   - Click **Sign In**.
   - Show the dashboard: The active tenant is displayed as **Acme Facilities Management** (`Tenant ID: d0ca1b4b...`).
   - Show the tickets table: Point out the plumbing ticket (*"Leaking faucet in bathroom"*).
3. **Demonstrate Multi-Tenant Isolation (NFR-01)**:
   - Click the blue button **"Test Cross-Tenant Protection"**.
   - Show that the backend immediately rejects foreign ticket access with **"Ticket not found (Security Check Passed)"**.
4. **Log in as Organisation B (Apex Properties)**:
   - Click **Sign Out**.
   - Click the quick-fill button for `admin@apex.com`.
   - Click **Sign In**.
   - Show the dashboard: The active tenant is now **Apex Property Holdings** (`Tenant ID: c30af10b...`).
   - Show the tickets table: Acme's faucet ticket is completely absent; instead, only Apex's HVAC ticket is displayed.
5. **Show Automated Quality Assurance**:
   - Show the terminal running `npm test`: Explain that 19 automated tests run on every pull request in GitHub Actions to ensure no code breaks tenant boundaries or authentication.
