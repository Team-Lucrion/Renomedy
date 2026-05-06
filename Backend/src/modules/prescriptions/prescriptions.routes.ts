import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import {
  getPrescriptionHandler,
  getPrescriptionHistoryHandler,
  parsePrescriptionHandler,
  updateParsedMedicationHandler,
  uploadPrescriptionHandler
} from "./prescriptions.controller";
import { parsePrescriptionSchema, updateParsedMedicationSchema, uploadPrescriptionBodySchema } from "./prescriptions.schemas";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  }
});

export const prescriptionsRouter = Router();

prescriptionsRouter.post("/upload", requireAuth, upload.single("file"), validateBody(uploadPrescriptionBodySchema), asyncHandler(uploadPrescriptionHandler));
prescriptionsRouter.get("/history", requireAuth, asyncHandler(getPrescriptionHistoryHandler));
prescriptionsRouter.get("/:id", requireAuth, asyncHandler(getPrescriptionHandler));
prescriptionsRouter.post("/:id/parse", requireAuth, validateBody(parsePrescriptionSchema), asyncHandler(parsePrescriptionHandler));
prescriptionsRouter.patch(
  "/medications/:medicationId",
  requireAuth,
  validateBody(updateParsedMedicationSchema),
  asyncHandler(updateParsedMedicationHandler)
);
