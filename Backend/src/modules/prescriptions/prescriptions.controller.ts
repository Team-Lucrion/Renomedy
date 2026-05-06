import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import {
  getPrescription,
  getPrescriptionHistory,
  parsePrescription,
  updateParsedMedication,
  uploadPrescription
} from "./prescriptions.service";
import { HttpError } from "../../utils/http-error";

export async function uploadPrescriptionHandler(req: Request, res: Response) {
  if (!req.file) throw new HttpError(400, "Prescription image file is required");
  const data = await uploadPrescription({
    jwt: req.auth!.token,
    clerkUserId: req.auth!.clerkUserId,
    file: req.file,
    body: req.body
  });
  return ok(res, data, "Prescription uploaded");
}

export async function parsePrescriptionHandler(req: Request, res: Response) {
  const data = await parsePrescription(req.auth!.token, req.params.id);
  return ok(res, data, "Prescription parsed (mock OCR)");
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
