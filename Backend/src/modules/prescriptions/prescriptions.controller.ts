import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import {
  createManualMedication,
  createManualPrescriptionDraft,
  decodePrescriptionUpload,
  buildScanFailureResponse,
  getPrescription,
  getPrescriptionHistory,
  mapPrescriptionToScanResponse,
  parsePrescription,
  reconcilePrescription,
  resolvePrescriptionScanFile,
  updateParsedMedication,
  uploadPrescription
} from "./prescriptions.service";
import { HttpError } from "../../utils/http-error";
import { createAiProvider } from "../../services/ai/ai-provider.factory";

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
  let scanFile: Express.Multer.File | null;

  try {
    scanFile = await resolvePrescriptionScanFile({
      file: req.file,
      body: req.body
    });
  } catch (error) {
    if (error instanceof HttpError && error.details && typeof error.details === "object" && "scanError" in error.details) {
      return res
        .status(error.statusCode)
        .json(buildScanFailureResponse((error.details as { scanError: any }).scanError, error.message));
    }

    throw error;
  }

  if (!scanFile) {
    return res
      .status(400)
      .json(
        buildScanFailureResponse(
          "NO_IMAGE",
          'No image provided. Send multipart field "image" or "file", or provide imageBase64 or imageUrl.'
        )
      );
  }

  const data = await decodePrescriptionUpload({
    jwt: req.auth!.token,
    clerkUserId: req.auth!.clerkUserId,
    file: scanFile,
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

export async function createManualPrescriptionDraftHandler(req: Request, res: Response) {
  const data = await createManualPrescriptionDraft(req.auth!.token, req.body);
  return ok(res, data, "Manual prescription draft created");
}

export async function reconcilePrescriptionHandler(req: Request, res: Response) {
  const data = await reconcilePrescription(req.auth!.token, req.params.id, req.body);
  return ok(res, data, "Prescription reconciliation saved");
}

export async function processPrescriptionV2Handler(req: Request, res: Response) {
  const { ocrText, ocrMetadata, segmentation } = req.body;

  const aiProvider = createAiProvider();
  const parseResult = await aiProvider.processPrescription(ocrText, ocrMetadata, segmentation);

  return res.json({
    status: "success",
    message: "Prescription processed successfully",
    data: parseResult
  });
}
