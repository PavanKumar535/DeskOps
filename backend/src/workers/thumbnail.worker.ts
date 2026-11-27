
import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import sharp from "sharp";
import { supabase, ATTACHMENT_BUCKET } from "../services/supabase.service";
import prisma from "../lib/prisma";

interface ThumbnailJobData {
  attachmentId: string;
}

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

async function processThumbnail(job: Job<ThumbnailJobData>) {
  const { attachmentId } = job.data;

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
  });

  if (!attachment) {
    throw new Error("Attachment record not found");
  }

  if (
    !["image/jpeg", "image/png", "image/webp"].includes(
      attachment.contentType
    )
  ) {
    throw new Error("Thumbnail processing supports images only");
  }

  await prisma.attachment.update({
    where: { id: attachmentId },
    data: { status: "PROCESSING" },
  });

  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .download(attachment.storageKey);

  if (error || !data) {
    throw new Error("Unable to download attachment");
  }

  const originalBuffer = Buffer.from(await data.arrayBuffer());

  const thumbnailBuffer = await sharp(originalBuffer)
    .resize(400, 400, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();

  const thumbnailKey =
    `${attachment.organisationId}/${attachment.ticketId}/thumbnails/${attachment.id}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(thumbnailKey, thumbnailBuffer, {
      contentType: "image/webp",
      upsert: true,
    });

  if (uploadError) {
    throw new Error("Unable to save thumbnail");
  }

  await prisma.attachment.update({
    where: { id: attachmentId },
    data: {
      thumbnailKey,
      status: "READY",
    },
  });

  console.log(`Thumbnail processed: ${attachmentId}`);
}

export const thumbnailWorker = new Worker<ThumbnailJobData>(
  "attachment-thumbnails",
  processThumbnail,
  {
    connection,
    concurrency: 3,
  }
);

thumbnailWorker.on("failed", async (job, error) => {
  console.error("Thumbnail job failed:", error.message);

  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await prisma.attachment.updateMany({
      where: {
        id: job.data.attachmentId,
        status: "PROCESSING",
      },
      data: { status: "FAILED" },
    });
  }
});

console.log("Thumbnail worker initialized");
