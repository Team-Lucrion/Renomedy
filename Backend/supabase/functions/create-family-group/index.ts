import { errorResponse, jsonResponse, swasthiTrustMetadata } from "../_shared/response.ts";
import { adminClient, ensureClosedBetaAccess, getBearerToken, getUserClient, writeAuditLog } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  try {
    const jwt = getBearerToken(req);
    const body = await req.json().catch(() => ({}));
    const familyName = String(body.family_name ?? "").trim();
    if (familyName.length < 2) {
      return errorResponse(400, "family_name must be at least 2 characters");
    }

    const currentUser = await ensureClosedBetaAccess(jwt);
    const userClient = getUserClient(jwt);
    const { data, error } = await userClient
      .from("family_groups")
      .insert({
        owner_user_id: currentUser.id,
        family_name: familyName
      })
      .select("*")
      .single();

    if (error || !data) {
      return errorResponse(500, "Failed to create family group", error);
    }

    await adminClient.from("family_group_memberships").upsert(
      {
        family_group_id: data.id,
        user_id: currentUser.id,
        role: "owner",
        status: "active"
      },
      { onConflict: "family_group_id,user_id" }
    );

    await writeAuditLog({
      userId: currentUser.id,
      action: "family.created",
      entityType: "family_group",
      entityId: data.id,
      metadata: { family_name: familyName }
    });

    return jsonResponse(200, {
      success: true,
      function: "create-family-group",
      data,
      metadata: swasthiTrustMetadata
    });
  } catch (error) {
    return errorResponse(401, error instanceof Error ? error.message : "Unauthorized");
  }
});
