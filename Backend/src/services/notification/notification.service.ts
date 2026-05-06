import { supabaseAdmin } from "../../lib/supabase";
import { writeAuditLog } from "../audit.service";
import { buildAlertDedupeKey } from "./alert.utils";
import { isInvalidFcmTokenError, sendPushNotification } from "./fcm.service";

export async function enqueueAlert(input: {
  userId: string;
  familyMemberId?: string;
  type: string;
  title: string;
  body: string;
  scheduledFor?: string;
  dedupeKey?: string;
}) {
  const dedupeKey = input.dedupeKey ?? null;

  if (dedupeKey) {
    const { data: existing } = await supabaseAdmin
      .from("alerts")
      .select("*")
      .eq("user_id", input.userId)
      .eq("dedupe_key", dedupeKey)
      .maybeSingle();

    if (existing) {
      return existing;
    }
  }

  const { data, error } = await supabaseAdmin
    .from("alerts")
    .insert({
      user_id: input.userId,
      family_member_id: input.familyMemberId ?? null,
      type: input.type,
      title: input.title,
      body: input.body,
      scheduled_for: input.scheduledFor ?? null,
      dedupe_key: dedupeKey,
      status: "pending"
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function dispatchScheduledAlerts() {
  const nowIso = new Date().toISOString();
  const { data: alerts } = await supabaseAdmin
    .from("alerts")
    .select("*")
    .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso}`)
    .eq("status", "pending")
    .limit(50);

  if (!alerts?.length) return { processed: 0 };

  for (const alert of alerts) {
    try {
      const { data: tokens } = await supabaseAdmin.from("notification_tokens").select("*").eq("user_id", alert.user_id);
      if (!tokens?.length) {
        await supabaseAdmin
          .from("alerts")
          .update({ status: "failed", failure_reason: "No notification tokens registered", failed_at: new Date().toISOString() })
          .eq("id", alert.id);
        await writeAuditLog({
          userId: alert.user_id,
          action: "notification.failure",
          entityType: "alert",
          entityId: alert.id,
          metadata: { reason: "No notification tokens registered" }
        });
        continue;
      }

      for (const token of tokens) {
        try {
          await sendPushNotification({
            token: token.fcm_token,
            title: alert.title,
            body: alert.body,
            data: { alertId: alert.id, type: alert.type }
          });
        } catch (error) {
          if (isInvalidFcmTokenError(error)) {
            await supabaseAdmin.from("notification_tokens").delete().eq("id", token.id);
          }
          throw error;
        }
      }

      await supabaseAdmin
        .from("alerts")
        .update({ status: "sent", sent_at: new Date().toISOString(), failure_reason: null, failed_at: null })
        .eq("id", alert.id);
    } catch (error) {
      await supabaseAdmin
        .from("alerts")
        .update({
          status: "failed",
          failure_reason: error instanceof Error ? error.message : "Push delivery failed",
          failed_at: new Date().toISOString()
        })
        .eq("id", alert.id);
      await writeAuditLog({
        userId: alert.user_id,
        action: "notification.failure",
        entityType: "alert",
        entityId: alert.id,
        metadata: { reason: error instanceof Error ? error.message : "Push delivery failed" }
      });
    }
  }

  return { processed: alerts.length };
}

export async function dismissAlert(alertId: string) {
  const { data, error } = await supabaseAdmin
    .from("alerts")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("id", alertId)
    .select("*")
    .single();

  if (error || !data) throw error ?? new Error("Alert not found");
  return data;
}

export async function retryAlert(alertId: string) {
  const { data, error } = await supabaseAdmin
    .from("alerts")
    .update({ status: "pending", failure_reason: null, failed_at: null })
    .eq("id", alertId)
    .select("*")
    .single();

  if (error || !data) throw error ?? new Error("Alert not found");
  return data;
}

export { buildAlertDedupeKey };
