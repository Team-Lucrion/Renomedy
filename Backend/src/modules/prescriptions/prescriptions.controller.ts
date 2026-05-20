import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import {
  createManualMedication,
  decodePrescriptionUpload,
  getPrescription,
  getPrescriptionHistory,
  mapPrescriptionToScanResponse,
  parsePrescription,
  updateParsedMedication,
  uploadPrescription
} from "./prescriptions.service";
import { HttpError } from "../../utils/http-error";

export async function uploadPrescriptionHandler(req: Request, res: Response) {
  console.log("[prescription-upload] upload handler payload", {
    hasFile: Boolean(req.file),
    body: req.body,
    file: req.file
      ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        }
      : null
  });

  if (!req.file) throw new HttpError(400, "Prescription image file is required");
  const data = await uploadPrescription({
    jwt: req.auth!.token,
    clerkUserId: req.auth!.clerkUserId,
    file: req.file,
    body: req.body
  });
  return ok(res, data, "Prescription uploaded");
}

export async function decodePrescriptionHandler(req: Request, res: Response) {
  console.log("[prescription-decode] decode handler payload", {
    hasFile: Boolean(req.file),
    body: req.body,
    file: req.file
      ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        }
      : null
  });

  if (!req.file) throw new HttpError(400, "Prescription image file is required");

  const data = await decodePrescriptionUpload({
    jwt: req.auth!.token,
    clerkUserId: req.auth!.clerkUserId,
    file: req.file,
    body: req.body
  });

  const upload = Array.isArray(data.prescription_uploads) ? data.prescription_uploads[0] : data.prescription_uploads;
  const hardFailure =
    data.parse_status === "failed" &&
    (!data.raw_ocr_text || !String(data.raw_ocr_text).trim()) &&
    typeof upload?.last_error === "string" &&
    upload.last_error.trim();

  if (hardFailure) {
    const message =
      typeof upload.last_error === "string" && upload.last_error.trim()
        ? upload.last_error
        : "We could not clearly read this prescription. Please upload a clearer image.";

    throw new HttpError(422, message, { prescription: data });
  }

  return ok(res, data, "Prescription decoded");
}

export async function scanPrescriptionHandler(req: Request, res: Response) {
  if (!req.file) throw new HttpError(400, "Prescription image file is required");

  const data = await decodePrescriptionUpload({
    jwt: req.auth!.token,
    clerkUserId: req.auth!.clerkUserId,
    file: req.file,
    body: req.body
  });

  return res.status(200).json(mapPrescriptionToScanResponse(data));
}

export async function parsePrescriptionHandler(req: Request, res: Response) {
  const data = await parsePrescription(req.auth!.token, req.params.id);
  return ok(res, data, "Prescription parsed");
}

export async function getPrescriptionHandler(req: Request, res: Response) {
  const data = await getPrescription(req.auth!.token, req.params.id);
  return ok(res, data, "Prescription details");
}

export async function getPrescriptionHistoryHandler(req: Request, res: Response) {
  const data = await getPrescriptionHistory(req.auth!.token);
  return ok(res, data, "Prescription history");
}

export async function updateParsedMedicationHandler(req: Request, res: Response) {
  const data = await updateParsedMedication(req.auth!.token, req.params.medicationId, req.body);
  return ok(res, data, "Parsed medication updated");
}

export async function createManualMedicationHandler(req: Request, res: Response) {
  const data = await createManualMedication(req.auth!.token, req.params.id, req.body);
  return ok(res, data, "Prescription medication created");
}
