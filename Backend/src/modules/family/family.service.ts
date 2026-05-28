import { getUserSupabaseClient, supabaseAdmin } from "../../lib/supabase";
import { writeAuditLog } from "../../services/audit.service";
import { ensureClosedBetaAccess } from "../../services/beta-access.service";
import { assertFeatureAccess } from "../subscriptions/subscriptions.service";
import { HttpError } from "../../utils/http-error";

type FamilyMembership = {
  family_group_id: string;
  user_id: string;
  role: "owner" | "admin" | "caregiver" | "patient" | "family_member" | "viewer";
  status: "active" | "invited" | "inactive";
};

type FamilyMemberInput = {
  family_group_id: string;
  full_name?: string;
  age?: number | null;
  dob?: string | null;
  gender?: string | null;
  relationship?: string;
  role?: "caregiver" | "patient" | "family_member";
  avatar_url?: string | null;
  chronic_conditions?: string[];
  allergies?: string[];
  notes?: string | null;
  is_primary_dependent?: boolean;
};

function normalizedString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeFullName(input: Record<string, unknown>, fallback?: string | null) {
  const candidate = normalizedString(input.full_name) ?? normalizedString(input.name) ?? fallback ?? null;
  if (!candidate) {
    throw new HttpError(400, "Family member name is required");
  }
  return candidate;
}

function normalizeRole(value: unknown, fallback: "caregiver" | "patient" | "family_member" = "family_member") {
  if (value === "caregiver" || value === "patient" || value === "family_member") {
    return value;
  }
  return fallback;
}

function memberRelationshipFromRole(value: "caregiver" | "patient" | "family_member") {
  if (value === "patient") {
    return "Self";
  }

  if (value === "caregiver") {
    return "Primary Caregiver";
  }

  return "Family Member";
}

async function getActiveMemberships(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("family_group_memberships")
    .select("family_group_id, user_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) {
    throw new HttpError(500, "Failed to fetch family memberships", error);
  }

  return (data ?? []) as FamilyMembership[];
}

async function assertFamilyManager(userId: string, familyGroupId: string) {
  const memberships = await getActiveMemberships(userId);
  const membership = memberships.find((item) => item.family_group_id === familyGroupId);

  if (!membership || !["owner", "caregiver"].includes(membership.role)) {
    throw new HttpError(403, "Only family owners and caregivers can manage family members");
  }

  return membership;
}

async function getFamilyMemberStats(memberIds: string[]) {
  if (memberIds.length === 0) {
    return new Map<string, { active_medication_count: number; active_reminder_count: number; prescription_count: number; medication_status: string }>();
  }

  const [{ data: schedules, error: scheduleError }, { data: prescriptions, error: prescriptionError }] = await Promise.all([
    supabaseAdmin
      .from("medication_schedules")
      .select("id, family_member_id, status")
      .in("family_member_id", memberIds),
    supabaseAdmin
      .from("prescriptions")
      .select("id, family_member_id")
      .in("family_member_id", memberIds),
  ]);

  if (scheduleError || prescriptionError) {
    throw new HttpError(500, "Failed to fetch family member profile stats", { scheduleError, prescriptionError });
  }

  const stats = new Map<string, { active_medication_count: number; active_reminder_count: number; prescription_count: number; medication_status: string }>();

  for (const memberId of memberIds) {
    const activeMedicationCount = (schedules ?? []).filter((item) => item.family_member_id === memberId && item.status === "active").length;
    const activeReminderCount = activeMedicationCount;
    const prescriptionCount = (prescriptions ?? []).filter((item) => item.family_member_id === memberId).length;
    const medicationStatus =
      activeMedicationCount > 0
        ? `${activeMedicationCount} active medication${activeMedicationCount === 1 ? "" : "s"}`
        : prescriptionCount > 0
          ? "No active reminders"
          : "Profile ready";

    stats.set(memberId, {
      active_medication_count: activeMedicationCount,
      active_reminder_count: activeReminderCount,
      prescription_count: prescriptionCount,
      medication_status: medicationStatus,
    });
  }

  return stats;
}

