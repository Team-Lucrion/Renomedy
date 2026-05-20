import { Webhook } from "svix";
import type { Request } from "express";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { captureException } from "../../lib/sentry";
import { supabaseAdmin } from "../../lib/supabase";
import { writeAuditLog } from "../../services/audit.service";
import { ensureFounderBetaBypass } from "../../services/founder-bypass.service";
import { HttpError } from "../../utils/http-error";

export async function upsertClerkUser(params: {
  clerkUserId: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: "self" | "caregiver";
  preferredLanguage?: string;
  auditMetadata?: Record<string, unknown>;
}) {
  const payload = {
    clerk_user_id: params.clerkUserId,
    full_name: params.fullName ?? null,
    email: params.email ?? null,
    phone: params.phone ?? null,
    role: params.role ?? "caregiver",
    preferred_language: params.preferredLanguage ?? "en"
  };

  const { data, error } = await supabaseAdmin.from("users").upsert(payload, { onConflict: "clerk_user_id" }).select("*").single();
  if (error) throw new HttpError(500, "Failed to sync user", error);
  const syncedUser = await ensureFounderBetaBypass(data, "auth_sync");
  await writeAuditLog({
    userId: syncedUser.id,
    action: "user.synced",
    entityType: "user",
    entityId: syncedUser.id,
    metadata: {
      clerk_user_id: params.clerkUserId,
      ...params.auditMetadata
    }
  });
  return syncedUser;
}

async function logWebhookFailure(input: {
  action: string;
  reason: string;
  req: Request;
  statusCode: number;
  clerkUserId?: string | null;
  svixId?: string | null;
  eventType?: string | null;
  extra?: Record<string, unknown>;
}) {
  let userId: string | null = null;

  if (input.clerkUserId) {
    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("clerk_user_id", input.clerkUserId)
      .maybeSingle();
    userId = existingUser?.id ?? null;
  }

  await writeAuditLog({
    userId,
    action: input.action,
    entityType: "clerk_webhook",
    metadata: {
      reason: input.reason,
      status_code: input.statusCode,
      request_id: input.req.requestId ?? null,
      svix_id: input.svixId ?? null,
      event_type: input.eventType ?? null,
      clerk_user_id: input.clerkUserId ?? null,
      ...input.extra
    }
  });
}

export async function processClerkWebhook(req: Request) {
  const headers = req.headers;
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
  const svixId = headers["svix-id"];
  const svixTimestamp = headers["svix-timestamp"];
  const svixSignature = headers["svix-signature"];

  if (!svixId || !svixTimestamp || !svixSignature) {
    logger.warn({ requestId: req.requestId, path: req.originalUrl }, "Rejected Clerk webhook with missing Svix headers");
    await logWebhookFailure({
      action: "auth.clerk_webhook_rejected",
      reason: "Missing Svix headers",
      req,
      statusCode: 400
    });
    throw new HttpError(400, "Missing Svix headers");
  }

  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);
  let event: any;
  try {
    event = wh.verify(rawBody, {
      "svix-id": String(svixId),
      "svix-timestamp": String(svixTimestamp),
      "svix-signature": String(svixSignature)
    });
  } catch (error) {
    logger.warn({ err: error, requestId: req.requestId, svixId }, "Rejected Clerk webhook with invalid signature");
    captureException(error, req);
    await logWebhookFailure({
      action: "auth.clerk_webhook_rejected",
      reason: "Invalid Clerk webhook signature",
      req,
      statusCode: 400,
      svixId: String(svixId)
    });
    throw new HttpError(400, "Invalid Clerk webhook signature", error);
  }

  const eventType = event.type as string;
  const userData = event.data;

  try {
    if (eventType === "user.created" || eventType === "user.updated") {
      const email = userData.email_addresses?.[0]?.email_address ?? null;
      await upsertClerkUser({
        clerkUserId: userData.id,
        fullName: [userData.first_name, userData.last_name].filter(Boolean).join(" "),
        email: email ?? undefined,
        phone: userData.phone_numbers?.[0]?.phone_number,
        role: "caregiver",
        preferredLanguage: "en",
        auditMetadata: {
          source: "clerk_webhook",
          event_type: eventType,
          svix_id: String(svixId)
        }
      });
    }

    if (eventType === "user.deleted") {
      const { data: existingUser, error: existingUserError } = await supabaseAdmin
        .from("users")
        .select("id, clerk_user_id")
        .eq("clerk_user_id", userData.id)
        .maybeSingle();

      if (existingUserError) {
        throw new HttpError(500, "Failed to lookup Clerk user for deletion", existingUserError);
      }

      const { error: deleteError } = await supabaseAdmin.from("users").delete().eq("clerk_user_id", userData.id);
      if (deleteError) {
        throw new HttpError(500, "Failed to delete Clerk user", deleteError);
      }

      await writeAuditLog({
        userId: existingUser?.id ?? null,
        action: "user.deleted",
        entityType: "user",
        entityId: existingUser?.id,
        metadata: {
          source: "clerk_webhook",
          event_type: eventType,
          svix_id: String(svixId),
          clerk_user_id: userData.id,
          existed_before_delete: Boolean(existingUser)
        }
      });
    }

    return { eventType, svixId: String(svixId) };
  } catch (error) {
    logger.error({ err: error, requestId: req.requestId, svixId, eventType }, "Clerk webhook processing failed");
    captureException(error, req);
    await logWebhookFailure({
      action: "auth.clerk_webhook_failed",
      reason: error instanceof Error ? error.message : "Unknown Clerk webhook failure",
      req,
      statusCode: error instanceof HttpError ? error.statusCode : 500,
      clerkUserId: userData?.id ?? null,
      svixId: String(svixId),
      eventType,
      extra: {
        error_name: error instanceof Error ? error.name : "UnknownError"
      }
    });
    throw error;
  }
}
