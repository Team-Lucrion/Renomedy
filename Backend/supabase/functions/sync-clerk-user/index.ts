import { errorResponse, jsonResponse, RenomedyTrustMetadata } from "../_shared/response.ts";
import { ensureCurrentUser, getBearerToken, getUserClient, writeAuditLog } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  try {
    const jwt = getBearerToken(req);
    const body = await req.json().catch(() => ({}));
    const currentUser = await ensureCurrentUser(jwt);
    const userClient = getUserClient(jwt);

    const { data, error } = await userClient
      .from("users")
      .update({
        full_name: body.full_name ?? undefined,
        email: body.email ?? undefined,
        phone: body.phone ?? undefined,
        role: body.role ?? undefined,
        preferred_language: body.preferred_language ?? undefined
      })
      .eq("id", currentUser.id)
      .select("*")
      .single();

    if (error || !data) {
      return errorResponse(500, "Failed to sync user", error);
    }

    await writeAuditLog({
      userId: currentUser.id,
      action: "user.synced",
      entityType: "user",
      entityId: currentUser.id,
      metadata: { clerk_user_id: currentUser.clerk_user_id }
    });

    return jsonResponse(200, {
      success: true,
      function: "sync-clerk-user",
      data,
      metadata: RenomedyTrustMetadata
    });
  } catch (error) {
    return errorResponse(401, error instanceof Error ? error.message : "Unauthorized");
  }
});
