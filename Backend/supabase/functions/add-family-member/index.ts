import { errorResponse, jsonResponse, swasthiTrustMetadata } from "../_shared/response.ts";
import { ensureClosedBetaAccess, getBearerToken, getUserClient, writeAuditLog } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  try {
    const jwt = getBearerToken(req);
    const body = await req.json().catch(() => ({}));
    const familyGroupId = String(body.family_group_id ?? "");
    const fullName = String(body.full_name ?? "").trim();

    if (!familyGroupId || !fullName) {
      return errorResponse(400, "family_group_id and full_name are required");
    }

    const currentUser = await ensureClosedBetaAccess(jwt);
    const userClient = getUserClient(jwt);
    const { data, error } = await userClient
      .from("family_members")
      .insert({
        family_group_id: familyGroupId,
        added_by_user_id: currentUser.id,
        full_name: fullName,
        relationship: body.relationship ?? null,
        dob: body.dob ?? null,
        gender: body.gender ?? null,
        chronic_conditions: body.chronic_conditions ?? [],
        allergies: body.allergies ?? [],
        notes: body.notes ?? null,
        is_primary_dependent: body.is_primary_dependent ?? false
      })
      .select("*")
      .single();

    if (error || !data) {
      return errorResponse(500, "Failed to add family member", error);
    }

    await writeAuditLog({
      userId: currentUser.id,
      action: "family.member_added",
      entityType: "family_member",
      entityId: data.id,
      metadata: { family_group_id: familyGroupId }
    });

    return jsonResponse(200, {
      success: true,
      function: "add-family-member",
      data,
      metadata: swasthiTrustMetadata
    });
  } catch (error) {
    return errorResponse(401, error instanceof Error ? error.message : "Unauthorized");
  }
});
