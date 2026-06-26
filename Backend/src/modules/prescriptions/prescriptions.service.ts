import { env } from "../../config/env";
import { Readable } from "stream";
import { supabaseAdmin } from "../../lib/supabase";
import { writeAuditLog } from "../../services/audit.service";
import { ensureClosedBetaAccess } from "../../services/beta-access.service";
import { assertFeatureAccess, incrementScanUsage } from "../subscriptions/subscriptions.service";
import { createOcrProvider, currentOcrProviderName } from "../../services/ocr/ocr-provider.factory";
import { HttpError } from "../../utils/http-error";
import { detectExcludedMedicine } from "../../utils/medicineSafety";
import { getMedicineTrustProfile } from "../../utils/medicineTrust";
import { computeConfidence } from "../../utils/confidenceEngine";

const ocrProvider = createOcrProvider();
type ParsedOcrResult = Awaited<ReturnType<typeof ocrProvider.parsePrescription>>;
const PRESCRIPTION_IMAGE_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
const OCR_PIPELINE_OPTIONAL_COLUMNS = [
  "cleaned_ocr_text",
  "parsed_medicine_json",
  "ai_provider",
  "ai_model",
  "ai_raw_response"
] as const;

type ScanFailureCode =
  | "OCR_FAILED"
  | "PARSE_FAILED"
  | "NO_IMAGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "INTERNAL_ERROR"
  | "PROVIDER_TIMEOUT";

export function buildScanFailureResponse(
  error: ScanFailureCode,
  message: string,
  extra: Record<string, unknown> = {}
) {
  return {
    success: false,
    error,
    message,
    provider: currentOcrProviderName(),
    rawText: "",
    cleanedText: "",
    confidence: 0,
    medicines: [],
    warnings: [],
    status: "failed" as const,
    ...extra
  };
}

function getMimeTypeFromDataUrl(value: string) {
  const match = value.match(/^data:([^;]+);base64,/i);
  return match?.[1]?.toLowerCase();
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  return "jpg";
}

function assertSupportedImage(mimeType: string, byteLength: number) {
  if (!PRESCRIPTION_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new HttpError(415, "Only JPEG, PNG, WebP, and HEIC prescription images are supported", {
      scanError: "UNSUPPORTED_FILE_TYPE"
    });
  }

  const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
  if (byteLength > maxBytes) {
    throw new HttpError(413, `Image must be under ${env.MAX_UPLOAD_MB}MB`, {
      scanError: "FILE_TOO_LARGE"
    });
  }
}

function buildMulterFileFromBuffer(input: {
  fieldname: string;
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}): Express.Multer.File {
  return {
    fieldname: input.fieldname,
    originalname: input.originalname,
    encoding: "7bit",
    mimetype: input.mimetype,
    size: input.buffer.length,
    buffer: input.buffer,
    stream: Readable.from(input.buffer),
    destination: "",
    filename: input.originalname,
    path: ""
  };
}

async function resolveImageUrl(value: string) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new HttpError(400, "Invalid imageUrl", { scanError: "NO_IMAGE" });
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new HttpError(400, "imageUrl must use http or https", { scanError: "NO_IMAGE" });
  }

  const response = await fetch(parsedUrl);
  if (!response.ok) {
    throw new HttpError(400, "Could not fetch image from the provided URL", { scanError: "NO_IMAGE" });
  }

  const mimetype = (response.headers.get("content-type") ?? "image/jpeg").split(";")[0].toLowerCase();
  const buffer = Buffer.from(await response.arrayBuffer());
  assertSupportedImage(mimetype, buffer.length);

  return buildMulterFileFromBuffer({
    fieldname: "imageUrl",
    originalname: `prescription-url.${extensionForMimeType(mimetype)}`,
    mimetype,
    buffer
  });
}

export async function resolvePrescriptionScanFile(input: {
  file?: Express.Multer.File;
  body: Record<string, unknown>;
}) {
  if (input.file) {
    return input.file;
  }

  if (typeof input.body.imageBase64 === "string" && input.body.imageBase64.trim()) {
    const imageBase64 = input.body.imageBase64.trim();
    const mimetype = (
      getMimeTypeFromDataUrl(imageBase64) ??
      (typeof input.body.mimeType === "string" ? input.body.mimeType : "image/jpeg")
    ).toLowerCase();
    const base64 = imageBase64.replace(/^data:[^;]+;base64,/i, "");
    const buffer = Buffer.from(base64, "base64");
    assertSupportedImage(mimetype, buffer.length);

    return buildMulterFileFromBuffer({
      fieldname: "imageBase64",
      originalname: `prescription-base64.${extensionForMimeType(mimetype)}`,
      mimetype,
      buffer
    });
  }

  if (typeof input.body.imageUrl === "string" && input.body.imageUrl.trim()) {
    return resolveImageUrl(input.body.imageUrl.trim());
  }

  return null;
}

function getOcrFailureMessage(metadata?: Record<string, unknown>) {
  const error = metadata?.error;
  return typeof error === "string" && error.trim() ? error : "OCR provider failed to parse the prescription";
}

function getParseFailureMessage(ocrResult: ParsedOcrResult) {
  const failureReason = ocrResult.providerMetadata?.failure_reason;
  if (failureReason === "no_text_detected") {
    return "We could not detect enough readable prescription text. Try a clearer image, tighter crop, and better lighting.";
  }

  const providerError = ocrResult.providerMetadata?.error;
  if (typeof providerError === "string" && providerError.trim()) {
    return providerError;
  }

  if (ocrResult.medications.length === 0) {
    return "No medicines were extracted automatically";
  }

  return getOcrFailureMessage(ocrResult.providerMetadata);
}

