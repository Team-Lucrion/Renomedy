import type { NextFunction, Request, Response } from "express";
import { captureServerEvent, isPostHogEnabled } from "../lib/posthog";

export function observabilityMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!isPostHogEnabled()) {
    return next();
  }

  const startedAt = Date.now();

  res.on("finish", () => {
    if (req.path === "/health" || req.path === "/auth/clerk-webhook") {
      return;
    }

    captureServerEvent({
      distinctId: req.auth?.clerkUserId ?? req.requestId ?? "anonymous",
      event: "api_request_completed",
      properties: {
        authenticated: Boolean(req.auth?.clerkUserId),
        duration_ms: Date.now() - startedAt,
        method: req.method,
        path: req.originalUrl,
        request_id: req.requestId,
        status_code: res.statusCode
      }
    });
  });

  return next();
}
