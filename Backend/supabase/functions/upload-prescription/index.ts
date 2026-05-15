import { errorResponse, jsonResponse, RenomedyTrustMetadata } from "../_shared/response.ts";
import {
  createSignedPrescriptionUrl,
  ensureClosedBetaAccess,
  getBearerToken,
  getUserClient,
  storageBucket,
  writeAuditLog,
} from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  try {
    const jwt = getBearerToken(req);
    const body = await req.json().catch(() => ({}));
    const familyMemberId = String(body.family_member_id ?? "");
    const storagePath = String(body.storage_path ?? "").trim();

    if (!familyMemberId || !storagePath) {
      return errorResponse(400, "family_member_id and storage_path are required");
    }

    const currentUser = await ensureClosedBetaAccess(jwt);
    const userClient = getUserClient(jwt);

    const { data: prescription, error: prescriptionError } = await userClient
      .from("prescriptions")
      .insert({
        family_member_id: familyMemberId,
        uploaded_by_user_id: currentUser.id,
        doctor_name: body.doctor_name ?? null,
        hospital_name: body.hospital_name ?? null,
        prescription_date: body.prescription_date ?? null,
        image_url: null,
        parse_status: "pending",
        verification_status: "unverified"
      })
      .select("*")
      .single();

    if (prescriptionError || !prescription) {
      return errorResponse(500, "Failed to create prescription record", prescriptionError);
    }

    const { error: uploadError } = await userClient.from("prescription_uploads").insert({
      prescription_id: prescription.id,
      storage_bucket: body.storage_bucket ?? storageBucket,
      storage_path: storagePath,
      mime_type: body.mime_type ?? null,
      file_size_bytes: body.file_size_bytes ?? null
    });

    if (uploadError) {
      return errorResponse(500, "Failed to store prescription upload metadata", uploadError);
    }

    await writeAuditLog({
      userId: currentUser.id,
      action: "prescription.uploaded",
      entityType: "prescription",
      entityId: prescription.id,
      metadata: { family_member_id: familyMemberId, storage_path: storagePath }
    });

    return jsonResponse(200, {
      success: true,
      function: "upload-prescription",
      data: {
        ...prescription,
        image_url: await createSignedPrescriptionUrl(storagePath)
      },
      metadata: {
        ...RenomedyTrustMetadata,
        prescription_notice:
          "Uploaded prescriptions and OCR text are informational and must be verified by user/pharmacist/doctor."
      }
    });
  } catch (error) {
    return errorResponse(401, error instanceof Error ? error.message : "Unauthorized");
  }
});