function buildFamilyMemberPayload(input: Record<string, unknown>, currentUserId: string, existing?: Record<string, unknown>) {
  const fullName = normalizeFullName(input, typeof existing?.full_name === "string" ? existing.full_name : null);
  const role = normalizeRole(input.role, normalizeRole(existing?.role));
  const relationship = normalizedString(input.relationship) ?? normalizedString(existing?.relationship);

  if (!relationship) {
    throw new HttpError(400, "Relationship is required");
  }

  const age = input.age === null ? null : input.age === undefined ? (existing?.age as number | null | undefined) ?? null : Number(input.age);
  if (age !== null && (!Number.isFinite(age) || age < 0 || age > 120)) {
    throw new HttpError(400, "Age must be between 0 and 120");
  }

  const chronicConditions = Array.isArray(input.chronic_conditions)
    ? input.chronic_conditions.map((item) => String(item).trim()).filter(Boolean)
    : Array.isArray(existing?.chronic_conditions)
      ? (existing.chronic_conditions as string[])
      : [];

  const allergies = Array.isArray(input.allergies)
    ? input.allergies.map((item) => String(item).trim()).filter(Boolean)
    : Array.isArray(existing?.allergies)
      ? (existing.allergies as string[])
      : [];

  const isPrimaryDependent =
    input.is_primary_dependent === undefined
      ? Boolean(existing?.is_primary_dependent ?? role === "patient")
      : Boolean(input.is_primary_dependent);

  return {
    family_group_id: String(input.family_group_id ?? existing?.family_group_id ?? ""),
    full_name: fullName,
    name: fullName,
    relationship,
    age,
    dob: input.dob === undefined ? (existing?.dob as string | null | undefined) ?? null : normalizedString(input.dob),
    gender: input.gender === undefined ? (existing?.gender as string | null | undefined) ?? null : normalizedString(input.gender),
    role,
    avatar_url:
      input.avatar_url === undefined
        ? (existing?.avatar_url as string | null | undefined) ?? null
        : normalizedString(input.avatar_url),
    chronic_conditions: chronicConditions,
    allergies,
    notes: input.notes === undefined ? (existing?.notes as string | null | undefined) ?? null : normalizedString(input.notes),
    is_primary_dependent: isPrimaryDependent,
    created_by: String(existing?.created_by ?? currentUserId),
  };
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createFamily(jwt: string, input: {
  family_name: string;
  member_role?: "caregiver" | "patient" | "family_member";
  primary_member_name?: string;
  primary_member_relationship?: string;
}) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const inviteCode = generateInviteCode();
  const inviteExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  const memberRole = normalizeRole(input.member_role, "caregiver");

  const { data, error } = await supabaseAdmin
    .from("family_groups")
    .insert({
      family_name: input.family_name,
      owner_user_id: currentUser.id,
      invite_code: inviteCode,
      invite_expires_at: inviteExpiresAt,
    })
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

  const { error: profileError } = await supabaseAdmin.from("family_members").insert({
    family_group_id: data.id,
    added_by_user_id: currentUser.id,
    created_by: currentUser.id,
    full_name: normalizedString(input.primary_member_name) ?? currentUser.full_name ?? "Primary Member",
    name: normalizedString(input.primary_member_name) ?? currentUser.full_name ?? "Primary Member",
    relationship: normalizedString(input.primary_member_relationship) ?? memberRelationshipFromRole(memberRole),
    role: memberRole,
    chronic_conditions: [],
    allergies: [],
    is_primary_dependent: memberRole === "patient",
  });
  if (profileError) throw new HttpError(500, "Failed to create sanctuary member profile", profileError);

  const { error: userUpdateError } = await supabaseAdmin
    .from("users")
    .update({ last_sanctuary_id: data.id })
    .eq("id", currentUser.id);
  if (userUpdateError) throw new HttpError(500, "Failed to persist last sanctuary", userUpdateError);

  await writeAuditLog({
    userId: currentUser.id,
    action: "family.created",
    entityType: "family_group",
    entityId: data.id,
    metadata: { family_name: input.family_name, invite_code: inviteCode }
  });

  return data;
}

