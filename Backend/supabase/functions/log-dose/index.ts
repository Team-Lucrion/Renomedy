import { errorResponse, jsonResponse, RenomedyTrustMetadata } from "../_shared/response.ts";
import { ensureClosedBetaAccess, getBearerToken, getUserClient, writeAuditLog } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  try {
    const jwt = getBearerToken(req);
    const body = await req.json().catch(() => ({}));

    if (!body.medication_schedule_id || !body.status) {
      return errorResponse(400, "medication_schedule_id and status are required");
    }

    const currentUser = await ensureClosedBetaAccess(jwt);
    const userClient = getUserClient(jwt);
    const { data, error } = await userClient
      .from("dose_logs")
      .insert({
        medication_schedule_id: body.medication_schedule_id,
        scheduled_time: body.scheduled_time ?? null,
        taken_time: body.taken_time ?? null,
        status: body.status,
        notes: body.notes ?? null
      })
      .select("*")
      .single();

    if (error || !data) {
      return errorResponse(500, "Failed to log dose", error);
    }

    if (data.status === "taken") {
      const { data: refillState } = await userClient
        .from("refill_states")
        .select("quantity_remaining, daily_depletion")
        .eq("medication_schedule_id", data.medication_schedule_id)
        .maybeSingle();

      if (refillState) {
        const quantityRemaining =
          refillState.quantity_remaining === null ? null : Math.max(Number(refillState.quantity_remaining) - 1, 0);
        const dailyDepletion = refillState.daily_depletion === null ? null : Number(refillState.daily_depletion);
        let continuityStatus = "safe";
        if (quantityRemaining !== null) {
          if (quantityRemaining <= 0) continuityStatus = "out_of_stock";
          else if (dailyDepletion && quantityRemaining / dailyDepletion <= 1) continuityStatus = "will_run_out";
          else if (dailyDepletion && quantityRemaining / dailyDepletion <= 3) continuityStatus = "risk_soon";
        }

        const projectedRunoutDate =
          quantityRemaining !== null && dailyDepletion
            ? new Date(Date.now() + Math.ceil(quantityRemaining / dailyDepletion) * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10)
            : null;

        await userClient
          .from("refill_states")
          .update({
            quantity_remaining: quantityRemaining,
            continuity_status: continuityStatus,
            projected_runout_date: projectedRunoutDate,
            last_dose_logged_at: data.taken_time ?? new Date().toISOString()
          })
          .eq("medication_schedule_id", data.medication_schedule_id);
      }
    }

    await writeAuditLog({
      userId: currentUser.id,
      action: "medication.dose_logged",
      entityType: "dose_log",
      entityId: data.id,
      metadata: { medication_schedule_id: body.medication_schedule_id, status: body.status }
    });

    return jsonResponse(200, {
      success: true,
      function: "log-dose",
      data,
      metadata: RenomedyTrustMetadata
    });
  } catch (error) {
    return errorResponse(401, error instanceof Error ? error.message : "Unauthorized");
  }
});
