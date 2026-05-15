import { env } from "../../config/env";
import { supabaseAdmin } from "../../lib/supabase";
import { writeAuditLog } from "../../services/audit.service";
import { ensureClosedBetaAccess } from "../../services/beta-access.service";
import { assertFeatureAccess, incrementScanUsage } from "../subscriptions/subscriptions.service";
import { createOcrProvider, currentOcrProviderName } from "../../services/ocr/ocr-provider.factory";
import { HttpError } from "../../utils/http-error";

const ocrProvider = createOcrProvider();
type ParsedOcrResult = Awaited<ReturnType<typeof ocrProvider.parsePrescription>>;
const OCR_PIPELINE_OPTIONAL_COLUMNS = [
  "cleaned_ocr_text",
  "parsed_medicine_json",
  "ai_provider",
  "ai_model",
  "ai_raw_response"
] as const;

function getOcrFailureMessage(metadata?: Record<string, unknown>) {
  const error = metadata?.error;
  return typeof error === "string" && error.trim() ? error : "OCR provider failed to parse the prescription";
}

function getParseFailureMessage(ocrResult: ParsedOcrResult) {
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
  await parsePrescription(input.jwt, uploaded.id);
  return getPrescription(input.jwt, uploaded.id);
}

export async function parsePrescription(jwt: string, prescriptionId: string) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const accessibleFamilyMemberIds = await getAccessibleFamilyMemberIds(currentUser.id);
  const { data: prescription, error } = await supabaseAdmin
    .from("prescriptions")
    .select("*, prescription_uploads(*)")
    .eq("id", prescriptionId)
    .single();
  if (error || !prescription) throw new HttpError(404, "Prescription not found", error);

  if (!accessibleFamilyMemberIds.includes(prescription.family_member_id)) {
    throw new HttpError(403, "Prescription is not accessible");
  }

  const upload = Array.isArray(prescription.prescription_uploads) ? prescription.prescription_uploads[0] : prescription.prescription_uploads;
  console.log("[prescription-ocr] Fetched prescription:", JSON.stringify(prescription, null, 2));
  console.log("[prescription-ocr] Computed upload metadata:", upload);
  
  if (!upload?.storage_path) {
    throw new HttpError(400, "Prescription upload metadata is missing");
  }

  try {
    const imageBuffer = await downloadPrescriptionFile(upload.storage_path);
    console.log("[prescription-ocr] downloaded image", {
      prescriptionId,
      storagePath: upload.storage_path,
      bytes: imageBuffer.length
    });
    const ocrResult = await withTimeout(
      ocrProvider.parsePrescription(imageBuffer),
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
    const averageConfidence =
      ocrResult.medications.length > 0
        ? ocrResult.medications.reduce((sum, medication) => sum + medication.confidenceScore, 0) / ocrResult.medications.length
        : null;
    const parseFailureMessage = ocrResult.parseStatus === "failed" ? getParseFailureMessage(ocrResult) : null;

    await updatePrescriptionOcrOutput(prescriptionId, ocrResult, averageConfidence);

    await supabaseAdmin.from("prescription_medications").delete().eq("prescription_id", prescriptionId);

    for (const med of ocrResult.medications) {
      const { error: medicationError } = await supabaseAdmin.from("prescription_medications").insert({
        prescription_id: prescriptionId,
        medicine_name: med.medicineName,
        generic_name: med.genericName ?? null,
        dosage: med.strength ?? med.dosage ?? null,
        frequency: med.frequency ?? null,
        timing: med.timing ?? null,
        duration: med.duration ?? null,
        instructions: med.instructions ?? null,
        food_timing: med.shorthandExplanation?.includes("food") ? med.shorthandExplanation : null,
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
      .eq("prescription_id", prescriptionId);

    await writeAuditLog({
      userId: currentUser.id,
      action: "prescription.parsed",
      entityType: "prescription",
      entityId: prescriptionId,
      metadata: {
        medications_detected: ocrResult.medications.length,
        parse_status: ocrResult.parseStatus,
        ocr_provider: currentOcrProviderName()
      }
    });

    return {
      prescriptionId,
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
        .eq("id", prescriptionId);
    }

    await supabaseAdmin
      .from("prescription_uploads")
      .update({
        processing_status: "ocr_failed",
        last_error: failureMessage,
        last_processed_at: new Date().toISOString()
      })
      .eq("prescription_id", prescriptionId);

    await writeAuditLog({
      userId: currentUser.id,
      action: "prescription.ocr_failed",
      entityType: "prescription",
      entityId: prescriptionId,
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
      : "user_verified";

  const insertPayload = {
    prescription_id: prescriptionId,
    medicine_name: String(input.medicine_name ?? "").trim(),
    brand_name: input.brand_name ?? null,
    generic_name: input.generic_name ?? null,
    dosage: input.dosage ?? null,
    frequency: input.frequency ?? null,
    timing: input.timing ?? null,
    duration: input.duration ?? null,
    food_timing: input.food_timing ?? null,
    instructions: input.instructions ?? null,
    confidence_score: typeof input.confidence_score === "number" ? input.confidence_score : 1,
    requires_manual_verification:
      typeof input.requires_manual_verification === "boolean" ? input.requires_manual_verification : false,
    verification_notes: input.verification_notes ?? "Added manually by caregiver",
    is_user_corrected: true,
    last_corrected_at: new Date().toISOString(),
    verified_at: verificationStatus !== "unverified" ? new Date().toISOString() : null,
    verified_by_user_id: verificationStatus !== "unverified" ? currentUser.id : null
  };

  if (!insertPayload.medicine_name) {
    throw new HttpError(400, "Medicine name is required");
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
      parse_status: "verified"
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
    metadata: { medication_id: medication.id, medicine_name: medication.medicine_name }
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
    .select("id, prescription_id, prescriptions!inner(family_member_id)")
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
    metadata: { verification_status: verificationStatus ?? null }
  });

  return medication;
}
