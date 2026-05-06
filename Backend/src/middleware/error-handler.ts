import type { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";
import { captureException } from "../lib/sentry";
import { HttpError } from "../utils/http-error";

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    logger.warn({ err, requestId: req.requestId }, "Request failed");
    if (err.statusCode >= 500) {
      captureException(err, req);
    }
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
      requestId: req.requestId
    });
  }

  logger.error({ err, requestId: req.requestId }, "Unhandled error");
  captureException(err, req);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
    requestId: req.requestId
  });
}
