import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { comparePassword } from "../utils/password";
import { signToken } from "../utils/jwt";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { LoginInput } from "../schemas/auth.schema";

export async function login(req: Request<{}, {}, LoginInput>, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email.trim(),
          mode: "insensitive",
        },
      },
      include: {
        organisation: true,
      },
    });

    if (!user) {
      return sendError(res, "Invalid email or password", 401);
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return sendError(res, "Invalid email or password", 401);
    }

    const token = signToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organisationId: user.organisationId,
    });

    return sendSuccess(
      res,
      {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organisation: {
            id: user.organisation.id,
            name: user.organisation.name,
          },
        },
      },
      "Login successful"
    );
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response) {
  return sendSuccess(res, null, "Logged out successfully");
}

export async function getCurrentUser(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return sendError(res, "Authentication required", 401);
    }

    const user = await prisma.user.findFirst({
      where: {
        id: req.user.id,
        organisationId: req.user.organisationId,
      },
      include: {
        organisation: true,
      },
    });

    if (!user) {
      return sendError(res, "User not found", 404);
    }

    return sendSuccess(res, {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organisation: {
          id: user.organisation.id,
          name: user.organisation.name,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