export async function joinFamily(jwt: string, inviteCode: string, requestedRole?: string) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const normalizedCode = inviteCode.trim().toUpperCase();

  const { data: family, error: familyError } = await supabaseAdmin
    .from("family_groups")
    .select("id, family_name, invite_code, owner_user_id, invite_expires_at")
    .eq("invite_code", normalizedCode)
    .single();

  if (familyError || !family) throw new HttpError(404, "Invalid sanctuary invite code", familyError);

  // Check invite expiry
  if (family.invite_expires_at && new Date(family.invite_expires_at).getTime() < Date.now()) {
    throw new HttpError(403, "This invite code has expired. Ask the sanctuary admin for a new one.");
  }

  if (family.owner_user_id === currentUser.id) {
    throw new HttpError(409, "You are already the owner of this sanctuary");
  }

  // Check if user is already in ANY sanctuary (prevent duplicate sanctuary creation / joining multiple)
  const { data: userMemberships } = await supabaseAdmin
    .from("family_group_memberships")
    .select("family_group_id, role, status")
    .eq("user_id", currentUser.id)
    .eq("status", "active");

  const existingInThisFamily = (userMemberships ?? []).find((m) => m.family_group_id === family.id);
  if (existingInThisFamily) {
    throw new HttpError(409, "You are already a member of this sanctuary");
  }

  const existingInOtherFamily = (userMemberships ?? []).find((m) => m.family_group_id !== family.id);
  if (existingInOtherFamily) {
    throw new HttpError(409, "You are already in another sanctuary. Leave your current sanctuary first to join a new one.");
  }

  // Validate requested role (default to caregiver)
  const allowedRoles = ["caregiver", "patient", "family_member"];
  const role = (allowedRoles.includes(requestedRole ?? "") ? requestedRole : "caregiver") as "caregiver" | "patient" | "family_member";

  const { error: membershipError } = await supabaseAdmin.from("family_group_memberships").upsert(
    {
      family_group_id: family.id,
      user_id: currentUser.id,
      role,
      status: "active"
    },
    { onConflict: "family_group_id,user_id" }
  );

  if (membershipError) throw new HttpError(500, "Failed to join sanctuary", membershipError);

  const { error: profileError } = await supabaseAdmin.from("family_members").insert({
    family_group_id: family.id,
    added_by_user_id: currentUser.id,
    created_by: currentUser.id,
    full_name: currentUser.full_name ?? "Sanctuary Member",
    name: currentUser.full_name ?? "Sanctuary Member",
    relationship: memberRelationshipFromRole(role),
    role,
    chronic_conditions: [],
    allergies: [],
    is_primary_dependent: role === "patient",
  });
  if (profileError) throw new HttpError(500, "Failed to create sanctuary profile after join", profileError);

  const { error: userUpdateError } = await supabaseAdmin
    .from("users")
    .update({ last_sanctuary_id: family.id })
    .eq("id", currentUser.id);
  if (userUpdateError) throw new HttpError(500, "Failed to persist last sanctuary", userUpdateError);

  await writeAuditLog({
    userId: currentUser.id,
    action: "family.joined",
    entityType: "family_group",
    entityId: family.id,
    metadata: { invite_code: normalizedCode, role }
  });

  return { ...family, joined_role: role };
}

export async function addFamilyMember(jwt: string, input: Record<string, unknown>) {
  const sb = getUserSupabaseClient(jwt);
  const currentUser = await ensureClosedBetaAccess(jwt);
  const familyGroupId = String(input.family_group_id ?? "");
  await assertFamilyManager(currentUser.id, familyGroupId);
  const { count, error: countError } = await supabaseAdmin
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("family_group_id", familyGroupId)
    .eq("is_archived", false);

  if (countError) {
    throw new HttpError(500, "Failed to check family member limit", countError);
  }

  await assertFeatureAccess({ jwt, feature: "family_member", currentCount: count ?? 0 });
  const payload = buildFamilyMemberPayload(input, currentUser.id);

  const { data, error } = await sb
    .from("family_members")
    .insert({ ...payload, added_by_user_id: currentUser.id })
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
  const currentUser = await ensureClosedBetaAccess(jwt);
  const memberships = await getActiveMemberships(currentUser.id);
  const groupIds = memberships.map((item) => item.family_group_id);

  if (groupIds.length === 0) {
    return [];
  }

  const [{ data: groups, error: groupError }, { data: members, error: memberError }] = await Promise.all([
    supabaseAdmin
      .from("family_groups")
      .select("*")
      .in("id", groupIds)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("family_members")
      .select("*")
      .in("family_group_id", groupIds)
      .eq("is_archived", false)
      .order("created_at", { ascending: false }),
  ]);

  if (groupError || memberError) {
    throw new HttpError(500, "Failed to list family groups", { groupError, memberError });
  }

  const statsMap = await getFamilyMemberStats((members ?? []).map((member) => member.id));

  return (groups ?? []).map((group) => ({
    ...group,
    family_group_memberships: memberships
      .filter((membership) => membership.family_group_id === group.id)
      .map((membership) => ({
        user_id: membership.user_id,
        role: membership.role,
        status: membership.status,
      })),
    family_members: (members ?? [])
      .filter((member) => member.family_group_id === group.id)
      .map((member) => ({
        ...member,
        ...statsMap.get(member.id),
      })),
  }));
}

