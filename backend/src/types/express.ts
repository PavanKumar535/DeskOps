import { UserRole } from "../generated/prisma/enums";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organisationId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tenantId?: string;
    }
  }
}
