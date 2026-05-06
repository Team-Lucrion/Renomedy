import * as Sentry from "@sentry/node";
import type { Request } from "express";
import { env } from "../config/env";
import { logger } from "../config/logger";

let sentryInitialized = false;

export function isSentryEnabled() {
  return Boolean(env.SENTRY_DSN);
}

export function initSentry() {
  if (!isSentryEnabled() || sentryInitialized) {
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE
  });

  sentryInitialized = true;
  logger.info("Sentry enabled");
}

export function captureException(error: unknown, req?: Request) {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.withScope((scope) => {
    if (req) {
      scope.setTag("request_id", req.requestId ?? "unknown");
      scope.setTag("http_method", req.method);
      scope.setTag("http_path", req.originalUrl);

      if (req.auth?.clerkUserId) {
        scope.setUser({ id: req.auth.clerkUserId });
      }

      scope.setContext("request", {
        method: req.method,
        url: req.originalUrl,
        request_id: req.requestId,
        params: req.params,
        query: req.query,
        user_agent: req.get("user-agent")
      });
    }

    Sentry.captureException(error);
  });
}

export async function flushSentry(timeoutMs = 2000) {
  if (!isSentryEnabled()) {
    return;
  }

  await Sentry.flush(timeoutMs);
}