export async function getFamilyMember(jwt: string, memberId: string) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const memberships = await getActiveMemberships(currentUser.id);
  const groupIds = memberships.map((item) => item.family_group_id);
  const { data, error } = await supabaseAdmin
    .from("family_members")
    .select("*")
    .eq("id", memberId)
    .eq("is_archived", false)
    .single();

  if (error || !data) throw new HttpError(404, "Family member not found", error);
  if (!groupIds.includes(data.family_group_id)) {
    throw new HttpError(403, "Family member is not accessible");
  }

  const statsMap = await getFamilyMemberStats([data.id]);
  return { ...data, ...statsMap.get(data.id) };
}

export async function updateFamilyMember(jwt: string, memberId: string, input: Record<string, unknown>) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const existing = await getFamilyMember(jwt, memberId);
  await assertFamilyManager(currentUser.id, existing.family_group_id);

  const payload = buildFamilyMemberPayload(
    {
      ...existing,
      ...input,
      family_group_id: existing.family_group_id,
    },
    currentUser.id,
    existing,
  );

  const { data, error } = await supabaseAdmin
    .from("family_members")
    .update(payload)
    .eq("id", memberId)
    .select("*")
    .single();

  if (error || !data) {
    throw new HttpError(500, "Failed to update family member", error);
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "family.member_updated",
    entityType: "family_member",
    entityId: memberId,
    metadata: { family_group_id: data.family_group_id },
  });

  const statsMap = await getFamilyMemberStats([data.id]);
  return { ...data, ...statsMap.get(data.id) };
}

export async function archiveFamilyMember(jwt: string, memberId: string) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const existing = await getFamilyMember(jwt, memberId);
  await assertFamilyManager(currentUser.id, existing.family_group_id);

  const [{ count: medicationCount, error: medicationError }, { count: prescriptionCount, error: prescriptionError }] = await Promise.all([
    supabaseAdmin
      .from("medication_schedules")
      .select("id", { count: "exact", head: true })
      .eq("family_member_id", memberId)
      .neq("status", "completed"),
    supabaseAdmin
      .from("prescriptions")
      .select("id", { count: "exact", head: true })
      .eq("family_member_id", memberId),
  ]);

  if (medicationError || prescriptionError) {
    throw new HttpError(500, "Failed to evaluate family member archive impact", { medicationError, prescriptionError });
  }

  const archivedAt = new Date().toISOString();

  const [{ data, error }, { error: scheduleError }] = await Promise.all([
    supabaseAdmin
      .from("family_members")
      .update({ is_archived: true, archived_at: archivedAt })
      .eq("id", memberId)
      .select("*")
      .single(),
    supabaseAdmin
      .from("medication_schedules")
      .update({ status: "completed" })
      .eq("family_member_id", memberId)
      .in("status", ["active", "paused"]),
  ]);

  if (error || !data || scheduleError) {
    throw new HttpError(500, "Failed to archive family member", { error, scheduleError });
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "family.member_archived",
    entityType: "family_member",
    entityId: memberId,
    metadata: {
      family_group_id: data.family_group_id,
      medication_count: medicationCount ?? 0,
      prescription_count: prescriptionCount ?? 0,
      archived_at: archivedAt,
    },
  });

  return {
    id: memberId,
    archived_at: archivedAt,
    medication_count: medicationCount ?? 0,
    prescription_count: prescriptionCount ?? 0,
  };
}

