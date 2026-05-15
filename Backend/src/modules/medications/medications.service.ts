import { supabaseAdmin } from "../../lib/supabase";
import { writeAuditLog } from "../../services/audit.service";
import { ensureClosedBetaAccess } from "../../services/beta-access.service";
import { HttpError } from "../../utils/http-error";
import { deriveContinuityStatus, deriveProjectedRunoutDate } from "./refill.utils";

async function getAccessibleFamilyMemberIds(userId: string, familyMemberId?: string) {
  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from("family_group_memberships")
    .select("family_group_id")
    .eq("user_id", userId)
    .eq("status", "active");

  if (membershipsError) {
    throw new HttpError(500, "Failed to fetch family memberships", membershipsError);
  }

  const familyGroupIds = (memberships ?? []).map((membership) => membership.family_group_id);

  if (familyGroupIds.length === 0) {
    return [];
  }

  let membersQuery = supabaseAdmin
    .from("family_members")
    .select("id")
    .in("family_group_id", familyGroupIds);
  membersQuery = membersQuery.eq("is_archived", false);

  if (familyMemberId) {
    membersQuery = membersQuery.eq("id", familyMemberId);
  }

  const { data: members, error: membersError } = await membersQuery;

  if (membersError) {
    throw new HttpError(500, "Failed to fetch accessible family members", membersError);
  }

  return (members ?? []).map((member) => member.id);
}

export async function activateMedication(jwt: string, input: Record<string, unknown>) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const accessibleMemberIds = await getAccessibleFamilyMemberIds(currentUser.id, String(input.family_member_id));

  if (!accessibleMemberIds.includes(String(input.family_member_id))) {
    throw new HttpError(403, "Family member is not accessible");
  }

  const { data: medication, error: medicationError } = await supabaseAdmin
    .from("prescription_medications")
    .select("id, prescription_id, requires_manual_verification, prescriptions!inner(verification_status)")
    .eq("id", String(input.prescription_medication_id))
    .single();

  if (medicationError || !medication) {
    throw new HttpError(404, "Prescription medication not found", medicationError);
  }

  const prescriptionVerificationStatus = Array.isArray((medication as any).prescriptions)
    ? (medication as any).prescriptions[0]?.verification_status
    : (medication as any).prescriptions?.verification_status;

  if (medication.requires_manual_verification || prescriptionVerificationStatus === "unverified") {
    throw new HttpError(403, "Medication activation requires human verification first");
  }

  const refillThresholdDays = Number(input.refill_threshold_days ?? 3);
  const quantityTotal = input.quantity_total === undefined ? null : Number(input.quantity_total);
  const quantityRemaining =
    input.quantity_remaining === undefined ? quantityTotal : Number(input.quantity_remaining);
  const dailyDepletion =
    input.daily_depletion === undefined ? null : Number(input.daily_depletion);
  const projectedRunoutDate =
    typeof input.projected_runout_date === "string"
      ? input.projected_runout_date
      : deriveProjectedRunoutDate(quantityRemaining, dailyDepletion);
  const continuityStatus = deriveContinuityStatus(quantityRemaining, dailyDepletion, refillThresholdDays);

  const { quantity_total: _quantityTotal, quantity_remaining: _quantityRemaining, daily_depletion: _dailyDepletion, projected_runout_date: _projectedRunoutDate, ...scheduleInput } =
    input;

  const { data, error } = await supabaseAdmin.from("medication_schedules").insert(scheduleInput).select("*").single();
  if (error) throw new HttpError(500, "Failed to activate medication schedule", error);

  const { error: refillError } = await supabaseAdmin.from("refill_states").upsert(
    {
      medication_schedule_id: data.id,
      quantity_total: quantityTotal,
      quantity_remaining: quantityRemaining,
      daily_depletion: dailyDepletion,
      projected_runout_date: projectedRunoutDate,
      continuity_status: continuityStatus
    },
    { onConflict: "medication_schedule_id" }
  );
  if (refillError) throw new HttpError(500, "Failed to initialize refill tracking", refillError);

  await writeAuditLog({
    userId: currentUser.id,
    action: "medication.schedule_activated",
    entityType: "medication_schedule",
    entityId: data.id,
    metadata: { family_member_id: data.family_member_id, projected_runout_date: projectedRunoutDate }
  });
  return data;
}

