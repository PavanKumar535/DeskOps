
import { Request, Response, NextFunction } from "express";
import { sendSuccess, sendError } from "../utils/apiResponse";
import * as ticketService from "../services/ticket.service";
import * as attachmentService from "../services/attachment.service";

function getParamId(req: Request): string {
  return Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
}

export async function createUploadUrlController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user || !req.tenantId) {
      return sendError(res, "Authentication required", 401);
    }

    const ticketId = getParamId(req);
    const { fileName, contentType, fileSize } = req.body;

    if (
      typeof fileName !== "string" ||
      typeof contentType !== "string" ||
      typeof fileSize !== "number"
    ) {
      return sendError(
        res,
        "Valid fileName, contentType and fileSize are required",
        400,
      );
    }

    await ticketService.getTicketById(
      ticketId,
      req.tenantId,
      req.user,
    );

    const upload = await attachmentService.createAttachmentUploadUrl(
      ticketId,
      req.tenantId,
      req.user.id,
      fileName,
      contentType,
      fileSize,
    );

    return sendSuccess(res, { upload }, "Upload URL created successfully");
  } catch (err: any) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }

    next(err);
  }
}

export async function completeUploadController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user || !req.tenantId) {
      return sendError(res, "Authentication required", 401);
    }

    const ticketId = getParamId(req);
    const { attachmentId } = req.body;

    if (typeof attachmentId !== "string" || !attachmentId.trim()) {
      return sendError(res, "Valid attachmentId is required", 400);
    }

    await ticketService.getTicketById(
      ticketId,
      req.tenantId,
      req.user,
    );

    const attachment = await attachmentService.completeAttachmentUpload(
      attachmentId,
      ticketId,
      req.tenantId,
      req.user.id,
    );

    return sendSuccess(
      res,
      { attachment },
      "Attachment uploaded and verified successfully",
    );
  } catch (err: any) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }

    next(err);
  }
}

// Generate secure URL for viewing or downloading an attachment
export async function getAttachmentDownloadUrlController(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user || !req.tenantId) {
      return sendError(res, "Authentication required", 401);
    }

    const ticketId = getParamId(req);
    const attachmentId = Array.isArray(req.params.attachmentId)
      ? req.params.attachmentId[0]
      : req.params.attachmentId;

    if (!attachmentId) {
      return sendError(res, "Valid attachmentId is required", 400);
    }

    // Verify that the current user can access this ticket
    await ticketService.getTicketById(
      ticketId,
      req.tenantId,
      req.user,
    );

    const attachment =
      await attachmentService.createAttachmentDownloadUrl(
        attachmentId,
        ticketId,
        req.tenantId,
      );

    return sendSuccess(
      res,
      { attachment },
      "Attachment URL generated successfully",
    );
  } catch (err: any) {
    if (err.statusCode) {
      return sendError(res, err.message, err.statusCode);
    }

    next(err);
  }
}
