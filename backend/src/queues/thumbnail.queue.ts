import { Queue } from "bullmq";
import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

export const thumbnailQueue = new Queue("attachment-thumbnails", {
  connection,
});

console.log("Thumbnail queue initialized");