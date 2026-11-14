Project: DeskOps – Service Desk Platform with an SLA Engine
Phase: Phase 1 – Ticketing Core
Version: 0.1
Status: Draft
Prepared on: 13 November 2026
This document describes the proposed design for Phase 1 of DeskOps.

The purpose of the application is to manage maintenance requests raised by residents. Service-desk staff will review incoming requests and assign them to technicians. Technicians will update the progress of their assigned work until the issue is resolved.

The application must also maintain a record of ticket activities so that users with the appropriate permissions can see what happened and when.

This document covers the organisation structure, user permissions, ticket workflow and ticket history.
The application will support multiple facilities companies. Each company will have its own properties, units, residents, technicians and tickets.

The following entities are required:
Entity	Description
Organisation	The facilities company using the platform.
Property	A building or site managed by an organisation.
Unit	An apartment, office or other space within a property.
Resident	A user associated with a unit who can raise maintenance requests.
Technician	A staff member who handles maintenance work based on skills and property coverage.
Ticket	A maintenance request created by a resident or an authorised user.
- One organisation can have multiple properties.
- One property can contain multiple units.
- Residents are associated with their respective units.
- Technicians belong to an organisation and have defined skills and property coverage.
- Tickets are associated with the organisation, property, unit and user who created them.
Data belonging to one organisation must not be accessible to users of another organisation.

The backend will check the authenticated user's organisation before accessing or modifying organisation-related records.
The application will have different access levels depending on the user's role.

The initial roles considered for the permission matrix are Resident, Staff, Technician and Organisation Admin.

The following table is the proposed starting point for team discussion.
Action	Resident	Staff	Technician	Organisation Admin
Create ticket for own unit	Yes	Optional	No	Optional
View own tickets	Yes	Yes	Yes	Yes
View tickets within permitted scope	No	Yes	Assigned tickets	Own organisation
Triage ticket	No	Yes	No	To confirm
Assign technician	No	Yes	No	To confirm
Update ticket progress	No	Limited	Assigned tickets	To confirm
Add public comment	Yes	Yes	Yes	Yes
Add internal comment	No	Yes	Yes	To confirm
Manage organisation users	No	No	No	Yes
1. Residents should only be able to access tickets associated with their own units.
2. Technicians should be able to access tickets assigned to them or otherwise within their authorised scope.
3. Staff should be able to manage tickets within their permitted organisational scope.
4. Organisation Admins should manage users and organisational information belonging to their organisation.
5. Internal comments must not be visible to residents.
6. Access restrictions must be checked by the backend API.
The permissions marked as Optional or To confirm will be finalised after discussion with the team and mentor.
Every ticket must follow a controlled workflow.

The statuses specified in the project requirements are:
Status	Description
New	The request has been submitted.
Triaged	The request has been reviewed and categorised.
Assigned	A technician has been assigned.
In Progress	The technician has started working on the issue.
On Hold	Work has been temporarily paused.
Resolved	The reported issue has been fixed.
Closed	The ticket has been formally completed.
New → Triaged → Assigned → In Progress → Resolved → Closed

An additional workflow is required when work is temporarily paused:

In Progress → On Hold → In Progress

Tickets must also support reopening within a configurable time window.

The exact permitted transitions and reopening duration will be confirmed with the mentor before implementation.

The backend must prevent invalid status changes, even if a user attempts to bypass the frontend.
The application must maintain a history of important ticket activities.

Whenever a ticket changes status, the system must record:
- Ticket ID
- Organisation ID
- Previous status
- New status
- Event type
- User who performed the action
- Date and time of the action
For example:
Activity	Previous Status	New Status	Performed By
Ticket created	-	New	Resident
Ticket reviewed	New	Triaged	Staff
Technician assigned	Triaged	Assigned	Staff
Work started	Assigned	In Progress	Technician
Work completed	In Progress	Resolved	Technician
Ticket closed	Resolved	Closed	Authorised user
The ticket history should be displayed as a timeline.

Previous events must be retained when the ticket status changes. The application should not simply overwrite the current status without recording the change.

Where possible, the ticket update and corresponding history event should be saved together in a database transaction.
The implementation will follow the technology stack specified in the official Phase 1 requirements.
Component	Technology
Frontend	React 18, TypeScript and Vite
UI styling	Tailwind CSS
Backend	Node.js 22, TypeScript and Express
Database	PostgreSQL
ORM	Prisma
Validation	Zod
Cache and background jobs	Redis and BullMQ
Real-time updates	Socket.io
File storage	Cloudflare R2 or AWS S3
Containerisation	Docker and Docker Compose 
CI/CD	GitHub Actions
Deployment	Render
Any proposed change to the specified technology stack must receive written mentor approval and be documented.
The following points need to be discussed before implementation:
1. Final approval of the role-by-action permission matrix.
2. Permissions for Organisation Admins when managing ticket status and assignments.
3. Whether technicians can close tickets directly.
4. Whether residents can reopen tickets.
5. Exact ticket reopening duration.
6. Final confirmation of the team-specific client requirement.
This is the initial technical design draft prepared using the DeskOps Phase 1 requirements and the supplied development guides.

The permission matrix and workflow decisions will be reviewed with the team and mentor. Changes will be incorporated into the document before final approval.
