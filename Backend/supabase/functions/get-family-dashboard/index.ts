import { errorResponse, jsonResponse, RenomedyTrustMetadata } from "../_shared/response.ts";
import { ensureClosedBetaAccess, getBearerToken, getUserClient } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method !== "GET") {
    return errorResponse(405, "Method not allowed");
  }

  try {
    const jwt = getBearerToken(req);
    await ensureClosedBetaAccess(jwt);
    const userClient = getUserClient(jwt);

    const [{ data: members, error: membersError }, { data: schedules, error: schedulesError }, { data: doseLogs, error: doseLogsError }, { data: refillStates, error: refillStatesError }] =
      await Promise.all([
        userClient.from("family_members").select("id"),
        userClient.from("medication_schedules").select("id, status"),
        userClient
          .from("dose_logs")
          .select("id, status, created_at")
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        userClient.from("refill_states").select("id, continuity_status")
      ]);

    if (membersError || schedulesError || doseLogsError || refillStatesError) {
      return errorResponse(500, "Failed to build family dashboard", {
        membersError,
        schedulesError,
        doseLogsError,
        refillStatesError
      });
    }

    return jsonResponse(200, {
      success: true,
      function: "get-family-dashboard",
      data: {
        family_members_count: members?.length ?? 0,
        active_schedules_count: schedules?.filter((schedule) => schedule.status === "active").length ?? 0,
        missed_doses_last_24h: doseLogs?.filter((doseLog) => doseLog.status === "missed").length ?? 0,
        refill_risks: refillStates?.filter((state) =>
          ["risk_soon", "will_run_out", "out_of_stock"].includes(state.continuity_status ?? "")
        ).length ?? 0
      },
      metadata: {
        ...RenomedyTrustMetadata,
        reminder: "Medication insights are adherence-support signals only and do not replace clinician guidance."
      }
    });
  } catch (error) {
    return errorResponse(401, error instanceof Error ? error.message : "Unauthorized");
  }
});
