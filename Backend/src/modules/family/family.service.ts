import { getUserSupabaseClient, supabaseAdmin } from "../../lib/supabase";
import { writeAuditLog } from "../../services/audit.service";
import { ensureClosedBetaAccess } from "../../services/beta-access.service";
import { getCurrentUserRecord } from "../../services/current-user.service";
import { HttpError } from "../../utils/http-error";

export async function createFamily(jwt: string, input: { family_name: string }) {
  const sb = getUserSupabaseClient(jwt);
  const currentUser = await ensureClosedBetaAccess(jwt);
  const { data, error } = await sb
    .from("family_groups")
    .insert({ ...input, owner_user_id: currentUser.id })
    .select("*")
    .single();
  if (error) throw new HttpError(500, "Failed to create family group", error);

  const { error: membershipError } = await supabaseAdmin.from("family_group_memberships").upsert(
    {
      family_group_id: data.id,
      user_id: currentUser.id,
      role: "owner",
      status: "active"
    },
    { onConflict: "family_group_id,user_id" }
  );
  if (membershipError) throw new HttpError(500, "Failed to attach owner membership", membershipError);

  await writeAuditLog({
    userId: currentUser.id,
    action: "family.created",
    entityType: "family_group",
    entityId: data.id,
    metadata: { family_name: input.family_name }
  });

  return data;
}

export async function joinFamily(jwt: string, inviteCode: string) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const normalizedCode = inviteCode.trim().toUpperCase();

  const { data: family, error: familyError } = await supabaseAdmin
    .from("family_groups")
    .select("id, family_name, invite_code, owner_user_id")
    .eq("invite_code", normalizedCode)
    .single();

  if (familyError || !family) throw new HttpError(404, "Invalid family invite code", familyError);
  if (family.owner_user_id === currentUser.id) return family;

  const { data: existingMembership } = await supabaseAdmin
    .from("family_group_memberships")
    .select("id")
    .eq("family_group_id", family.id)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (existingMembership?.id) return family;

  const { error: membershipError } = await supabaseAdmin.from("family_group_memberships").upsert(
    {
      family_group_id: family.id,
      user_id: currentUser.id,
      role: "caregiver",
      status: "active"
    },
    { onConflict: "family_group_id,user_id" }
  );

  if (membershipError) throw new HttpError(500, "Failed to join family group", membershipError);

  await writeAuditLog({
    userId: currentUser.id,
    action: "family.joined",
    entityType: "family_group",
    entityId: family.id,
    metadata: { invite_code: normalizedCode }
  });

  return family;
}

export async function addFamilyMember(jwt: string, input: Record<string, unknown>) {
  const sb = getUserSupabaseClient(jwt);
  const currentUser = await ensureClosedBetaAccess(jwt);
  const { data, error } = await sb
    .from("family_members")
    .insert({ ...input, added_by_user_id: currentUser.id })
    .select("*")
    .single();
  if (error) throw new HttpError(500, "Failed to add family member", error);

  await writeAuditLog({
    userId: currentUser.id,
    action: "family.member_added",
    entityType: "family_member",
    entityId: data.id,
    metadata: { family_group_id: data.family_group_id }
  });

  return data;
}

export async function listFamilies(jwt: string) {
  await ensureClosedBetaAccess(jwt);
  const sb = getUserSupabaseClient(jwt);
  const { data, error } = await sb
    .from("family_groups")
    .select("*, family_members(*), family_group_memberships(user_id, role, status)")
    .order("created_at", { ascending: false });
  if (error) throw new HttpError(500, "Failed to list family groups", error);
  return data;
}

export async function getFamilyMember(jwt: string, memberId: string) {
  await ensureClosedBetaAccess(jwt);
  const sb = getUserSupabaseClient(jwt);
  const { data, error } = await sb.from("family_members").select("*").eq("id", memberId).single();
  if (error) throw new HttpError(404, "Family member not found", error);
  return data;
}
