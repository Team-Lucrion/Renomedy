import { supabaseAdmin } from "../../lib/supabase";
import { getCurrentUserRecord } from "../../services/current-user.service";
import { dismissAlert, retryAlert } from "../../services/notification/notification.service";
import { HttpError } from "../../utils/http-error";
import { writeAuditLog } from "../../services/audit.service";

function normalizedInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export async function createBetaInvite(jwt: string, input: { email?: string; phone?: string; clerk_user_id?: string; notes?: string; expires_at?: string }) {
  const founder = await getCurrentUserRecord(jwt);
  const { data, error } = await supabaseAdmin
    .from("beta_invites")
    .insert({
      invite_code: normalizedInviteCode(),
      email: input.email ?? null,
      phone: input.phone ?? null,
      clerk_user_id: input.clerk_user_id ?? null,
      notes: input.notes ?? null,
      expires_at: input.expires_at ?? null,
      approved_by_user_id: founder.id,
      status: "approved"
    })
    .select("*")
    .single();

  if (error || !data) throw new HttpError(500, "Failed to create beta invite", error);
  return data;
}

export async function listBetaUsers() {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, clerk_user_id, full_name, email, beta_access_status, beta_access_granted_at, beta_access_revoked_at, beta_invite_id")
    .order("created_at", { ascending: false });
  if (error) throw new HttpError(500, "Failed to fetch beta users", error);
  return data;
}

export async function listBetaInvites() {
  const { data, error } = await supabaseAdmin
    .from("beta_invites")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new HttpError(500, "Failed to fetch beta invites", error);
  return data;
}

export async function revokeBetaAccess(jwt: string, userId: string) {
  const founder = await getCurrentUserRecord(jwt);
  const revokedAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("users")
    .update({ beta_access_status: "revoked", beta_access_revoked_at: revokedAt })
    .eq("id", userId)
    .select("id, beta_invite_id")
    .single();

  if (error || !data) throw new HttpError(500, "Failed to revoke beta access", error);

  if (data.beta_invite_id) {
    await supabaseAdmin.from("beta_invites").update({ status: "revoked" }).eq("id", data.beta_invite_id);
  }

  await writeAuditLog({
    userId: founder.id,
    action: "beta.access_revoked",
    entityType: "user",
    entityId: userId,
    metadata: { revoked_at: revokedAt }
  });

  return { user_id: userId, beta_access_status: "revoked", beta_access_revoked_at: revokedAt };
}

export async function listOperationalIssues() {
  const [{ data: failedAlerts, error: alertsError }, { data: uploadIssues, error: uploadsError }, { data: failureAudit, error: auditError }] = await Promise.all([
    supabaseAdmin.from("alerts").select("*").eq("status", "failed").order("created_at", { ascending: false }).limit(100),
    supabaseAdmin
      .from("prescription_uploads")
      .select("*, prescriptions(id, family_member_id)")
      .in("processing_status", ["upload_failed", "ocr_failed"])
      .limit(100)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("audit_logs")
      .select("*")
      .or("action.eq.prescription.upload_failed,action.eq.prescription.ocr_failed,action.eq.notification.failure,action.eq.auth.clerk_webhook_failed,action.eq.auth.clerk_webhook_rejected")
      .order("created_at", { ascending: false })
      .limit(100)
  ]);

  if (alertsError || uploadsError || auditError) {
    throw new HttpError(500, "Failed to fetch operational issues", { alertsError, uploadsError, auditError });
  }

  return {
    failed_alerts: failedAlerts ?? [],
    failed_uploads: uploadIssues ?? [],
    operational_audit_events: failureAudit ?? []
  };
}

export async function retryFailedAlert(jwt: string, alertId: string) {
  const founder = await getCurrentUserRecord(jwt);
  const alert = await retryAlert(alertId);
  await writeAuditLog({
    userId: founder.id,
    action: "alert.retry_requested",
    entityType: "alert",
    entityId: alertId
  });
  return alert;
}

export async function dismissFailedAlert(jwt: string, alertId: string) {
  const founder = await getCurrentUserRecord(jwt);
  const alert = await dismissAlert(alertId);
  await writeAuditLog({
    userId: founder.id,
    action: "alert.dismissed",
    entityType: "alert",
    entityId: alertId
  });
  return alert;
}
