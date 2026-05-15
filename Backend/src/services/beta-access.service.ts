import { supabaseAdmin } from "../lib/supabase";
import { getCurrentUserRecord } from "./current-user.service";
import { HttpError } from "../utils/http-error";

type JwtIdentity = {
  sub?: string;
  email?: string;
};

type BetaInviteRecord = {
  id: string;
  invite_code?: string | null;
  status?: "approved" | "consumed" | "revoked" | string | null;
  is_active?: boolean | null;
  used?: boolean | null;
  email?: string | null;
  clerk_user_id?: string | null;
  used_by_user_id?: string | null;
  expires_at?: string | null;
};

type UserBetaAccessSnapshot = {
  id: string;
  beta_access_status?: string | null;
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
  // LAUNCH READINESS: Auto-approve all authenticated users.
  // Beta gating disabled for production launch.
  if (currentUser.beta_access_status !== "active") {
    const { data: updated, error } = await supabaseAdmin
      .from("users")
      .update({ beta_access_status: "active" })
      .eq("id", currentUser.id)
      .select("*")
      .single();
    if (error || !updated) {
      throw new HttpError(500, "Failed to auto-approve user access", error);
    }
    return updated;
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
    .eq("invite_code", normalizedCode)
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

  if (invite.status === "revoked" || invite.is_active === false) {
    throw new HttpError(403, "This beta invite has been revoked");
  }

  if (invite.status === "consumed" || invite.used === true) {
    throw new HttpError(403, "This beta invite has already been used");
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    throw new HttpError(403, "This beta invite has expired");
  }

  if (invite.email && identity.email && invite.email.toLowerCase() !== identity.email.toLowerCase()) {
    throw new HttpError(403, "This beta invite is issued for a different email address");
  }

  if (invite.clerk_user_id && identity.sub && invite.clerk_user_id !== identity.sub) {
    throw new HttpError(403, "This beta invite is issued for a different user");
  }

  const activationTimestamp = new Date().toISOString();
  const { data: previousUser, error: previousUserError } = await supabaseAdmin
    .from("users")
    .select("id, beta_access_status, beta_invite_id, beta_access_granted_at, beta_access_revoked_at")
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

  const inviteUpdates: Partial<BetaInviteRecord> & { used_by_user_id?: string | null } = {};

  if ("status" in invite) {
    inviteUpdates.status = "consumed";
  }

  if ("used" in invite) {
    inviteUpdates.used = true;
  }

  if ("used_by_user_id" in invite) {
    inviteUpdates.used_by_user_id = currentUser.id;
  }

  if ("clerk_user_id" in invite) {
    inviteUpdates.clerk_user_id = invite.clerk_user_id ?? identity.sub ?? null;
  }

  console.log("[beta-invite] marking invite used", {
    inviteId: invite.id,
    inviteCode: normalizedCode,
    updates: Object.keys(inviteUpdates)
  });

  let inviteUpdateQuery = supabaseAdmin.from("beta_invites").update(inviteUpdates).eq("id", invite.id);

  if ("used" in invite) {
    inviteUpdateQuery = inviteUpdateQuery.eq("used", false);
  }

  if ("status" in invite && invite.status) {
    inviteUpdateQuery = inviteUpdateQuery.eq("status", invite.status);
  }

  const { data: consumedInvite, error: inviteUpdateError } = Object.keys(inviteUpdates).length
    ? await inviteUpdateQuery.select("id").single()
    : { data: { id: invite.id }, error: null };

  if (inviteUpdateError || !consumedInvite) {
    console.log("[beta-invite] invite consumption failed; rolling back user activation", inviteUpdateError);
    const { error: rollbackError } = await supabaseAdmin
      .from("users")
      .update({
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
