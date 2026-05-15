import { getUserSupabaseClient, supabaseAdmin } from "../../lib/supabase";
import { writeAuditLog } from "../../services/audit.service";
import { activateBetaInvite } from "../../services/beta-access.service";
import { getCurrentUserRecord } from "../../services/current-user.service";
import { HttpError } from "../../utils/http-error";

export async function getCurrentUser(jwt: string) {
  await getCurrentUserRecord(jwt);
  const sb = getUserSupabaseClient(jwt);
  const { data, error } = await sb.from("users").select("*").single();
  if (error) throw new HttpError(500, "Failed to fetch user", error);
  return data;
}

export async function updateOnboarding(
  jwt: string,
  input: {
    full_name?: string;
    role?: "self" | "caregiver";
    preferred_language?: string;
    invite_code?: string;
    onboarding_complete: boolean;
  }
) {
  const currentUser = await getCurrentUserRecord(jwt);
  const { invite_code: _inviteCode, ...userUpdates } = input;

  if (input.invite_code && currentUser.beta_access_status !== "active") {
    const data = await activateBetaInvite(jwt, input.invite_code, userUpdates);
    await writeAuditLog({
      userId: currentUser.id,
      action: "user.onboarding_updated",
      entityType: "user",
      entityId: currentUser.id,
      metadata: { onboarding_complete: input.onboarding_complete }
    });
    return data;
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .update({
      ...userUpdates,
      beta_access_status: "active",
    })
    .eq("id", currentUser.id)
    .select("*")
    .single();

  if (error) throw new HttpError(500, "Failed to update onboarding", error);
  await writeAuditLog({
    userId: currentUser.id,
    action: "user.onboarding_updated",
    entityType: "user",
    entityId: currentUser.id,
    metadata: { onboarding_complete: input.onboarding_complete }
  });
  return data;
}
