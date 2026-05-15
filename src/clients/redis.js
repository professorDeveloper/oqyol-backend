import Redis from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../shared/logger.js";

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on("error", (err) => {
  logger.error("redis error", { message: err.message });
});
