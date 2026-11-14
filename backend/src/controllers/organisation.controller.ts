import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";

export async function getOrganisation(req: Request, res: Response, next: NextFunction) {
  try {
    const organisation = await prisma.organisation.findUnique({
      where: {
        id: req.tenantId,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!organisation) {
      return sendError(res, "Organisation not found", 404);
    }

    return sendSuccess(res, { organisation });
  } catch (err) {
    next(err);
  }
}
