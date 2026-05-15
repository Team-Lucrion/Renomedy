import { adminClient, ensureClosedBetaAccess, getBearerToken, writeAuditLog } from "../_shared/supabase.ts";
import { errorResponse, jsonResponse, RenomedyTrustMetadata } from "../_shared/response.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  try {
    const jwt = getBearerToken(req);
    const body = await req.json().catch(() => ({}));
    const inviteCode = String(body.invite_code ?? "").trim().toUpperCase();
    if (!inviteCode) {
      return errorResponse(400, "invite_code is required");
    }

    const currentUser = await ensureClosedBetaAccess(jwt);
    const { data: family, error: familyError } = await adminClient
      .from("family_groups")
      .select("id, family_name, invite_code, owner_user_id")
      .eq("invite_code", inviteCode)
      .single();

    if (familyError || !family) {
      return errorResponse(404, "Invalid family invite code", familyError);
    }

    if (family.owner_user_id !== currentUser.id) {
      const { error: membershipError } = await adminClient.from("family_group_memberships").upsert(
        {
          family_group_id: family.id,
          user_id: currentUser.id,
          role: "caregiver",
          status: "active"
        },
        { onConflict: "family_group_id,user_id" }
      );

      if (membershipError) {
        return errorResponse(500, "Failed to join family group", membershipError);
      }
    }

    await writeAuditLog({
      userId: currentUser.id,
      action: "family.joined",
      entityType: "family_group",
      entityId: family.id,
      metadata: { invite_code: inviteCode }
    });

    return jsonResponse(200, {
      success: true,
      function: "join-family-group",
      data: family,
      metadata: RenomedyTrustMetadata
    });
  } catch (error) {
    return errorResponse(401, error instanceof Error ? error.message : "Unauthorized");
  }
});
