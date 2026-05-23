import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { captureException } from "../lib/sentry";
import { HttpError } from "../utils/http-error";

function isScanPrescriptionRequest(req: Request) {
  return req.originalUrl.includes("/api/scan-prescription");
}

function scanFailureResponse(error: string, message: string) {
  return {
    success: false,
    error,
    message,
    provider: env.OCR_PROVIDER,
    rawText: "",
    cleanedText: "",
    confidence: 0,
    medicines: [],
    warnings: [],
    status: "failed"
  };
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (isScanPrescriptionRequest(req) && err && typeof err === "object" && (err as { code?: unknown }).code === "LIMIT_FILE_SIZE") {
    return res.status(413).json(scanFailureResponse("FILE_TOO_LARGE", "Prescription image is too large."));
  }

  if (err instanceof Error && err.message.startsWith("Unsupported prescription image type")) {
    logger.warn({ err, requestId: req.requestId }, "Prescription upload rejected");
    if (isScanPrescriptionRequest(req)) {
      return res.status(415).json(scanFailureResponse("UNSUPPORTED_FILE_TYPE", "Only JPEG, PNG, WebP, and HEIC images are supported."));
    }

    return res.status(400).json({
      success: false,
      message: err.message,
      requestId: req.requestId
    });
  }

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
