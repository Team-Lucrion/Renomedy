import { errorResponse, jsonResponse, RenomedyTrustMetadata } from "../_shared/response.ts";
import { ensureClosedBetaAccess, getBearerToken, getUserClient, writeAuditLog } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  try {
    const jwt = getBearerToken(req);
    const body = await req.json().catch(() => ({}));
    const prescriptionId = String(body.prescription_id ?? "");
    const medications = Array.isArray(body.medications) ? body.medications : [];

    if (!prescriptionId) {
      return errorResponse(400, "prescription_id is required");
    }

    const currentUser = await ensureClosedBetaAccess(jwt);
    const userClient = getUserClient(jwt);

    const { error: updateError } = await userClient
      .from("prescriptions")
      .update({
        raw_ocr_text: body.raw_ocr_text ?? null,
        parse_status: body.parse_status ?? "parsed",
        verification_status: body.verification_status ?? "unverified",
        ocr_confidence_score: body.ocr_confidence_score ?? null
      })
      .eq("id", prescriptionId);

    if (updateError) {
      return errorResponse(500, "Failed to update prescription OCR state", updateError);
    }

    if (medications.length) {
      const rows = medications.map((med: Record<string, unknown>) => ({
        prescription_id: prescriptionId,
        medicine_name: med.medicine_name ?? med.medicineName,
        generic_name: med.generic_name ?? null,
        dosage: med.dosage ?? null,
        frequency: med.frequency ?? null,
        timing: med.timing ?? null,
        duration: med.duration ?? null,
        brand_name: med.brand_name ?? med.brandName ?? null,
        shorthand_detected: med.shorthand_detected ?? med.shorthandDetected ?? [],
        shorthand_explanation: med.shorthand_explanation ?? med.shorthandExplanation ?? null,
        instructions: med.instructions ?? null,
        food_timing: med.food_timing ?? med.foodTiming ?? null,
        confidence_score: med.confidence_score ?? med.confidenceScore ?? null,
        requires_manual_verification: med.requires_manual_verification ?? med.requiresManualVerification ?? true
      }));

      const { error: insertError } = await userClient.from("prescription_medications").insert(rows);
      if (insertError) {
        return errorResponse(500, "Failed to store OCR medications", insertError);
      }
    }

    await writeAuditLog({
      userId: currentUser.id,
      action: "prescription.parsed",
      entityType: "prescription",
      entityId: prescriptionId,
      metadata: { medications_detected: medications.length }
    });

    return jsonResponse(200, {
      success: true,
      function: "save-ocr-parse",
      data: {
        prescription_id: prescriptionId,
        medications_detected: medications.length
      },
      metadata: {
        ...RenomedyTrustMetadata,
        ocr_status: "human_verification_required"
      }
    });
  } catch (error) {
    return errorResponse(401, error instanceof Error ? error.message : "Unauthorized");
  }
});
