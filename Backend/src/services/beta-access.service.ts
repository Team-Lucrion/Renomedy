import { getUserSupabaseClient, supabaseAdmin } from "../lib/supabase";
import { getCurrentUserRecord } from "./current-user.service";
import { HttpError } from "../utils/http-error";

type JwtIdentity = {
  sub?: string;
  email?: string;
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
  if (currentUser.beta_access_status !== "active") {
    throw new HttpError(403, "Closed beta access is required");
  }

  return currentUser;
}

export async function activateBetaInvite(jwt: string, inviteCode: string) {
  const currentUser = await getCurrentUserRecord(jwt);
  const identity = decodeIdentity(jwt);
  const normalizedCode = inviteCode.trim().toUpperCase();

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("beta_invites")
    .select("*")
    .eq("invite_code", normalizedCode)
    .single();

  if (inviteError || !invite) {
    throw new HttpError(404, "Invalid beta invite code", inviteError);
  }

  if (invite.status === "revoked") {
    throw new HttpError(403, "This beta invite has been revoked");
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

  const { error: inviteUpdateError } = await supabaseAdmin
    .from("beta_invites")
    .update({
      status: "consumed",
      used_by_user_id: currentUser.id,
      clerk_user_id: invite.clerk_user_id ?? identity.sub ?? null
    })
    .eq("id", invite.id);

  if (inviteUpdateError) {
    throw new HttpError(500, "Failed to consume beta invite", inviteUpdateError);
  }

  const sb = getUserSupabaseClient(jwt);
  const { data: user, error: userError } = await sb
    .from("users")
    .update({
      beta_access_status: "active",
      beta_invite_id: invite.id,
      beta_access_granted_at: activationTimestamp,
      beta_access_revoked_at: null
    })
    .select("*")
    .single();

  if (userError || !user) {
    throw new HttpError(500, "Failed to activate beta access", userError);
  }

  return user;
}
