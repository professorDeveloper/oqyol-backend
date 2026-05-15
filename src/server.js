import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./clients/prisma.js";
import { redis } from "./clients/redis.js";
import { logger } from "./shared/logger.js";

async function start() {
  await prisma.$connect();
  logger.info("database connected");

  await redis.connect();
  logger.info("redis connected");

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`server listening on port ${env.PORT}`);
  });

  const shutdown = async (signal) => {
    logger.info(`received ${signal}, shutting down`);
    server.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  logger.error("startup failed", { message: err.message, stack: err.stack });
  process.exit(1);
});