export async function listSchedules(jwt: string, familyMemberId?: string) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const familyMemberIds = await getAccessibleFamilyMemberIds(currentUser.id, familyMemberId);

  if (familyMemberIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("medication_schedules")
    .select("*, prescription_medications(medicine_name, brand_name, generic_name, dosage, frequency, timing, duration, food_timing, verified_at), refill_states(*)")
    .in("family_member_id", familyMemberIds)
    .order("created_at", { ascending: false });

  if (error) throw new HttpError(500, "Failed to list schedules", error);
  return data;
}

export async function logDose(jwt: string, input: Record<string, unknown>) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const { data: schedule, error: scheduleError } = await supabaseAdmin
    .from("medication_schedules")
    .select("id, family_member_id")
    .eq("id", String(input.medication_schedule_id))
    .single();

  if (scheduleError || !schedule) {
    throw new HttpError(404, "Medication schedule not found", scheduleError);
  }

  const accessibleMemberIds = await getAccessibleFamilyMemberIds(currentUser.id, schedule.family_member_id);

  if (!accessibleMemberIds.includes(schedule.family_member_id)) {
    throw new HttpError(403, "Medication schedule is not accessible");
  }

  const { data, error } = await supabaseAdmin.from("dose_logs").insert(input).select("*").single();
  if (error) throw new HttpError(500, "Failed to log dose", error);

  if (data.status === "taken") {
    const { data: refillState, error: refillFetchError } = await supabaseAdmin
      .from("refill_states")
      .select("*")
      .eq("medication_schedule_id", data.medication_schedule_id)
      .maybeSingle();

    if (refillFetchError) {
      throw new HttpError(500, "Failed to fetch refill state", refillFetchError);
    }

    if (refillState) {
      const nextQuantityRemaining =
        refillState.quantity_remaining === null || refillState.quantity_remaining === undefined
          ? null
          : Math.max(Number(refillState.quantity_remaining) - 1, 0);
      const continuityStatus = deriveContinuityStatus(
        nextQuantityRemaining,
        refillState.daily_depletion === null ? null : Number(refillState.daily_depletion),
        3
      );
      const projectedRunoutDate = deriveProjectedRunoutDate(
        nextQuantityRemaining,
        refillState.daily_depletion === null ? null : Number(refillState.daily_depletion)
      );

      const { error: refillUpdateError } = await supabaseAdmin
        .from("refill_states")
        .update({
          quantity_remaining: nextQuantityRemaining,
          continuity_status: continuityStatus,
          projected_runout_date: projectedRunoutDate,
          last_dose_logged_at: data.taken_time ?? new Date().toISOString()
        })
        .eq("medication_schedule_id", data.medication_schedule_id);

      if (refillUpdateError) {
        throw new HttpError(500, "Failed to update refill state", refillUpdateError);
      }

      await writeAuditLog({
        userId: currentUser.id,
        action: "medication.refill_updated",
        entityType: "refill_state",
        metadata: {
          medication_schedule_id: data.medication_schedule_id,
          quantity_remaining: nextQuantityRemaining,
          continuity_status: continuityStatus
        }
      });
    }
  }

  await writeAuditLog({
    userId: currentUser.id,
    action: "medication.dose_logged",
    entityType: "dose_log",
    entityId: data.id,
    metadata: { medication_schedule_id: data.medication_schedule_id, status: data.status }
  });
  return data;
}

export async function refillStatus(jwt: string, familyMemberId?: string) {
  const currentUser = await ensureClosedBetaAccess(jwt);
  const familyMemberIds = await getAccessibleFamilyMemberIds(currentUser.id, familyMemberId);

  if (familyMemberIds.length === 0) {
    return [];
  }

  const { data: schedules, error } = await supabaseAdmin
    .from("medication_schedules")
    .select("id, family_member_id")
    .in("family_member_id", familyMemberIds);

  if (error) throw new HttpError(500, "Failed to fetch schedules", error);

  const scheduleIds = schedules
    .map((schedule) => schedule.id);

  if (scheduleIds.length === 0) {
    return [];
  }

  const { data, error: refillError } = await supabaseAdmin
    .from("refill_states")
    .select("*")
    .in("medication_schedule_id", scheduleIds);

  if (refillError) throw new HttpError(500, "Failed to fetch refill states", refillError);
  return data;
}
