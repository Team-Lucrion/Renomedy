import { supabaseAdmin } from "../lib/supabase";
import { getCurrentUserRecord } from "./current-user.service";
import { HttpError } from "../utils/http-error";

type JwtIdentity = {
  sub?: string;
  email?: string;
};

type BetaInviteRecord = {
  id: string;
  code?: string | null;
  status?: "active" | "used" | "revoked" | string | null;
  email?: string | null;
  used_by_user_id?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
  used_count?: number | null;
};

type UserBetaAccessSnapshot = {
  id: string;
  beta_access_approved?: boolean | null;
  beta_access_status?: string | null;
  beta_invite_code_used?: string | null;
  beta_approved_at?: string | null;
  beta_invite_id?: string | null;
  beta_access_granted_at?: string | null;
  beta_access_revoked_at?: string | null;
};

function decodeIdentity(jwt: string): JwtIdentity {
  try {
    const [, payload = ""] = jwt.split(".");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as JwtIdentity;
  } catch {
    return {};
  }
}

export async function ensureClosedBetaAccess(jwt: string) {
  const currentUser = await getCurrentUserRecord(jwt);
  if (!currentUser.beta_access_approved && currentUser.beta_access_status !== "active") {
    throw new HttpError(403, "Beta invite required");
  }
  return currentUser;
}

export async function activateBetaInvite(jwt: string, inviteCode: string, userUpdates: Record<string, unknown> = {}) {
  const currentUser = await getCurrentUserRecord(jwt);
  const identity = decodeIdentity(jwt);
  const normalizedCode = inviteCode.trim().toUpperCase();

  console.log("[beta-invite] enteredCode", inviteCode);
  console.log("[beta-invite] normalizedCode", normalizedCode);
  console.log("[beta-invite] auth token present", Boolean(jwt));
  console.log("[beta-invite] auth validation result", {
    userId: currentUser.id,
    clerkUserId: currentUser.clerk_user_id,
    betaAccessStatus: currentUser.beta_access_status
  });

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("beta_invites")
    .select("*")
    .eq("code", normalizedCode)
    .single<BetaInviteRecord>();

  console.log("[beta-invite] Supabase response data", invite);
  console.log("[beta-invite] Supabase error", inviteError);

  if (inviteError?.code === "PGRST116") {
    console.log("[beta-invite] .single() returned no rows or multiple rows", {
      code: inviteError.code,
      details: inviteError.details,
      hint: inviteError.hint,
      message: inviteError.message
    });
  }

  if (inviteError || !invite) {
    throw new HttpError(404, "Invalid beta invite code", inviteError);
  }

  if (currentUser.beta_access_approved || currentUser.beta_access_status === "active") {
    throw new HttpError(409, "User already approved");
  }

  if (invite.status === "used" || invite.used_by_user_id || (invite.used_count ?? 0) > 0) {
    throw new HttpError(403, "This beta invite has already been used");
  }

  if (invite.status !== "active") {
    throw new HttpError(403, "This beta invite is not active");
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    throw new HttpError(403, "This beta invite has expired");
  }

  if (invite.email && identity.email && invite.email.toLowerCase() !== identity.email.toLowerCase()) {
    throw new HttpError(403, "This beta invite is issued for a different email address");
  }

  const activationTimestamp = new Date().toISOString();
  const { data: previousUser, error: previousUserError } = await supabaseAdmin
    .from("users")
    .select("id, beta_access_approved, beta_access_status, beta_invite_code_used, beta_approved_at, beta_invite_id, beta_access_granted_at, beta_access_revoked_at")
    .eq("id", currentUser.id)
    .single<UserBetaAccessSnapshot>();

  if (previousUserError || !previousUser) {
    console.log("[beta-invite] activation failed before user update", previousUserError);
    throw new HttpError(500, "Failed to load user before beta activation", previousUserError);
  }

  console.log("[beta-invite] activating user beta access", {
    userId: currentUser.id,
    inviteId: invite.id
  });

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .update({
      ...userUpdates,
      beta_access_approved: true,
      beta_invite_code_used: normalizedCode,
      beta_approved_at: activationTimestamp,
      beta_access_status: "active",
      beta_invite_id: invite.id,
      beta_access_granted_at: activationTimestamp,
      beta_access_revoked_at: null
    })
    .eq("id", currentUser.id)
    .select("*")
    .single();

  if (userError || !user) {
    console.log("[beta-invite] activation failed during user update", userError);
    throw new HttpError(500, "Failed to activate beta access", userError);
  }

  console.log("[beta-invite] user activation succeeded", {
    userId: currentUser.id,
    inviteId: invite.id
  });

  const nextUsedCount = (invite.used_count ?? 0) + 1;
  const inviteUpdates: Partial<BetaInviteRecord> & { used_by_user_id?: string | null; used_at?: string | null } = {
    used_count: nextUsedCount,
    used_by_user_id: currentUser.id,
    used_at: activationTimestamp,
    status: "used"
  };

  console.log("[beta-invite] marking invite used", {
    inviteId: invite.id,
    inviteCode: normalizedCode,
    updates: Object.keys(inviteUpdates)
  });

  let inviteUpdateQuery = supabaseAdmin.from("beta_invites").update(inviteUpdates).eq("id", invite.id);
  inviteUpdateQuery = inviteUpdateQuery
    .eq("status", "active")
    .eq("used_count", 0)
    .is("used_by_user_id", null)
    .is("used_at", null);

  const { data: consumedInvite, error: inviteUpdateError } = Object.keys(inviteUpdates).length
    ? await inviteUpdateQuery.select("id").single()
    : { data: { id: invite.id }, error: null };

  if (inviteUpdateError || !consumedInvite) {
    console.log("[beta-invite] invite consumption failed; rolling back user activation", inviteUpdateError);
    const { error: rollbackError } = await supabaseAdmin
      .from("users")
      .update({
        beta_access_approved: previousUser.beta_access_approved ?? false,
        beta_invite_code_used: previousUser.beta_invite_code_used ?? null,
        beta_approved_at: previousUser.beta_approved_at ?? null,
        beta_access_status: previousUser.beta_access_status ?? "pending",
        beta_invite_id: previousUser.beta_invite_id ?? null,
        beta_access_granted_at: previousUser.beta_access_granted_at ?? null,
        beta_access_revoked_at: previousUser.beta_access_revoked_at ?? null
      })
      .eq("id", currentUser.id);

    if (rollbackError) {
      console.log("[beta-invite] rollback failed after invite consumption error", rollbackError);
      throw new HttpError(500, "Failed to consume beta invite and rollback activation", {
        inviteUpdateError,
        rollbackError
      });
    }

    throw new HttpError(500, "Failed to consume beta invite", inviteUpdateError);
  }

  console.log("[beta-invite] activation completed", {
    userId: currentUser.id,
    inviteId: invite.id,
    inviteCode: normalizedCode
  });

  return user;
}
