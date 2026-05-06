import { env } from "../../config/env";
import { supabaseAdmin, getUserSupabaseClient } from "../../lib/supabase";
import { writeAuditLog } from "../../services/audit.service";
import { ensureClosedBetaAccess } from "../../services/beta-access.service";
import { createOcrProvider, currentOcrProviderName } from "../../services/ocr/ocr-provider.factory";
import { HttpError } from "../../utils/http-error";

const ocrProvider = createOcrProvider();

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
  const userClient = getUserSupabaseClient(input.jwt);
  const currentUser = await ensureClosedBetaAccess(input.jwt);
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

  const { data: prescription, error } = await userClient
    .from("prescriptions")
    .insert({
      family_member_id: input.body.family_member_id,
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

  const { error: metadataError } = await userClient.from("prescription_uploads").insert({
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

  return {
    ...prescription,
    image_url: await buildSignedPrescriptionUrl(storagePath)
  };
}

export async function parsePrescription(jwt: string, prescriptionId: string) {
  const sb = getUserSupabaseClient(jwt);
  const currentUser = await ensureClosedBetaAccess(jwt);
  const { data: prescription, error } = await sb
    .from("prescriptions")
    .select("*, prescription_uploads(*)")
    .eq("id", prescriptionId)
    .single();
  if (error || !prescription) throw new HttpError(404, "Prescription not found", error);

  const upload = Array.isArray(prescription.prescription_uploads) ? prescription.prescription_uploads[0] : null;
  if (!upload?.storage_path) {
    throw new HttpError(400, "Prescription upload metadata is missing");
  }

  try {
    const imageBuffer = await downloadPrescriptionFile(upload.storage_path);
    const ocrResult = await ocrProvider.parsePrescription(imageBuffer);
    const averageConfidence =
      ocrResult.medications.length > 0
        ? ocrResult.medications.reduce((sum, medication) => sum + medication.confidenceScore, 0) / ocrResult.medications.length
        : null;

    const { error: updateError } = await sb
      .from("prescriptions")
      .update({
        raw_ocr_text: ocrResult.rawText,
        parse_status: ocrResult.parseStatus,
        ocr_confidence_score: averageConfidence,
        ocr_provider: currentOcrProviderName(),
        ocr_provider_metadata: ocrResult.providerMetadata ?? {}
      })
      .eq("id", prescriptionId);
    if (updateError) throw new HttpError(500, "Failed to update OCR output", updateError);

    await sb.from("prescription_medications").delete().eq("prescription_id", prescriptionId);

    for (const med of ocrResult.medications) {
      const { error: medicationError } = await sb.from("prescription_medications").insert({
        prescription_id: prescriptionId,
        medicine_name: med.medicineName,
        dosage: med.dosage ?? null,
        frequency: med.frequency ?? null,
        timing: med.timing ?? null,
        duration: med.duration ?? null,
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

    await sb
      .from("prescription_uploads")
      .update({
        processing_status: "ocr_processed",
        last_error: null,
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
      ocrProvider: currentOcrProviderName()
    };
  } catch (error) {
    await sb
      .from("prescription_uploads")
      .update({
        processing_status: "ocr_failed",
        last_error: error instanceof Error ? error.message : "OCR parsing failed",
        last_processed_at: new Date().toISOString()
      })
      .eq("prescription_id", prescriptionId);

    await writeAuditLog({
      userId: currentUser.id,
      action: "prescription.ocr_failed",
      entityType: "prescription",
      entityId: prescriptionId,
      metadata: { reason: error instanceof Error ? error.message : "OCR parsing failed" }
    });

    throw error;
  }
}

export async function getPrescription(jwt: string, id: string) {
  await ensureClosedBetaAccess(jwt);
  const sb = getUserSupabaseClient(jwt);
  const { data, error } = await sb
    .from("prescriptions")
    .select("*, prescription_medications(*), prescription_uploads(*)")
    .eq("id", id)
    .single();
  if (error || !data) throw new HttpError(404, "Prescription not found", error);

  const upload = Array.isArray(data.prescription_uploads) ? data.prescription_uploads[0] : null;
  const imageUrl = upload?.storage_path ? await buildSignedPrescriptionUrl(upload.storage_path) : null;

  return {
    ...data,
    image_url: imageUrl
  };
}

export async function getPrescriptionHistory(jwt: string) {
  await ensureClosedBetaAccess(jwt);
  const sb = getUserSupabaseClient(jwt);
  const { data, error } = await sb
    .from("prescriptions")
    .select("*, family_members(full_name), prescription_medications(id), prescription_uploads(id, processing_status, last_error)")
    .order("created_at", { ascending: false });
  if (error) throw new HttpError(500, "Failed to fetch history", error);
  return data;
}

export async function updateParsedMedication(jwt: string, medicationId: string, input: Record<string, unknown>) {
  const sb = getUserSupabaseClient(jwt);
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

  const { data: medication, error: medicationError } = await sb
    .from("prescription_medications")
    .update(updatePayload)
    .eq("id", medicationId)
    .select("*")
    .single();

  if (medicationError || !medication) {
    throw new HttpError(500, "Failed to update parsed medication", medicationError);
  }

  if (verificationStatus) {
    const { error: prescriptionError } = await sb
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
