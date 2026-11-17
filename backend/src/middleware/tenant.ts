import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/apiResponse";

export function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.organisationId) {
    return sendError(res, "Tenant context missing or invalid", 403);
  }

  // Enforce server-side tenant identification:
  // Reject any malicious request body attempting to spoof a different tenant
  if (req.body && req.body.organisationId && req.body.organisationId !== req.user.organisationId) {
    return sendError(res, "Forbidden: Cross-tenant access attempted", 403);
  }

  // Reject any malicious query parameter attempting to spoof a different tenant
  if (req.query && req.query.organisationId && req.query.organisationId !== req.user.organisationId) {
    return sendError(res, "Forbidden: Cross-tenant access attempted", 403);
  }

  // Reject any malicious header attempting to spoof a different tenant
  const headerOrgId = req.headers["x-organisation-id"];
  if (headerOrgId && headerOrgId !== req.user.organisationId) {
    return sendError(res, "Forbidden: Cross-tenant access attempted", 403);
  }

  req.tenantId = req.user.organisationId;
  next();
}
