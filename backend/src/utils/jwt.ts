import jwt from "jsonwebtoken";
import { AuthenticatedUser } from "../types/express";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET environment variable is mandatory in production.");
    }
    return "deskops_dev_jwt_secret_key_12345";
  }

  return secret;
}

const JWT_EXPIRES_IN = "24h";

export function signToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organisationId: user.organisationId,
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verifyToken(token: string): AuthenticatedUser {
  return jwt.verify(token, getJwtSecret()) as AuthenticatedUser;
}