function isOcrProviderFailure(error: unknown) {
  return (
    (error instanceof HttpError && error.statusCode === 502) ||
    (error instanceof Error && error.message.startsWith("OCR provider timed out"))
  );
}

function isMissingSchemaColumnError(error: unknown, column: string) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return (
    record.code === "PGRST204" &&
    typeof record.message === "string" &&
    record.message.includes(`'${column}'`)
  );
}

async function updatePrescriptionOcrOutput(
  prescriptionId: string,
  ocrResult: ParsedOcrResult,
  averageConfidence: number | null
) {
  const parsedMedicineJson =
    ocrResult.cardData ??
    {
      status: ocrResult.medications.length > 0 ? "success" : "failed",
      ocr_quality: "medium",
      prescription_summary: {
        total_medicines: ocrResult.medications.length,
        confidence_score: averageConfidence ?? 0
      },
      medicines: ocrResult.medications.map((medication, index) => ({
        id: index + 1,
        medicine_name: medication.medicineName,
        generic_name: medication.genericName ?? "",
        strength: medication.strength ?? medication.dosage ?? "",
        form: medication.form ?? "",
        dose: medication.dose ?? "",
        frequency: medication.frequency ?? "",
        timing: medication.timing ?? "",
        duration: medication.duration ?? "",
        instructions: medication.instructions ?? "",
        uses: medication.uses ?? [],
        warnings: medication.warnings ?? [],
        quantity: medication.quantity ?? "",
        confidence: medication.confidence ?? "medium"
      })),
      important_notes: [],
      raw_detected_text_summary: ocrResult.cleanedText ?? ocrResult.rawText
    };

  const fullPayload = {
    raw_ocr_text: ocrResult.rawText,
    cleaned_ocr_text: ocrResult.cleanedText ?? null,
    parse_status: ocrResult.parseStatus,
    ocr_confidence_score: averageConfidence,
    ocr_provider: currentOcrProviderName(),
    ocr_provider_metadata: ocrResult.providerMetadata ?? {},
    parsed_medicine_json: parsedMedicineJson,
    ai_provider: ocrResult.aiProvider ?? null,
    ai_model: ocrResult.aiModel ?? null,
    ai_raw_response: ocrResult.rawModelResponse ?? null
  };

  const { error: updateError } = await supabaseAdmin
    .from("prescriptions")
    .update(fullPayload)
    .eq("id", prescriptionId);

  if (!updateError) {
    return;
  }

  const shouldFallback = OCR_PIPELINE_OPTIONAL_COLUMNS.some((column) => isMissingSchemaColumnError(updateError, column));

  if (!shouldFallback) {
    throw new HttpError(500, "Failed to update OCR output", updateError);
  }

  console.log("[prescription-ocr] optional OCR pipeline columns missing; falling back to legacy schema", {
    prescriptionId,
    error: updateError
  });

  const legacyPayload = {
    raw_ocr_text: ocrResult.rawText,
    parse_status: ocrResult.parseStatus,
    ocr_confidence_score: averageConfidence,
    ocr_provider: currentOcrProviderName(),
    ocr_provider_metadata: ocrResult.providerMetadata ?? {}
  };

  const { error: legacyUpdateError } = await supabaseAdmin
    .from("prescriptions")
    .update(legacyPayload)
    .eq("id", prescriptionId);

  if (legacyUpdateError) {
    throw new HttpError(500, "Failed to update OCR output", legacyUpdateError);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout!);
  }
}

async function getAccessibleFamilyMemberIds(userId: string, familyMemberId?: string) {
  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("family_group_memberships")
    .select("family_group_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (membershipsError) {
    throw new HttpError(500, "Failed to fetch family memberships", membershipsError);
  }

  const familyGroupIds = (memberships ?? []).map((membership) => membership.family_group_id);

  if (familyGroupIds.length === 0) {
    return [];
  }

  let query = supabaseAdmin.from("family_members").select("id").in("family_group_id", familyGroupIds);
  query = query.eq("is_archived", false);

  if (familyMemberId) {
    query = query.eq("id", familyMemberId);
  }

  const { data, error } = await query;

  if (error) {
    throw new HttpError(500, "Failed to fetch accessible family members", error);
  }

  return (data ?? []).map((member) => member.id);
}

async function cleanupUploadedPrescriptionFile(storagePath: string) {
  await supabaseAdmin.storage.from(env.SUPABASE_STORAGE_BUCKET).remove([storagePath]);
}

async function buildSignedPrescriptionUrl(storagePath: string) {
  const { data, error } = await supabaseAdmin.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 10);

  if (error) throw new HttpError(500, "Failed to create signed prescription URL", error);
  return data.signedUrl;
}

