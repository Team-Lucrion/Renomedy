import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import {
  createManualMedicationHandler,
  decodePrescriptionHandler,
  getPrescriptionHandler,
  getPrescriptionHistoryHandler,
  parsePrescriptionHandler,
  updateParsedMedicationHandler,
  uploadPrescriptionHandler
} from "./prescriptions.controller";
import {
  createManualMedicationSchema,
  decodePrescriptionBodySchema,
  parsePrescriptionSchema,
  updateParsedMedicationSchema,
  uploadPrescriptionBodySchema
} from "./prescriptions.schemas";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error(`Unsupported prescription image type: ${file.mimetype}`));
    }

    cb(null, true);
  }
});

export const prescriptionsRouter = Router();

prescriptionsRouter.post("/upload", requireAuth, upload.single("file"), validateBody(uploadPrescriptionBodySchema), asyncHandler(uploadPrescriptionHandler));
prescriptionsRouter.post("/decode", requireAuth, upload.single("file"), validateBody(decodePrescriptionBodySchema), asyncHandler(decodePrescriptionHandler));
prescriptionsRouter.get("/history", requireAuth, asyncHandler(getPrescriptionHistoryHandler));
prescriptionsRouter.get("/:id", requireAuth, asyncHandler(getPrescriptionHandler));
prescriptionsRouter.post("/:id/parse", requireAuth, validateBody(parsePrescriptionSchema), asyncHandler(parsePrescriptionHandler));
prescriptionsRouter.post("/:id/medications", requireAuth, validateBody(createManualMedicationSchema), asyncHandler(createManualMedicationHandler));
prescriptionsRouter.patch(
  "/medications/:medicationId",
  requireAuth,
  validateBody(updateParsedMedicationSchema),
  asyncHandler(updateParsedMedicationHandler)
);
