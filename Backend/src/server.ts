import { env } from "./config/env";
import { logger } from "./config/logger";
import { app } from "./app";
import { shutdownPostHog } from "./lib/posthog";
import { captureException, flushSentry, initSentry } from "./lib/sentry";
import { startSchedulers } from "./services/scheduler/scheduler.service";

initSentry();

const server = app.listen(env.PORT, () => {
  logger.info(`Swasthi backend running on port ${env.PORT}`);
  startSchedulers();
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down backend");

  server.close(async () => {
    await Promise.allSettled([shutdownPostHog(), flushSentry()]);
    process.exit(0);
  });
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("uncaughtException", (error) => {
  logger.error({ err: error }, "Uncaught exception");
  captureException(error);
});

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled rejection");
  captureException(reason);
});
