import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { env } from "../../config/env";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import {
  createManualMedicationHandler,
  decodePrescriptionHandler,
  getPrescriptionHandler,
  getPrescriptionHistoryHandler,
  parsePrescriptionHandler,
  reconcilePrescriptionHandler,
  scanPrescriptionHandler,
  updateParsedMedicationHandler,
  uploadPrescriptionHandler
} from "./prescriptions.controller";
import {
  createManualMedicationSchema,
  decodePrescriptionBodySchema,
  parsePrescriptionSchema,
  reconcilePrescriptionSchema,
  scanPrescriptionBodySchema,
  updateParsedMedicationSchema,
  uploadPrescriptionBodySchema
} from "./prescriptions.schemas";

export const prescriptionImageMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];

export const prescriptionUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!prescriptionImageMimeTypes.includes(file.mimetype)) {
      return cb(new Error(`Unsupported prescription image type: ${file.mimetype}`));
    }

    cb(null, true);
  }
});

function scanPrescriptionUpload(req: Request, res: Response, next: NextFunction) {
  prescriptionUpload.fields([
    { name: "file", maxCount: 1 },
    { name: "image", maxCount: 1 }
  ])(req, res, (error) => {
    if (error) {
      next(error);
      return;
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    req.file = files?.file?.[0] ?? files?.image?.[0];
    next();
  });
}

export const prescriptionsRouter = Router();
export const prescriptionScanRouter = Router();

prescriptionsRouter.post("/upload", requireAuth, prescriptionUpload.single("file"), validateBody(uploadPrescriptionBodySchema), asyncHandler(uploadPrescriptionHandler));
prescriptionsRouter.post("/decode", requireAuth, prescriptionUpload.single("file"), validateBody(decodePrescriptionBodySchema), asyncHandler(decodePrescriptionHandler));
prescriptionsRouter.get("/history", requireAuth, asyncHandler(getPrescriptionHistoryHandler));
prescriptionsRouter.get("/:id", requireAuth, asyncHandler(getPrescriptionHandler));
prescriptionsRouter.post("/:id/parse", requireAuth, validateBody(parsePrescriptionSchema), asyncHandler(parsePrescriptionHandler));
prescriptionsRouter.post("/:id/medications", requireAuth, validateBody(createManualMedicationSchema), asyncHandler(createManualMedicationHandler));
prescriptionsRouter.post("/:id/reconcile", requireAuth, validateBody(reconcilePrescriptionSchema), asyncHandler(reconcilePrescriptionHandler));
prescriptionsRouter.patch(
  "/medications/:medicationId",
  requireAuth,
  validateBody(updateParsedMedicationSchema),
  asyncHandler(updateParsedMedicationHandler)
);

prescriptionScanRouter.post(
  "/scan-prescription",
  requireAuth,
  scanPrescriptionUpload,
  validateBody(scanPrescriptionBodySchema),
  asyncHandler(scanPrescriptionHandler)
);
