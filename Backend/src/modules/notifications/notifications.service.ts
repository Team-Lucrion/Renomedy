import { getUserSupabaseClient } from "../../lib/supabase";
import { writeAuditLog } from "../../services/audit.service";
import { ensureClosedBetaAccess } from "../../services/beta-access.service";
import { sendPushNotification } from "../../services/notification/fcm.service";
import { HttpError } from "../../utils/http-error";

export async function registerNotificationToken(jwt: string, input: Record<string, unknown>) {
  const sb = getUserSupabaseClient(jwt);
  const currentUser = await ensureClosedBetaAccess(jwt);
  const { data, error } = await sb
    .from("notification_tokens")
    .upsert({ ...input, user_id: currentUser.id }, { onConflict: "user_id,fcm_token" })
    .select("*")
    .single();
  if (error) throw new HttpError(500, "Failed to register token", error);
  await writeAuditLog({
    userId: currentUser.id,
    action: "notification.token_registered",
    entityType: "notification_token",
    entityId: data.id,
    metadata: { platform: input.platform }
  });
  return data;
}

export async function updateNotificationPreferences(jwt: string, input: Record<string, unknown>) {
  const sb = getUserSupabaseClient(jwt);
  const currentUser = await ensureClosedBetaAccess(jwt);
  const { data, error } = await sb
    .from("notification_preferences")
    .upsert({ ...input, user_id: currentUser.id }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw new HttpError(500, "Failed to update preferences", error);
  await writeAuditLog({
    userId: currentUser.id,
    action: "notification.preferences_updated",
    entityType: "notification_preference",
    entityId: data.id,
    metadata: { user_id: currentUser.id }
  });
  return data;
}

export async function unregisterNotificationToken(jwt: string, input: Record<string, unknown>) {
  const sb = getUserSupabaseClient(jwt);
  const currentUser = await ensureClosedBetaAccess(jwt);
  let query = sb.from("notification_tokens").delete().eq("user_id", currentUser.id);

  if (typeof input.fcm_token === "string" && input.fcm_token.trim()) {
    query = query.eq("fcm_token", input.fcm_token.trim());
  }

  const { error } = await query;
  if (error) throw new HttpError(500, "Failed to remove notification token", error);

  await writeAuditLog({
    userId: currentUser.id,
    action: "notification.token_removed",
    entityType: "user",
    entityId: currentUser.id,
    metadata: { removed_specific_token: Boolean(input.fcm_token) }
  });

  return { removed: true };
}

export async function sendTestPush(jwt: string) {
  const sb = getUserSupabaseClient(jwt);
  const currentUser = await ensureClosedBetaAccess(jwt);
  const { data: tokens, error } = await sb.from("notification_tokens").select("*").eq("user_id", currentUser.id);
  if (error) throw new HttpError(500, "Failed to fetch notification tokens", error);
  if (!tokens?.length) throw new HttpError(400, "No registered notification tokens found");

  const deliveries = await Promise.all(
    tokens.map(async (token) => {
      try {
        const result = await sendPushNotification({
          token: token.fcm_token,
          title: "Renomedy test notification",
          body: "Closed beta push delivery is configured.",
          data: { type: "test_push" }
        });
        return { token_id: token.id, ...result };
      } catch (sendError) {
        await writeAuditLog({
          userId: currentUser.id,
          action: "notification.failure",
          entityType: "notification_token",
          entityId: token.id,
          metadata: { error: sendError instanceof Error ? sendError.message : "Unknown push failure" }
        });
        return {
          token_id: token.id,
          sent: false,
          reason: sendError instanceof Error ? sendError.message : "Unknown push failure"
        };
      }
    })
  );

  await writeAuditLog({
    userId: currentUser.id,
    action: "notification.test_push_requested",
    entityType: "user",
    entityId: currentUser.id,
    metadata: { tokens_attempted: tokens.length }
  });

  return deliveries;
}
