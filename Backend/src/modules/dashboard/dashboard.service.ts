import { getUserSupabaseClient } from "../../lib/supabase";
import { ensureClosedBetaAccess } from "../../services/beta-access.service";
import { HttpError } from "../../utils/http-error";

export async function getFamilyOverview(jwt: string) {
  await ensureClosedBetaAccess(jwt);
  const sb = getUserSupabaseClient(jwt);

  const [{ data: members, error: membersError }, { data: schedules, error: schedulesError }, { data: doseLogs, error: doseError }, { data: refillStates, error: refillError }] =
    await Promise.all([
      sb.from("family_members").select("id").eq("is_archived", false),
      sb.from("medication_schedules").select("id, status"),
      sb.from("dose_logs").select("id, status, created_at").gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      sb.from("refill_states").select("id, continuity_status")
    ]);

  if (membersError || schedulesError || doseError || refillError) {
    throw new HttpError(500, "Failed to build dashboard overview", {
      membersError,
      schedulesError,
      doseError,
      refillError
    });
  }

  return {
    family_members_count: members?.length ?? 0,
    active_schedules_count: schedules?.filter((s) => s.status === "active").length ?? 0,
    missed_doses_last_24h: doseLogs?.filter((d) => d.status === "missed").length ?? 0,
    refill_risk_count: refillStates?.filter((r) => ["risk_soon", "will_run_out", "out_of_stock"].includes(r.continuity_status)).length ?? 0
  };
}
