import { errorResponse, jsonResponse, swasthiTrustMetadata } from "../_shared/response.ts";
import { ensureClosedBetaAccess, getBearerToken, getUserClient, writeAuditLog } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  try {
    const jwt = getBearerToken(req);
    const body = await req.json().catch(() => ({}));

    if (!body.family_member_id || !body.prescription_medication_id) {
      return errorResponse(400, "family_member_id and prescription_medication_id are required");
    }

    const currentUser = await ensureClosedBetaAccess(jwt);
    const userClient = getUserClient(jwt);

    const { data: medication, error: medicationError } = await userClient
      .from("prescription_medications")
      .select("id, requires_manual_verification, prescriptions!inner(verification_status)")
      .eq("id", body.prescription_medication_id)
      .single();

    if (medicationError || !medication) {
      return errorResponse(404, "Prescription medication not found", medicationError);
    }

    const verificationStatus = Array.isArray((medication as any).prescriptions)
      ? (medication as any).prescriptions[0]?.verification_status
      : (medication as any).prescriptions?.verification_status;

    if (medication.requires_manual_verification || verificationStatus === "unverified") {
      return errorResponse(403, "Medication activation requires verification first");
    }

    const { data, error } = await userClient
      .from("medication_schedules")
      .insert({
        family_member_id: body.family_member_id,
        prescription_medication_id: body.prescription_medication_id,
        start_date: body.start_date ?? null,
        end_date: body.end_date ?? null,
        reminder_times: body.reminder_times ?? [],
        food_relation: body.food_relation ?? null,
        refill_threshold_days: body.refill_threshold_days ?? 3,
        status: body.status ?? "active"
      })
      .select("*")
      .single();

    if (error || !data) {
      return errorResponse(500, "Failed to activate medication schedule", error);
    }

    await userClient
      .from("refill_states")
      .upsert(
        {
          medication_schedule_id: data.id,
          quantity_total: body.quantity_total ?? null,
          quantity_remaining: body.quantity_remaining ?? null,
          daily_depletion: body.daily_depletion ?? null,
          projected_runout_date: body.projected_runout_date ?? null,
          continuity_status: body.continuity_status ?? "safe"
        },
        { onConflict: "medication_schedule_id" }
      );

    await writeAuditLog({
      userId: currentUser.id,
      action: "medication.schedule_activated",
      entityType: "medication_schedule",
      entityId: data.id,
      metadata: { family_member_id: body.family_member_id }
    });

    return jsonResponse(200, {
      success: true,
      function: "activate-medication-schedule",
      data,
      metadata: swasthiTrustMetadata
    });
  } catch (error) {
    return errorResponse(401, error instanceof Error ? error.message : "Unauthorized");
  }
});
