import { getUserSupabaseClient } from "../../lib/supabase";
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
  input: { full_name?: string; preferred_language?: string; invite_code?: string; onboarding_complete: boolean }
) {
  const sb = getUserSupabaseClient(jwt);
  const currentUser = await getCurrentUserRecord(jwt);
  if (input.onboarding_complete && currentUser.beta_access_status !== "active") {
    if (!input.invite_code) {
      throw new HttpError(403, "An approved beta invite code is required to complete onboarding");
    }

    await activateBetaInvite(jwt, input.invite_code);
  }

  const { invite_code: _inviteCode, ...userUpdates } = input;
  const { data, error } = await sb.from("users").update(userUpdates).select("*").single();
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
