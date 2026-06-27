import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "../config/logger";

let store: RedisStore | undefined;

// Security/Performance: Use a distributed Redis store for rate limiting if a Redis URL is provided.
// This prevents attackers from bypassing in-memory rate limits by spraying requests across multiple instances.
if (process.env.REDIS_URL) {
  try {
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1, // Fast-fail to ensure the app doesn't hang if Redis is down
      enableOfflineQueue: false
    });

    client.on("error", (err) => {
      logger.error({ err }, "Redis rate limiter connection error");
    });

    store = new RedisStore({
      sendCommand: async (...args: string[]) => {
        const command = args[0];
        const commandArgs = args.slice(1);
        // Explicitly cast to the expected any/RedisReply type to satisfy rate-limit-redis
        return client.call(command, ...commandArgs) as any;
      },
    });
    logger.info("Distributed rate limiting enabled via Redis");
  } catch (error) {
    logger.error({ err: error }, "Failed to initialize Redis rate limit store, falling back to memory store");
  }
}

export const apiRateLimiter = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  max: env.API_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  store: store
});
