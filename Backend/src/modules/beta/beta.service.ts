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
  status: "active" | "used" | "revoked" | string;
  max_uses?: number | null;
  used_count?: number | null;
  expires_at?: string | null;
  used_at?: string | null;
  used_by_user_id?: string | null;
  notes?: string | null;
};

type JwtIdentity = {
  email?: string;
  phone_number?: string;
};

function normalizeInviteCode(inviteCode: string) {
  return inviteCode.trim().toUpperCase();
}

function decodeIdentity(jwt: string): JwtIdentity {
  try {
    const [, payload = ""] = jwt.split(".");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as JwtIdentity;
  } catch {
    return {};
  }
}

function normalizePhoneNumber(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

function resolveInviteError(invite: BetaInviteRecord | null) {
  if (!invite) return { statusCode: 404, message: "Invalid code" } as const;
  if (invite.status === "used" || invite.used_at || invite.used_by_user_id || (invite.used_count ?? 0) > 0) {
    return { statusCode: 409, message: "Already used" } as const;
  }
  if (invite.status !== "active") return { statusCode: 403, message: "Inactive code" } as const;
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return { statusCode: 403, message: "Expired code" } as const;
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

function assertInviteMatchesIdentity(invite: BetaInviteRecord, jwt: string) {
  const identity = decodeIdentity(jwt);

  if (invite.email) {
    const tokenEmail = identity.email?.trim().toLowerCase();
    if (!tokenEmail || tokenEmail !== invite.email.trim().toLowerCase()) {
      throw new HttpError(403, "This beta invite is issued for a different email address");
    }
  }

  if (invite.phone) {
    const tokenPhone = normalizePhoneNumber(identity.phone_number);
    if (!tokenPhone || tokenPhone !== normalizePhoneNumber(invite.phone)) {
      throw new HttpError(403, "This beta invite is issued for a different phone number");
    }
  }
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
  assertInviteMatchesIdentity(invite!, jwt);

  await writeAuditLog({
    userId: currentUser.id,
    action: "beta.code_validated",
    entityType: "beta_invite",
    entityId: invite!.id,
    metadata: {}
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
  assertInviteMatchesIdentity(invite!, jwt);

  const approvedAt = new Date().toISOString();

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
      used_count: 1,
      used_by_user_id: currentUser.id,
      used_at: approvedAt,
      status: "used"
    })
    .eq("id", invite!.id)
    .eq("status", "active")
    .is("used_by_user_id", null)
    .is("used_at", null)
    .eq("used_count", 0)
    .select("id")
    .maybeSingle();

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

    throw new HttpError(409, "Already used", inviteUpdateError);
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "beta.code_redeemed",
    entityType: "beta_invite",
    entityId: invite!.id,
    metadata: { used_count: 1 }
  });

  return {
    success: true,
    invite_code: normalizedCode,
    beta_access_approved: true,
    beta_approved_at: approvedAt,
    user: updatedUser
  };
}
