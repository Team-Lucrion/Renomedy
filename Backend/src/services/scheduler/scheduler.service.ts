import cron from "node-cron";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { supabaseAdmin } from "../../lib/supabase";
import { deriveContinuityStatus } from "../../modules/medications/refill.utils";
import { buildAlertDedupeKey, dispatchScheduledAlerts, enqueueAlert } from "../notification/notification.service";

async function scanDueDoseReminders() {
  const now = new Date();
  const currentTime = now.toISOString().slice(11, 16);
  const today = now.toISOString().slice(0, 10);

  const { data: schedules } = await supabaseAdmin
    .from("medication_schedules")
    .select("id, family_member_id, refill_threshold_days, reminder_times, prescription_medications!inner(medicine_name), family_members!inner(family_group_id)")
    .eq("status", "active")
    .limit(200);

  if (!schedules?.length) return;

  for (const schedule of schedules) {
    const reminderTimes = Array.isArray(schedule.reminder_times) ? schedule.reminder_times : [];
    const dueNow = reminderTimes.some((value) => String(value).slice(0, 5) === currentTime);
    if (!dueNow) continue;

    const { data: memberships } = await supabaseAdmin
      .from("family_group_memberships")
      .select("user_id")
      .eq("family_group_id", (schedule as any).family_members.family_group_id)
      .eq("status", "active");

    for (const membership of memberships ?? []) {
      await enqueueAlert({
        userId: membership.user_id,
        familyMemberId: schedule.family_member_id,
        type: "due-dose",
        dedupeKey: buildAlertDedupeKey(["due-dose", schedule.id, today, currentTime, membership.user_id]),
        title: "Dose due",
        body: `Dose reminder for ${(schedule as any).prescription_medications.medicine_name}`
      });
    }
  }
}

async function scanMissedDoses() {
  const threshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const { data: missedLogs } = await supabaseAdmin
    .from("dose_logs")
    .select("id, status, scheduled_time, medication_schedule_id, medication_schedules!inner(family_member_id, family_members!inner(family_group_id), prescription_medications!inner(medicine_name))")
    .is("taken_time", null)
    .lte("scheduled_time", threshold)
    .neq("status", "missed")
    .limit(100);

  if (!missedLogs?.length) return;

  for (const log of missedLogs) {
    await supabaseAdmin.from("dose_logs").update({ status: "missed" }).eq("id", log.id);

    const { data: memberships } = await supabaseAdmin
      .from("family_group_memberships")
      .select("user_id")
      .eq("family_group_id", (log as any).medication_schedules.family_members.family_group_id)
      .eq("status", "active");

    for (const membership of memberships ?? []) {
      await enqueueAlert({
        userId: membership.user_id,
        familyMemberId: (log as any).medication_schedules.family_member_id,
        type: "missed-dose",
        dedupeKey: buildAlertDedupeKey(["missed-dose", log.id, today, membership.user_id]),
        title: "Missed dose alert",
        body: `A scheduled dose for ${(log as any).medication_schedules.prescription_medications.medicine_name} was missed.`
      });
    }
  }
}

async function scanRefillRisk() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: states } = await supabaseAdmin
    .from("refill_states")
    .select("id, quantity_remaining, daily_depletion, projected_runout_date, continuity_status, medication_schedules!inner(id, family_member_id, refill_threshold_days, family_members!inner(family_group_id), prescription_medications!inner(medicine_name))")
    .limit(200);

  if (!states?.length) return;

  for (const state of states) {
    const continuityStatus = deriveContinuityStatus(
      state.quantity_remaining === null ? null : Number(state.quantity_remaining),
      state.daily_depletion === null ? null : Number(state.daily_depletion),
      (state as any).medication_schedules.refill_threshold_days
    );

    await supabaseAdmin
      .from("refill_states")
      .update({ continuity_status: continuityStatus, updated_at: new Date().toISOString() })
      .eq("id", state.id);

    if (continuityStatus === "risk_soon" || continuityStatus === "will_run_out" || continuityStatus === "out_of_stock") {
      const { data: memberships } = await supabaseAdmin
        .from("family_group_memberships")
        .select("user_id")
        .eq("family_group_id", (state as any).medication_schedules.family_members.family_group_id)
        .eq("status", "active");

      for (const membership of memberships ?? []) {
        await enqueueAlert({
          userId: membership.user_id,
          familyMemberId: (state as any).medication_schedules.family_member_id,
          type: "refill-risk",
          dedupeKey: buildAlertDedupeKey(["refill-risk", state.id, continuityStatus, today, membership.user_id]),
          title: "Refill risk alert",
          body: `${(state as any).medication_schedules.prescription_medications.medicine_name} is approaching runout.`
        });
      }
    }
  }
}

export function startSchedulers() {
  if (env.ENABLE_SCHEDULER !== "true") {
    logger.info("Schedulers disabled by env");
    return;
  }

  cron.schedule(env.CRON_REMINDER_SCAN, async () => {
    await scanDueDoseReminders();
    await scanMissedDoses();
    await dispatchScheduledAlerts();
  });

  cron.schedule(env.CRON_REFILL_SCAN, async () => {
    await scanRefillRisk();
  });

  logger.info("Schedulers started");
}
