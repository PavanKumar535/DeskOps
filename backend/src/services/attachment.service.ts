
import { randomUUID } from "crypto";
import { supabase, ATTACHMENT_BUCKET } from "./supabase.service";
import prisma from "../lib/prisma";
import { thumbnailQueue } from "../queues/thumbnail.queue";
import {
  MAX_ATTACHMENT_SIZE,
  ALLOWED_ATTACHMENT_TYPES,
  ALLOWED_IMAGE_TYPES,
} from "../config/attachment.config";

function createServiceError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

export async function createAttachmentUploadUrl(
  ticketId: string,
  organisationId: string,
  userId: string,
  fileName: string,
  contentType: string,
  fileSize: number
) {
  if (!fileName.trim()) {
    throw createServiceError("File name is required", 400);
  }

  if (
    !ALLOWED_ATTACHMENT_TYPES.includes(
      contentType as (typeof ALLOWED_ATTACHMENT_TYPES)[number]
    )
  ) {
    throw createServiceError("File type is not allowed", 400);
  }

  if (
    !Number.isInteger(fileSize) ||
    fileSize <= 0 ||
    fileSize > MAX_ATTACHMENT_SIZE
  ) {
    throw createServiceError("File size must be between 1 byte and 10 MB", 400);
  }

  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storageKey = `${organisationId}/${ticketId}/${randomUUID()}-${safeFileName}`;

  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUploadUrl(storageKey);

  if (error) {
    throw createServiceError(
      `Unable to create upload URL: ${error.message}`,
      500
    );
  }

  try {
    const attachment = await prisma.attachment.create({
      data: {
        organisationId,
        ticketId,
        uploadedById: userId,
        fileName: safeFileName,
        storageKey,
        contentType,
        fileSize,
        status: "PENDING",
      },
      select: {
        id: true,
        fileName: true,
        contentType: true,
        fileSize: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      attachment,
      storageKey,
      signedUrl: data.signedUrl,
      token: data.token,
    };
  } catch {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([storageKey]);
    throw createServiceError("Unable to save attachment record", 500);
  }
}

export async function completeAttachmentUpload(
  attachmentId: string,
  ticketId: string,
  organisationId: string,
  userId: string
) {
  const attachment = await prisma.attachment.findFirst({
    where: {
      id: attachmentId,
      ticketId,
      organisationId,
      uploadedById: userId,
      status: "PENDING",
    },
  });

  if (!attachment) {
    throw createServiceError("Pending attachment not found", 404);
  }

  const expectedPrefix = `${organisationId}/${ticketId}/`;

  if (!attachment.storageKey.startsWith(expectedPrefix)) {
    throw createServiceError("Invalid attachment storage path", 400);
  }

  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .download(attachment.storageKey);

  if (error || !data) {
    throw createServiceError("Uploaded file not found in storage", 404);
  }

  const buffer = new Uint8Array(await data.arrayBuffer());
  const actualSize = buffer.byteLength;

  if (actualSize <= 0 || actualSize > MAX_ATTACHMENT_SIZE) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([
      attachment.storageKey,
    ]);
    throw createServiceError("Actual file size exceeds the 10 MB limit", 400);
  }

  if (actualSize !== attachment.fileSize) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([
      attachment.storageKey,
    ]);
    throw createServiceError("Uploaded file size does not match", 400);
  }

  const { fileTypeFromBuffer } = await import("file-type");
  const detectedType = await fileTypeFromBuffer(buffer);

  if (
    !detectedType ||
    !ALLOWED_ATTACHMENT_TYPES.includes(
      detectedType.mime as (typeof ALLOWED_ATTACHMENT_TYPES)[number]
    ) ||
    detectedType.mime !== attachment.contentType
  ) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([
      attachment.storageKey,
    ]);
    throw createServiceError("Actual file type is not allowed", 400);
  }

  const isImage = ALLOWED_IMAGE_TYPES.includes(
    detectedType.mime as (typeof ALLOWED_IMAGE_TYPES)[number]
  );

  const updatedAttachment = await prisma.attachment.update({
    where: { id: attachment.id },
    data: {
      status: isImage ? "UPLOADED" : "READY",
      fileSize: actualSize,
      contentType: detectedType.mime,
    },
    select: {
      id: true,
      fileName: true,
      contentType: true,
      fileSize: true,
      status: true,
      createdAt: true,
    },
  });

  if (isImage) {
    try {
      await thumbnailQueue.add(
        "generate-thumbnail",
        { attachmentId: attachment.id },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 100,
        }
      );
    } catch {
      await prisma.attachment.update({
        where: { id: attachment.id },
        data: { status: "FAILED" },
      });

      throw createServiceError(
        "Attachment uploaded, but thumbnail job could not be queued",
        500
      );
    }
  }

  return updatedAttachment;
}

// Generate secure URLs for viewing and downloading an attachment
export async function createAttachmentDownloadUrl(
  attachmentId: string,
  ticketId: string,
  organisationId: string
) {
  const attachment = await prisma.attachment.findFirst({
    where: {
      id: attachmentId,
      ticketId,
      organisationId,
    },
  });

  if (!attachment) {
    throw createServiceError("Attachment not found", 404);
  }

  if (attachment.status !== "READY") {
    throw createServiceError(
      `Attachment is not ready yet. Current status: ${attachment.status}`,
      409
    );
  }

  const { data, error } = await supabase.storage
  .from(ATTACHMENT_BUCKET)
  .createSignedUrl(attachment.storageKey, 300);

if (error || !data) {
  throw createServiceError("Unable to generate download URL", 500);
}

let thumbnailUrl: string | null = null;

if (attachment.thumbnailKey) {
  const { data: thumbnailData, error: thumbnailError } =
    await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(attachment.thumbnailKey, 300);

  if (!thumbnailError && thumbnailData) {
    thumbnailUrl = thumbnailData.signedUrl;
  }
}

return {
  id: attachment.id,
  fileName: attachment.fileName,
  contentType: attachment.contentType,
  fileSize: attachment.fileSize,
  signedUrl: data.signedUrl,
  thumbnailUrl,
};
}