export async function validateInvite(inviteCode: string) {
  const normalizedCode = inviteCode.trim().toUpperCase();
  const { data: family, error } = await supabaseAdmin
    .from("family_groups")
    .select("id, family_name, invite_code, invite_expires_at")
    .eq("invite_code", normalizedCode)
    .single();

  if (error || !family) {
    throw new HttpError(404, "Invalid sanctuary invite code");
  }

  const isExpired = family.invite_expires_at && new Date(family.invite_expires_at).getTime() < Date.now();

  return {
    valid: !isExpired,
    sanctuary_name: family.family_name,
    invite_code: family.invite_code,
    expires_at: family.invite_expires_at,
    expired: isExpired,
  };
}

export async function regenerateInvite(jwt: string) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const memberships = await getActiveMemberships(currentUser.id);
  const ownedMembership = memberships.find((m) => m.role === "owner");

  if (!ownedMembership) {
    throw new HttpError(403, "Only sanctuary owners can regenerate invite codes");
  }

  const newCode = generateInviteCode();
  const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("family_groups")
    .update({ invite_code: newCode, invite_expires_at: newExpiresAt })
    .eq("id", ownedMembership.family_group_id)
    .select("*")
    .single();

  if (error || !data) {
    throw new HttpError(500, "Failed to regenerate invite code", error);
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "family.invite_regenerated",
    entityType: "family_group",
    entityId: data.id,
    metadata: { new_code: newCode, expires_at: newExpiresAt },
  });

  return { invite_code: newCode, invite_expires_at: newExpiresAt };
}

export async function leaveFamily(jwt: string) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const memberships = await getActiveMemberships(currentUser.id);

  if (memberships.length === 0) {
    throw new HttpError(400, "You are not in any sanctuary");
  }

  const membership = memberships[0];

  // Prevent sole owner from leaving
  if (membership.role === "owner") {
    const { count } = await supabaseAdmin
      .from("family_group_memberships")
      .select("id", { count: "exact", head: true })
      .eq("family_group_id", membership.family_group_id)
      .eq("status", "active");

    if (count && count <= 1) {
      throw new HttpError(403, "You are the only owner. Transfer ownership before leaving or delete the sanctuary.");
    }
  }

  const { error } = await supabaseAdmin
    .from("family_group_memberships")
    .update({ status: "inactive" })
    .eq("family_group_id", membership.family_group_id)
    .eq("user_id", currentUser.id);

  if (error) {
    throw new HttpError(500, "Failed to leave sanctuary", error);
  }

  const { error: userUpdateError } = await supabaseAdmin
    .from("users")
    .update({ last_sanctuary_id: null })
    .eq("id", currentUser.id);

  if (userUpdateError) {
    throw new HttpError(500, "Failed to clear last sanctuary", userUpdateError);
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "family.left",
    entityType: "family_group",
    entityId: membership.family_group_id,
    metadata: { previous_role: membership.role },
  });

  return { left: true, family_group_id: membership.family_group_id };
}

export async function removeFamilyMember(jwt: string, memberId: string) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const memberships = await getActiveMemberships(currentUser.id);
  const ownerMembership = memberships.find((m) => m.role === "owner");

  if (!ownerMembership) {
    throw new HttpError(403, "Only sanctuary owners can remove members");
  }

  // Find the family_member to get their family_group_id and user_id (if linked)
  const { data: member, error: memberError } = await supabaseAdmin
    .from("family_members")
    .select("id, family_group_id, added_by_user_id")
    .eq("id", memberId)
    .single();

  if (memberError || !member) {
    throw new HttpError(404, "Member not found", memberError);
  }

  if (member.family_group_id !== ownerMembership.family_group_id) {
    throw new HttpError(403, "Member is not in your sanctuary");
  }

  // Archive the family_member
  const { error: archiveError } = await supabaseAdmin
    .from("family_members")
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq("id", memberId);

  if (archiveError) {
    throw new HttpError(500, "Failed to remove member", archiveError);
  }

  // Also deactivate any linked membership (if the member was a user)
  const { data: linkedUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", member.added_by_user_id ?? "")
    .single();

  if (linkedUser) {
    await supabaseAdmin
      .from("family_group_memberships")
      .update({ status: "inactive" })
      .eq("family_group_id", member.family_group_id)
      .eq("user_id", linkedUser.id)
      .neq("role", "owner");
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "family.member_removed",
    entityType: "family_member",
    entityId: memberId,
    metadata: { family_group_id: member.family_group_id },
  });

  return { removed: true, member_id: memberId };
}
