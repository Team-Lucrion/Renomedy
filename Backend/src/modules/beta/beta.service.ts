import { supabaseAdmin } from "../../lib/supabase";
import { writeAuditLog } from "../../services/audit.service";
import { getCurrentUserRecord } from "../../services/current-user.service";
import { HttpError } from "../../utils/http-error";

type BetaInviteRecord = {
  id: string;
  code: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  status: "unused" | "used" | "revoked" | string;
  max_uses?: number | null;
  used_count?: number | null;
  expires_at?: string | null;
  used_at?: string | null;
  used_by_user_id?: string | null;
  notes?: string | null;
};

function normalizeInviteCode(inviteCode: string) {
  return inviteCode.trim().toUpperCase();
}

function resolveInviteError(invite: BetaInviteRecord | null) {
  if (!invite) return { statusCode: 404, message: "Invalid code" } as const;
  if (invite.status === "revoked") return { statusCode: 403, message: "Revoked code" } as const;
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return { statusCode: 403, message: "Expired code" } as const;
  }
  const maxUses = invite.max_uses ?? 1;
  const usedCount = invite.used_count ?? 0;
  if (usedCount >= maxUses || invite.status === "used") {
    return { statusCode: 403, message: "Already used" } as const;
  }
  return null;
}

async function getInviteByCode(code: string) {
  const { data, error } = await supabaseAdmin
    .from("beta_invites")
    .select("id, code, name, phone, email, status, max_uses, used_count, expires_at, used_at, used_by_user_id, notes")
    .eq("code", code)
    .maybeSingle<BetaInviteRecord>();

  if (error) {
    throw new HttpError(500, "Failed to load beta invite", error);
  }

  return data ?? null;
}

async function ensureUserNotApproved(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, beta_access_approved, beta_access_status")
    .eq("id", userId)
    .single<{ id: string; beta_access_approved?: boolean | null; beta_access_status?: string | null }>();

  if (error || !data) {
    throw new HttpError(500, "Failed to load user beta access", error);
  }

  if (data.beta_access_approved || data.beta_access_status === "active") {
    throw new HttpError(409, "User already approved");
  }
}

export async function validateBetaInvite(jwt: string, inviteCode: string) {
  const currentUser = await getCurrentUserRecord(jwt);
  await ensureUserNotApproved(currentUser.id);

  const normalizedCode = normalizeInviteCode(inviteCode);
  const invite = await getInviteByCode(normalizedCode);
  const inviteError = resolveInviteError(invite);
  if (inviteError) {
    throw new HttpError(inviteError.statusCode, inviteError.message);
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "beta.code_validated",
    entityType: "beta_invite",
    entityId: invite!.id,
    metadata: { code: normalizedCode }
  });

  return {
    success: true,
    status: "valid",
    invite_code: normalizedCode,
    expires_at: invite!.expires_at ?? null
  };
}

export async function redeemBetaInvite(jwt: string, inviteCode: string) {
  const currentUser = await getCurrentUserRecord(jwt);
  await ensureUserNotApproved(currentUser.id);

  const normalizedCode = normalizeInviteCode(inviteCode);
  const invite = await getInviteByCode(normalizedCode);
  const inviteError = resolveInviteError(invite);
  if (inviteError) {
    throw new HttpError(inviteError.statusCode, inviteError.message);
  }

  const approvedAt = new Date().toISOString();
  const nextUsedCount = (invite!.used_count ?? 0) + 1;
  const maxUses = invite!.max_uses ?? 1;
  const nextStatus = nextUsedCount >= maxUses ? "used" : "unused";

  const { data: updatedUser, error: userError } = await supabaseAdmin
    .from("users")
    .update({
      beta_access_approved: true,
      beta_invite_code_used: normalizedCode,
      beta_approved_at: approvedAt,
      beta_access_status: "active",
      beta_access_granted_at: approvedAt,
      beta_access_revoked_at: null,
      beta_invite_id: invite!.id
    })
    .eq("id", currentUser.id)
    .eq("beta_access_approved", false)
    .select("*")
    .single();

  if (userError || !updatedUser) {
    throw new HttpError(500, "Failed to approve beta access", userError);
  }

  const { data: updatedInvite, error: inviteUpdateError } = await supabaseAdmin
    .from("beta_invites")
    .update({
      used_count: nextUsedCount,
      used_by_user_id: currentUser.id,
      used_at: approvedAt,
      status: nextStatus
    })
    .eq("id", invite!.id)
    .eq("used_count", invite!.used_count ?? 0)
    .select("id")
    .single();

  if (inviteUpdateError || !updatedInvite) {
    await supabaseAdmin
      .from("users")
      .update({
        beta_access_approved: false,
        beta_invite_code_used: null,
        beta_approved_at: null,
        beta_access_status: "pending",
        beta_access_granted_at: null,
        beta_invite_id: null
      })
      .eq("id", currentUser.id);

    throw new HttpError(500, "Failed to redeem beta invite", inviteUpdateError);
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "beta.code_redeemed",
    entityType: "beta_invite",
    entityId: invite!.id,
    metadata: { code: normalizedCode, used_count: nextUsedCount }
  });

  return {
    success: true,
    invite_code: normalizedCode,
    beta_access_approved: true,
    beta_approved_at: approvedAt,
    user: updatedUser
  };
}
