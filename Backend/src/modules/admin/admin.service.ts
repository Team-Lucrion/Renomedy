import { supabaseAdmin } from "../../lib/supabase";
import { getCurrentUserRecord } from "../../services/current-user.service";
import { dismissAlert, retryAlert } from "../../services/notification/notification.service";
import { HttpError } from "../../utils/http-error";
import { writeAuditLog } from "../../services/audit.service";
import { assignManualSubscription } from "../subscriptions/subscriptions.service";


function normalizedInviteCode() {
  return "RENO-BETA-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}


export async function createBetaInvite(jwt: string, input: { code?: string; name?: string; email?: string; phone?: string; notes?: string; expires_at?: string }) {
  const founder = await getCurrentUserRecord(jwt);
  const code = (input.code?.trim().toUpperCase() || normalizedInviteCode());
  const { data, error } = await supabaseAdmin
    .from("beta_invites")
    .insert({
      code,
      invite_code: code,
      name: input.name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      expires_at: input.expires_at ?? null,
      max_uses: 1,
      used_count: 0,
      used_at: null,
      used_by_user_id: null,
      approved_by_user_id: founder.id,
      status: "active"
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


type BetaFunnelUser = {
  user_id: string | null;
  name: string | null;
  email: string | null;
  phone?: string | null;
  invite_code?: string | null;
  stage: "code_not_redeemed" | "redeemed_no_onboarding" | "onboarding_no_upload";
  next_action: string;
  created_at: string | null;
  last_activity_at: string | null;
};


export async function getBetaFunnel() {
  const [
    { data: users, error: usersError },
    { data: invites, error: invitesError },
    { data: prescriptions, error: prescriptionsError },
    { data: betaAuditEvents, error: betaAuditError }
  ] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("id, full_name, email, beta_access_approved, beta_access_status, beta_access_granted_at, beta_access_revoked_at, beta_invite_id, beta_invite_code_used, onboarding_complete, created_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("beta_invites")
      .select("id, code, name, email, phone, status, used_by_user_id, used_at, created_at, expires_at")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("prescriptions")
      .select("uploaded_by_user_id, created_at")
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("audit_logs")
      .select("user_id, action, created_at")
      .in("action", ["beta.code_validated", "beta.code_redeemed"])
      .order("created_at", { ascending: false })
      .limit(500)
  ]);

  if (usersError || invitesError || prescriptionsError || betaAuditError) {
    throw new HttpError(500, "Failed to build beta funnel", {
      usersError,
      invitesError,
      prescriptionsError,
      betaAuditError
    });
  }

  const userRows = users ?? [];
  const inviteRows = invites ?? [];
  const prescriptionUserIds = new Set(
    (prescriptions ?? [])
      .map((row) => row.uploaded_by_user_id)
      .filter((userId): userId is string => Boolean(userId))
  );
  const validatedUserIds = new Set(
    (betaAuditEvents ?? [])
      .filter((event) => event.action === "beta.code_validated" && event.user_id)
      .map((event) => event.user_id as string)
  );
  const redeemedAuditUserIds = new Set(
    (betaAuditEvents ?? [])
      .filter((event) => event.action === "beta.code_redeemed" && event.user_id)
      .map((event) => event.user_id as string)
  );
  const redeemedInviteUserIds = new Set(
    inviteRows
      .map((invite) => invite.used_by_user_id)
      .filter((userId): userId is string => Boolean(userId))
  );
  const redeemedUserIds = new Set([...redeemedAuditUserIds, ...redeemedInviteUserIds]);
  const approvedUsers = userRows.filter(
    (user) => Boolean(user.beta_access_approved) || user.beta_access_status === "active"
  );
  const onboardingUsers = approvedUsers.filter((user) => Boolean(user.onboarding_complete));
  const activatedUsers = onboardingUsers.filter((user) => prescriptionUserIds.has(user.id));
  const stalledUsers: BetaFunnelUser[] = [];

  for (const invite of inviteRows) {
    if (invite.status !== "active" || invite.used_by_user_id) continue;
    stalledUsers.push({
      user_id: null,
      name: invite.name ?? null,
      email: invite.email ?? null,
      phone: invite.phone ?? null,
      invite_code: invite.code ?? null,
      stage: "code_not_redeemed",
      next_action: "Follow up with the invite recipient and help them enter the beta code.",
      created_at: invite.created_at ?? null,
      last_activity_at: null
    });
  }

  for (const user of approvedUsers) {
    if (activatedUsers.some((activeUser) => activeUser.id === user.id)) continue;
    if (!user.onboarding_complete) {
      stalledUsers.push({
        user_id: user.id,
        name: user.full_name ?? null,
        email: user.email ?? null,
        invite_code: user.beta_invite_code_used ?? null,
        stage: "redeemed_no_onboarding",
        next_action: "Help the user finish onboarding and create or join a Sanctuary.",
        created_at: user.created_at ?? null,
        last_activity_at: user.beta_access_granted_at ?? null
      });
      continue;
    }
    stalledUsers.push({
      user_id: user.id,
      name: user.full_name ?? null,
      email: user.email ?? null,
      invite_code: user.beta_invite_code_used ?? null,
      stage: "onboarding_no_upload",
      next_action: "Ask the user to upload one real prescription and offer founder-assisted support.",
      created_at: user.created_at ?? null,
      last_activity_at: user.beta_access_granted_at ?? null
    });
  }

  return {
    generated_at: new Date().toISOString(),
    target_users: 50,
    funnel: {
      invites_created: inviteRows.length,
      codes_validated: validatedUserIds.size,
      codes_redeemed: redeemedUserIds.size,
      beta_access_approved: approvedUsers.length,
      onboarding_complete: onboardingUsers.length,
      first_prescription_uploaded: new Set(
        (prescriptions ?? [])
          .map((row) => row.uploaded_by_user_id)
          .filter((userId): userId is string => Boolean(userId))
      ).size,
      activated: activatedUsers.length
    },
    stalled_users: stalledUsers.slice(0, 100),
    definitions: {
      activated: "User has completed onboarding and uploaded at least one prescription.",
      code_not_redeemed: "An active invite has no recorded redemption.",
      redeemed_no_onboarding: "Beta access is active but onboarding is incomplete.",
      onboarding_no_upload: "Onboarding is complete but no prescription upload is recorded."
    }
  };
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


export async function assignUserSubscription(jwt: string, input: { user_id: string; plan_slug: "free" | "care" | "family_plus"; billing_cycle: "monthly" | "yearly" | "lifetime" }) {
  return assignManualSubscription(jwt, input);
}