async function downloadPrescriptionFile(storagePath: string) {
  const { data, error } = await supabaseAdmin.storage.from(env.SUPABASE_STORAGE_BUCKET).download(storagePath);
  if (error || !data) throw new HttpError(500, "Failed to download prescription image", error);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function uploadPrescription(input: {
  jwt: string;
  clerkUserId: string;
  file: Express.Multer.File;
  body: Record<string, unknown>;
}) {
  const currentUser = await ensureClosedBetaAccess(input.jwt);
  await assertFeatureAccess({ jwt: input.jwt, feature: "prescription_scan" });
  const familyMemberId = String(input.body.family_member_id ?? "");
  const accessibleFamilyMemberIds = await getAccessibleFamilyMemberIds(currentUser.id, familyMemberId);

  console.log("[prescription-upload] received file", {
    originalName: input.file.originalname,
    mimetype: input.file.mimetype,
    size: input.file.size,
    familyMemberId
  });

  if (!accessibleFamilyMemberIds.includes(familyMemberId)) {
    throw new HttpError(403, "Family member is not accessible");
  }

  const filename = `${Date.now()}-${input.file.originalname}`.replace(/\s+/g, "-");
  const storagePath = `${input.clerkUserId}/${filename}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(storagePath, input.file.buffer, {
      cacheControl: "3600",
      contentType: input.file.mimetype,
      upsert: false
    });
  if (uploadError) {
    await writeAuditLog({
      userId: currentUser.id,
      action: "prescription.upload_failed",
      entityType: "prescription_upload",
      metadata: { storage_path: storagePath, reason: uploadError.message }
    });
    throw new HttpError(500, "Failed to upload prescription image", uploadError);
  }

  const { data: prescription, error } = await supabaseAdmin
    .from("prescriptions")
    .insert({
      family_member_id: familyMemberId,
      uploaded_by_user_id: currentUser.id,
      doctor_name: input.body.doctor_name ?? null,
      hospital_name: input.body.hospital_name ?? null,
      prescription_date: input.body.prescription_date ?? null,
      image_url: null,
      parse_status: "pending",
      verification_status: "unverified"
    })
    .select("*")
    .single();

  if (error || !prescription) {
    await cleanupUploadedPrescriptionFile(storagePath);
    throw new HttpError(500, "Failed to store prescription record", error);
  }

  const { error: metadataError } = await supabaseAdmin.from("prescription_uploads").insert({
    prescription_id: prescription.id,
    storage_bucket: env.SUPABASE_STORAGE_BUCKET,
    storage_path: storagePath,
    mime_type: input.file.mimetype,
    file_size_bytes: input.file.size,
    processing_status: "ocr_pending"
  });

  if (metadataError) {
    await supabaseAdmin.from("prescriptions").delete().eq("id", prescription.id);
    await cleanupUploadedPrescriptionFile(storagePath);
    throw new HttpError(500, "Failed to store prescription upload metadata", metadataError);
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "prescription.uploaded",
    entityType: "prescription",
    entityId: prescription.id,
    metadata: { family_member_id: prescription.family_member_id, file_size_bytes: input.file.size }
  });
  await incrementScanUsage(currentUser.id);

  return {
    ...prescription,
    image_url: await buildSignedPrescriptionUrl(storagePath)
  };
}

export async function decodePrescriptionUpload(input: {
  jwt: string;
  clerkUserId: string;
  file: Express.Multer.File;
  body: Record<string, unknown>;
}) {
  const uploaded = await uploadPrescription(input);
  await parsePrescription(input.jwt, uploaded.id, {
    extractedText: input.body.extractedText as string,
    ocrMetadata: input.body.ocrMetadata as Record<string, unknown>
  });
  return getPrescription(input.jwt, uploaded.id);
}

function mapFrequencyMeaning(value?: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "od") return "once daily";
  if (normalized === "bd") return "twice daily";
  if (normalized === "tds" || normalized === "tid") return "three times daily";
  if (normalized === "qid") return "four times daily";
  if (normalized === "hs") return "at bedtime";
  if (normalized === "sos") return "as needed";
  return normalized ? String(value) : undefined;
}

function mapDurationDays(value?: string | null) {
  const match = String(value ?? "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function deriveFoodTiming(value?: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes("after food")) return "after food";
  if (normalized.includes("before food")) return "before food";
  if (normalized.includes("with food")) return "with food";
  return undefined;
}

function getPrescriptionMedicinesForScan(details: any) {
  const stored = Array.isArray(details.prescription_medications) ? details.prescription_medications : [];
  const fallback = Array.isArray(details.parsed_medicine_json?.medicines) ? details.parsed_medicine_json.medicines : [];

  if (stored.length > 0) {
    return stored.map((medicine: any) => ({
      name: String(medicine.medicine_name ?? ""),
      strength: String(medicine.dosage ?? ""),
      dose: String(medicine.dosage ?? ""),
      frequency: String(medicine.frequency ?? ""),
      frequencyMeaning: mapFrequencyMeaning(medicine.frequency) ?? "",
      foodTiming: String(medicine.food_timing ?? deriveFoodTiming(medicine.timing) ?? ""),
      durationDays: mapDurationDays(medicine.duration),
      instructions: String(medicine.instructions ?? ""),
      confidence: typeof medicine.confidence_score === "number" ? medicine.confidence_score : 0,
      needsReview: medicine.requires_manual_verification !== false
    }));
  }

  return fallback.map((medicine: any) => ({
    name: String(medicine.medicine_name ?? ""),
    strength: String(medicine.strength ?? medicine.dosage ?? ""),
    dose: String(medicine.dose ?? medicine.dosage ?? ""),
    frequency: String(medicine.frequency ?? ""),
    frequencyMeaning: mapFrequencyMeaning(medicine.frequency) ?? "",
    foodTiming: deriveFoodTiming(medicine.timing) ?? "",
    durationDays: mapDurationDays(medicine.duration),
    instructions: String(medicine.instructions ?? ""),
    confidence:
      typeof medicine.confidence_score === "number"
        ? medicine.confidence_score
        : medicine.confidence === "high"
          ? 0.9
          : medicine.confidence === "medium"
            ? 0.7
            : 0.4,
    needsReview: medicine.requires_manual_verification !== false
  }));
}

export function mapPrescriptionToScanResponse(details: any) {
  const rawText = String(details.cleaned_ocr_text ?? details.raw_ocr_text ?? "").trim();
  const cleanedText = String(details.cleaned_ocr_text ?? rawText).trim();
  const medicines = getPrescriptionMedicinesForScan(details).filter((medicine: any) => medicine.name);
  const upload = Array.isArray(details.prescription_uploads) ? details.prescription_uploads[0] : details.prescription_uploads;
  const provider = String(details.ocr_provider_metadata?.provider ?? details.ocr_provider ?? currentOcrProviderName());
  const warnings = Array.isArray(details.parsed_medicine_json?.important_notes)
    ? details.parsed_medicine_json.important_notes.filter((value: unknown) => typeof value === "string" && value.trim())
    : [];
  const confidence =
    typeof details.parsed_medicine_json?.prescription_summary?.confidence_score === "number"
      ? details.parsed_medicine_json.prescription_summary.confidence_score
      : medicines.length > 0
        ? medicines.reduce((sum: number, medicine: any) => sum + (medicine.confidence ?? 0), 0) / medicines.length
        : 0;
  const reviewWarnings = medicines.some((medicine: any) => medicine.needsReview)
    ? ["Some medicines have low confidence and require verification."]
    : [];
  const stableWarnings = [...new Set([...warnings, ...reviewWarnings])];

  if (!rawText) {
    return {
      success: false,
      error: "OCR_FAILED",
      message: "We could not read this prescription clearly. Please retake the photo or enter details manually.",
      provider,
      rawText: "",
      cleanedText: "",
      confidence: 0,
      medicines: [],
      warnings: stableWarnings,
      status: "failed" as const,
      prescriptionId: details.id,
      prescription: details,
      uploadError: upload?.last_error ?? null
    };
  }

  if (medicines.length === 0) {
    return {
      success: false,
      error: "PARSE_FAILED",
      provider,
      rawText,
      cleanedText,
      confidence,
      medicines: [],
      warnings: stableWarnings,
      message: "Text was extracted, but medicines could not be parsed safely.",
      status: "failed" as const,
      prescriptionId: details.id,
      prescription: details,
      uploadError: upload?.last_error ?? null
    };
  }

  return {
    success: true,
    provider,
    rawText,
    cleanedText,
    confidence,
    medicines,
    warnings: stableWarnings,
    status: "pending_verification" as const,
    prescriptionId: details.id,
    prescription: details
  };
}

export async function parsePrescription(
  jwt: string,
  prescriptionId: string,
  options?: {
    extractedText?: string;
    ocrMetadata?: Record<string, unknown>;
    familyMemberId?: string;
  }
) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const accessibleFamilyMemberIds = await getAccessibleFamilyMemberIds(currentUser.id);

  let targetPrescriptionId = prescriptionId;
  let familyMemberId = options?.familyMemberId;

  if (!targetPrescriptionId && options?.extractedText && familyMemberId) {
    // New /api/v2/process path: create a prescription record if it doesn't exist
    const { data: newPrescription, error: createError } = await supabaseAdmin
      .from("prescriptions")
      .insert({
        family_member_id: familyMemberId,
        uploaded_by_user_id: currentUser.id,
        parse_status: "pending",
        verification_status: "unverified",
        raw_ocr_text: options.extractedText
      })
      .select("*")
      .single();

    if (createError || !newPrescription) {
      throw new HttpError(500, "Failed to create prescription for processing", createError);
    }
    targetPrescriptionId = newPrescription.id;
  }

  const { data: prescription, error } = await supabaseAdmin
    .from("prescriptions")
    .select("*, prescription_uploads(*)")
    .eq("id", targetPrescriptionId)
    .single();

  if (error || !prescription) throw new HttpError(404, "Prescription not found", error);

  if (!accessibleFamilyMemberIds.includes(prescription.family_member_id)) {
    throw new HttpError(403, "Prescription is not accessible");
  }

  const upload = Array.isArray(prescription.prescription_uploads) ? prescription.prescription_uploads[0] : prescription.prescription_uploads;
  
  try {
    let imageBuffer = Buffer.alloc(0);
    if (!options?.extractedText) {
      if (!upload?.storage_path) {
        throw new HttpError(400, "Prescription upload metadata is missing for image processing");
      }
      imageBuffer = await downloadPrescriptionFile(upload.storage_path);
      console.log("[prescription-ocr] downloaded image", {
        prescriptionId: targetPrescriptionId,
        storagePath: upload.storage_path,
        bytes: imageBuffer.length
      });
    } else {
      console.log("[prescription-ocr] skipping image download, using extracted text");
    }
    const ocrResult = await withTimeout(
      ocrProvider.parsePrescription(imageBuffer, {
        extractedText: options?.extractedText,
        ocrMetadata: options?.ocrMetadata
      }),
      env.OCR_TIMEOUT_MS,
      `OCR provider timed out after ${env.OCR_TIMEOUT_MS}ms`
    );
    console.log("[prescription-ocr] OCR API response", {
      prescriptionId,
      provider: currentOcrProviderName(),
      parseStatus: ocrResult.parseStatus,
      medicationsDetected: ocrResult.medications.length,
      rawTextLength: ocrResult.rawText.length,
      rawTextPreview: ocrResult.rawText.slice(0, 500),
      providerMetadata: ocrResult.providerMetadata
    });
    // Re-score the medications with the dynamic confidence engine
    // We pass the existing medicines so duplicate detection logic triggers
    ocrResult.medications.forEach((medication, i) => {
      const existingMedicinesForDuplicateCheck = ocrResult.medications
        .filter((_, idx) => idx !== i)
        .map(m => ({
          medicine_name: m.medicineName,
          generic_name: m.genericName,
          strength: m.strength,
          dosage: m.dosage
        }));

      const confidenceRes = computeConfidence(
        {
          medicineName: medication.medicineName,
          genericName: medication.genericName,
          strength: medication.strength,
          dosage: medication.dosage,
          frequency: medication.frequency,
          ocrConfidence: medication.confidenceScore, // using confidenceScore as a fallback signal for now
          medGemmaConfidence: medication.confidenceScore
        },
        existingMedicinesForDuplicateCheck
      );
      medication.confidenceScore = confidenceRes.confidenceScore;
      medication.requiresManualVerification = confidenceRes.level !== "Auto Accept";
      if (confidenceRes.level === "Auto Accept") medication.confidence = "high";
      else if (confidenceRes.level === "Review") medication.confidence = "medium";
      else medication.confidence = "low";
      if (confidenceRes.validationFailures.length > 0) {
        if (!medication.warnings) medication.warnings = [];
        medication.warnings.push(...confidenceRes.validationFailures);
      }
    });

    const averageConfidence =
      ocrResult.medications.length > 0
        ? ocrResult.medications.reduce((sum, medication) => sum + medication.confidenceScore, 0) / ocrResult.medications.length
        : null;
    const parseFailureMessage = ocrResult.parseStatus === "failed" ? getParseFailureMessage(ocrResult) : null;

    await updatePrescriptionOcrOutput(targetPrescriptionId, ocrResult, averageConfidence);

    await supabaseAdmin.from("prescription_medications").delete().eq("prescription_id", targetPrescriptionId);

    for (const med of ocrResult.medications) {
      const { error: medicationError } = await supabaseAdmin.from("prescription_medications").insert({
        prescription_id: targetPrescriptionId,
        medicine_name: med.medicineName,
        generic_name: med.genericName ?? null,
        dosage: med.strength ?? med.dosage ?? null,
        frequency: med.frequency ?? null,
        timing: med.timing ?? null,
        duration: med.duration ?? null,
        instructions: med.instructions ?? null,
        food_timing: med.foodTiming ?? (med.shorthandExplanation?.includes("food") ? med.shorthandExplanation : null),
        shorthand_detected: med.shorthandDetected,
        shorthand_explanation: med.shorthandExplanation ?? null,
        confidence_score: med.confidenceScore,
        requires_manual_verification: med.requiresManualVerification
      });

      if (medicationError) {
        throw new HttpError(500, "Failed to store parsed medication", medicationError);
      }
    }

    await supabaseAdmin
      .from("prescription_uploads")
      .update({
        processing_status: ocrResult.parseStatus === "failed" ? "ocr_failed" : "ocr_processed",
        last_error: parseFailureMessage,
        last_processed_at: new Date().toISOString()
      })
      .eq("prescription_id", targetPrescriptionId);

    await writeAuditLog({
      userId: currentUser.id,
      action: "prescription.parsed",
      entityType: "prescription",
      entityId: targetPrescriptionId,
      metadata: {
        medications_detected: ocrResult.medications.length,
        parse_status: ocrResult.parseStatus,
        ocr_provider: currentOcrProviderName()
      }
    });

    return {
      prescriptionId: targetPrescriptionId,
      parseStatus: ocrResult.parseStatus,
      medicationsDetected: ocrResult.medications.length,
      ocrProvider: currentOcrProviderName(),
      aiProvider: ocrResult.aiProvider ?? null,
      aiModel: ocrResult.aiModel ?? null
    };
  } catch (error) {
    console.log("[prescription-ocr] extraction/parsing error", error);
    const failureMessage = error instanceof Error ? error.message : "OCR parsing failed";

    if (isOcrProviderFailure(error)) {
      await supabaseAdmin
        .from("prescriptions")
        .update({
          parse_status: "failed",
          ocr_provider: currentOcrProviderName(),
          ocr_provider_metadata: {
            error: failureMessage,
            provider: currentOcrProviderName()
          }
        })
        .eq("id", targetPrescriptionId);
    }

    await supabaseAdmin
      .from("prescription_uploads")
      .update({
        processing_status: "ocr_failed",
        last_error: failureMessage,
        last_processed_at: new Date().toISOString()
      })
      .eq("prescription_id", targetPrescriptionId);

    await writeAuditLog({
      userId: currentUser.id,
      action: "prescription.ocr_failed",
      entityType: "prescription",
      entityId: targetPrescriptionId,
      metadata: { reason: failureMessage }
    });

    throw error;
  }
}

export async function getPrescription(jwt: string, id: string) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const accessibleFamilyMemberIds = await getAccessibleFamilyMemberIds(currentUser.id);
  const { data, error } = await supabaseAdmin
    .from("prescriptions")
    .select("*, prescription_medications(*), prescription_uploads(*)")
    .eq("id", id)
    .single();
  if (error || !data) throw new HttpError(404, "Prescription not found", error);

  if (!accessibleFamilyMemberIds.includes(data.family_member_id)) {
    throw new HttpError(403, "Prescription is not accessible");
  }

  const upload = Array.isArray(data.prescription_uploads) ? data.prescription_uploads[0] : data.prescription_uploads;
  const imageUrl = upload?.storage_path ? await buildSignedPrescriptionUrl(upload.storage_path) : null;

  return {
    ...data,
    image_url: imageUrl
  };
}

export async function getPrescriptionHistory(jwt: string) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const accessibleFamilyMemberIds = await getAccessibleFamilyMemberIds(currentUser.id);

  if (accessibleFamilyMemberIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("prescriptions")
    .select("*, family_members(full_name), prescription_medications(id), prescription_uploads(id, processing_status, last_error)")
    .in("family_member_id", accessibleFamilyMemberIds)
    .order("created_at", { ascending: false });
  if (error) throw new HttpError(500, "Failed to fetch history", error);
  return data;
}

export async function createManualPrescriptionDraft(jwt: string, input: { family_member_id: string }) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const accessibleFamilyMemberIds = await getAccessibleFamilyMemberIds(currentUser.id, input.family_member_id);

  if (!accessibleFamilyMemberIds.includes(input.family_member_id)) {
    throw new HttpError(403, "Family member is not accessible");
  }

  const { data: prescription, error } = await supabaseAdmin
    .from("prescriptions")
    .insert({
      family_member_id: input.family_member_id,
      uploaded_by_user_id: currentUser.id,
      doctor_name: null,
      hospital_name: null,
      prescription_date: new Date().toISOString().slice(0, 10),
      image_url: null,
      parse_status: "parsed",
      verification_status: "unverified",
      raw_ocr_text: null,
      ocr_confidence_score: null,
      ocr_provider: "manual_entry",
      ocr_provider_metadata: { source: "manual_entry" }
    })
    .select("*")
    .single();

  if (error || !prescription) {
    throw new HttpError(500, "Failed to create manual prescription draft", error);
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "prescription.manual_draft_created",
    entityType: "prescription",
    entityId: prescription.id,
    metadata: { family_member_id: input.family_member_id }
  });

  return {
    ...prescription,
    prescription_medications: [],
    prescription_uploads: [],
    image_url: null
  };
}

export async function createManualMedication(jwt: string, prescriptionId: string, input: Record<string, unknown>) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const accessibleFamilyMemberIds = await getAccessibleFamilyMemberIds(currentUser.id);
  const { data: prescription, error } = await supabaseAdmin
    .from("prescriptions")
    .select("id, family_member_id, verification_status")
    .eq("id", prescriptionId)
    .single();

  if (error || !prescription) {
    throw new HttpError(404, "Prescription not found", error);
  }

  if (!accessibleFamilyMemberIds.includes(prescription.family_member_id)) {
    throw new HttpError(403, "Prescription is not accessible");
  }

  const verificationStatus =
    typeof input.verification_status === "string" && input.verification_status
      ? input.verification_status
      : "unverified";

  const insertPayload = {
    prescription_id: prescriptionId,
    medicine_name: String(input.medicine_name ?? "").trim(),
    brand_name: input.brand_name ?? null,
    generic_name: input.generic_name ?? null,
    strength: input.strength ?? null,
    dose: input.dose ?? null,
    dosage: input.dosage ?? null,
    frequency: input.frequency ?? null,
    timing: input.timing ?? null,
    duration: input.duration ?? null,
    food_timing: input.food_timing ?? null,
    quantity_purchased: input.quantity_purchased ?? null,
    start_date: input.start_date ?? null,
    instructions: input.instructions ?? null,
    confidence_score: typeof input.confidence_score === "number" ? input.confidence_score : 0,
    requires_manual_verification:
      typeof input.requires_manual_verification === "boolean" ? input.requires_manual_verification : true,
    verification_notes: input.verification_notes ?? "Added manually by caregiver",
    trust_metadata: getMedicineTrustProfile({
      medicine_name: String(input.medicine_name ?? "").trim(),
      brand_name: typeof input.brand_name === "string" ? input.brand_name : null,
      generic_name: typeof input.generic_name === "string" ? input.generic_name : null,
      strength: typeof input.strength === "string" ? input.strength : null,
      dosage: typeof input.dosage === "string" ? input.dosage : null
    }),
    continuity_status: "draft",
    is_user_corrected: true,
    last_corrected_at: new Date().toISOString(),
    verified_at: verificationStatus !== "unverified" ? new Date().toISOString() : null,
    verified_by_user_id: verificationStatus !== "unverified" ? currentUser.id : null
  };

  if (!insertPayload.medicine_name) {
    throw new HttpError(400, "Medicine name is required");
  }

  const excludedSignal = detectExcludedMedicine(insertPayload);
  if (excludedSignal && verificationStatus !== "unverified") {
    throw new HttpError(422, `${excludedSignal.label} is not supported for activation during this beta`);
  }

  const { data: medication, error: medicationError } = await supabaseAdmin
    .from("prescription_medications")
    .insert(insertPayload)
    .select("*")
    .single();

  if (medicationError || !medication) {
    throw new HttpError(500, "Failed to create prescription medication", medicationError);
  }

  const { error: prescriptionUpdateError } = await supabaseAdmin
    .from("prescriptions")
    .update({
      verification_status: verificationStatus,
      parse_status: verificationStatus === "unverified" ? "parsed" : "verified"
    })
    .eq("id", prescriptionId);

  if (prescriptionUpdateError) {
    throw new HttpError(500, "Failed to update prescription verification status", prescriptionUpdateError);
  }

  await supabaseAdmin
    .from("prescription_uploads")
    .update({
      processing_status: "ocr_processed",
      last_error: null,
      last_processed_at: new Date().toISOString()
    })
    .eq("prescription_id", prescriptionId);

  await writeAuditLog({
    userId: currentUser.id,
    action: "prescription.medication_added_manually",
    entityType: "prescription",
    entityId: prescriptionId,
    metadata: {
      medication_id: medication.id,
      medicine_name: medication.medicine_name,
      verification_status: verificationStatus,
      excluded_category: excludedSignal?.category ?? null
    }
  });

  return medication;
}

export async function updateParsedMedication(jwt: string, medicationId: string, input: Record<string, unknown>) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const verificationStatus = input.verification_status;
  const updatePayload = {
    ...input,
    is_user_corrected: true,
    last_corrected_at: new Date().toISOString(),
    verified_at: verificationStatus && verificationStatus !== "unverified" ? new Date().toISOString() : null,
    verified_by_user_id: verificationStatus && verificationStatus !== "unverified" ? currentUser.id : null,
    requires_manual_verification: verificationStatus && verificationStatus !== "unverified" ? false : true
  };

  delete (updatePayload as { verification_status?: unknown }).verification_status;

  const { data: existingMedication, error: existingMedicationError } = await supabaseAdmin
    .from("prescription_medications")
    .select("id, prescription_id, medicine_name, brand_name, generic_name, instructions, prescriptions!inner(family_member_id)")
    .eq("id", medicationId)
    .single();

  if (existingMedicationError || !existingMedication) {
    throw new HttpError(404, "Parsed medication not found", existingMedicationError);
  }

  const prescriptionRelation = Array.isArray((existingMedication as any).prescriptions)
    ? (existingMedication as any).prescriptions[0]
    : (existingMedication as any).prescriptions;
  const familyMemberId = prescriptionRelation?.family_member_id;
  const accessibleFamilyMemberIds = await getAccessibleFamilyMemberIds(currentUser.id, familyMemberId);

  if (!familyMemberId || !accessibleFamilyMemberIds.includes(familyMemberId)) {
    throw new HttpError(403, "Parsed medication is not accessible");
  }

  const excludedSignal = detectExcludedMedicine({ ...(existingMedication as Record<string, unknown>), ...input });
  if (excludedSignal && verificationStatus && verificationStatus !== "unverified") {
    throw new HttpError(422, `${excludedSignal.label} is not supported for activation during this beta`);
  }

  (updatePayload as Record<string, unknown>).trust_metadata = getMedicineTrustProfile({
    ...(existingMedication as Record<string, unknown>),
    ...input
  });

  const { data: medication, error: medicationError } = await supabaseAdmin
    .from("prescription_medications")
    .update(updatePayload)
    .eq("id", medicationId)
    .select("*")
    .single();

  if (medicationError || !medication) {
    throw new HttpError(500, "Failed to update parsed medication", medicationError);
  }

  if (verificationStatus) {
    const { error: prescriptionError } = await supabaseAdmin
      .from("prescriptions")
      .update({ verification_status: verificationStatus })
      .eq("id", medication.prescription_id);

    if (prescriptionError) {
      throw new HttpError(500, "Failed to update prescription verification status", prescriptionError);
    }
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "prescription.medication_corrected",
    entityType: "prescription_medication",
    entityId: medicationId,
    metadata: { verification_status: verificationStatus ?? null, excluded_category: excludedSignal?.category ?? null }
  });

  return medication;
}

type ReconciliationAction = {
  type: "continue_unchanged" | "update_existing" | "replace_existing" | "discontinue" | "add_new" | "keep_active";
  existing_medication_id?: string;
  new_medication_id?: string;
  stop_old?: boolean;
  begin_date?: string;
  note?: string;
};

export async function reconcilePrescription(jwt: string, prescriptionId: string, input: { actions?: ReconciliationAction[]; superseded_prescription_ids?: string[] }) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const { data: prescription, error: prescriptionError } = await supabaseAdmin
    .from("prescriptions")
    .select("id, family_member_id, created_at")
    .eq("id", prescriptionId)
    .single();

  if (prescriptionError || !prescription) {
    throw new HttpError(404, "Prescription not found", prescriptionError);
  }

  const accessibleFamilyMemberIds = await getAccessibleFamilyMemberIds(currentUser.id, prescription.family_member_id);
  if (!accessibleFamilyMemberIds.includes(prescription.family_member_id)) {
    throw new HttpError(403, "Prescription is not accessible");
  }

  const actions = input.actions ?? [];
  const medicationIds = Array.from(
    new Set(
      actions
        .flatMap((action) => [action.existing_medication_id, action.new_medication_id])
        .filter((id): id is string => Boolean(id))
    )
  );

  const medicationById = new Map<string, any>();
  if (medicationIds.length > 0) {
    const { data: medications, error: medicationsError } = await supabaseAdmin
      .from("prescription_medications")
      .select("id, prescription_id, medicine_name, brand_name, generic_name, strength, dosage, prescriptions!inner(family_member_id)")
      .in("id", medicationIds);

    if (medicationsError) {
      throw new HttpError(500, "Failed to load reconciliation medicines", medicationsError);
    }

    for (const medication of medications ?? []) {
      const relation = Array.isArray((medication as any).prescriptions)
        ? (medication as any).prescriptions[0]
        : (medication as any).prescriptions;
      if (relation?.family_member_id !== prescription.family_member_id) {
        throw new HttpError(403, "Reconciliation medicine is not accessible for this patient");
      }
      medicationById.set(medication.id, medication);
    }
  }

  const now = new Date().toISOString();
  const stoppedMedicationIds: string[] = [];
  const preservedMedicationIds: string[] = [];
  const newMedicationIds: string[] = [];
  const supersededPrescriptionIds = new Set(input.superseded_prescription_ids ?? []);

  for (const action of actions) {
    const oldMedication = action.existing_medication_id ? medicationById.get(action.existing_medication_id) : null;
    const newMedication = action.new_medication_id ? medicationById.get(action.new_medication_id) : null;

    if (action.existing_medication_id && !oldMedication) {
      throw new HttpError(404, "Existing medication in reconciliation was not found");
    }

    if (action.new_medication_id && !newMedication) {
      throw new HttpError(404, "New medication in reconciliation was not found");
    }

    if (oldMedication?.prescription_id && oldMedication.prescription_id !== prescriptionId) {
      supersededPrescriptionIds.add(oldMedication.prescription_id);
    }

    if (action.type === "add_new" && newMedication) {
      newMedicationIds.push(newMedication.id);
      await supabaseAdmin
        .from("prescription_medications")
        .update({
          continuity_status: "draft",
          requires_manual_verification: true,
          verified_at: null,
          verified_by_user_id: null,
          continuity_note: action.note ?? "New medicine from reconciliation; verification required before activation",
          trust_metadata: getMedicineTrustProfile(newMedication)
        })
        .eq("id", newMedication.id);
      continue;
    }

    if ((action.type === "discontinue" || action.type === "replace_existing" || action.type === "update_existing") && oldMedication) {
      const shouldStopOld = action.type === "discontinue" || action.type === "replace_existing" || action.stop_old === true;
      if (shouldStopOld) {
        stoppedMedicationIds.push(oldMedication.id);
        await supabaseAdmin
          .from("medication_schedules")
          .update({
            status: "completed",
            end_date: action.begin_date ?? new Date().toISOString().slice(0, 10),
            stopped_at: now,
            stopped_reason: action.type === "discontinue" ? "discontinued_in_reconciliation" : "replaced_in_reconciliation",
            continuity_note: action.note ?? "Stopped during prescription reconciliation"
          })
          .eq("prescription_medication_id", oldMedication.id)
          .eq("status", "active");

        await supabaseAdmin
          .from("prescription_medications")
          .update({
            continuity_status: action.type === "discontinue" ? "discontinued" : "replaced",
            replaced_by_medication_id: newMedication?.id ?? null,
            discontinued_at: now,
            continuity_note: action.note ?? "Changed during prescription reconciliation"
          })
          .eq("id", oldMedication.id);
      }
    }

    if ((action.type === "continue_unchanged" || action.type === "keep_active") && oldMedication) {
      preservedMedicationIds.push(oldMedication.id);
      await supabaseAdmin
        .from("prescription_medications")
        .update({
          continuity_status: "active",
          continuity_note: action.note ?? "Caregiver chose to keep active during reconciliation",
          trust_metadata: getMedicineTrustProfile(oldMedication)
        })
        .eq("id", oldMedication.id);
    }

    if ((action.type === "replace_existing" || action.type === "update_existing") && newMedication) {
      newMedicationIds.push(newMedication.id);
      await supabaseAdmin
        .from("prescription_medications")
        .update({
          continuity_status: "draft",
          requires_manual_verification: true,
          verified_at: null,
          verified_by_user_id: null,
          continuity_note: action.note ?? "Replacement/update medicine from reconciliation; verification required before activation",
          trust_metadata: getMedicineTrustProfile(newMedication)
        })
        .eq("id", newMedication.id);
    }
  }

  const archiveIds = Array.from(supersededPrescriptionIds).filter((id) => id !== prescriptionId);
  if (archiveIds.length > 0) {
    const archiveLabel = `Superseded on ${new Date().toISOString().slice(0, 10)} - replaced by prescription added ${String(prescription.created_at).slice(0, 10)}`;
    const { error: archiveError } = await supabaseAdmin
      .from("prescriptions")
      .update({
        archive_status: "superseded",
        superseded_at: now,
        superseded_by_prescription_id: prescriptionId,
        archive_label: archiveLabel
      })
      .in("id", archiveIds)
      .eq("family_member_id", prescription.family_member_id);

    if (archiveError) {
      throw new HttpError(500, "Failed to archive superseded prescriptions", archiveError);
    }
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "prescription.reconciliation_saved",
    entityType: "prescription",
    entityId: prescriptionId,
    metadata: {
      family_member_id: prescription.family_member_id,
      action_count: actions.length,
      stopped_medication_ids: stoppedMedicationIds,
      preserved_medication_ids: preservedMedicationIds,
      new_medication_ids: newMedicationIds,
      superseded_prescription_ids: archiveIds
    }
  });

  return {
    stopped_medication_ids: stoppedMedicationIds,
    preserved_medication_ids: preservedMedicationIds,
    new_medication_ids: newMedicationIds,
    superseded_prescription_ids: archiveIds,
    requires_verification_before_activation: newMedicationIds
  };
}
