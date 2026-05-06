import { Webhook } from "svix";
import type { Request } from "express";
import { env } from "../../config/env";
import { supabaseAdmin } from "../../lib/supabase";
import { writeAuditLog } from "../../services/audit.service";
import { HttpError } from "../../utils/http-error";

export async function upsertClerkUser(params: {
  clerkUserId: string;
  fullName?: string;
  email?: string;
  phone?: string;
  role?: "self" | "caregiver";
  preferredLanguage?: string;
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
  await writeAuditLog({
    userId: data.id,
    action: "user.synced",
    entityType: "user",
    entityId: data.id,
    metadata: { clerk_user_id: params.clerkUserId }
  });
  return data;
}

export async function processClerkWebhook(req: Request) {
  const headers = req.headers;
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
  const svixId = headers["svix-id"];
  const svixTimestamp = headers["svix-timestamp"];
  const svixSignature = headers["svix-signature"];

  if (!svixId || !svixTimestamp || !svixSignature) {
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
    throw new HttpError(400, "Invalid Clerk webhook signature", error);
  }

  const eventType = event.type as string;
  const userData = event.data;

  if (eventType === "user.created" || eventType === "user.updated") {
    const email = userData.email_addresses?.[0]?.email_address ?? null;
    await upsertClerkUser({
      clerkUserId: userData.id,
      fullName: [userData.first_name, userData.last_name].filter(Boolean).join(" "),
      email: email ?? undefined,
      phone: userData.phone_numbers?.[0]?.phone_number,
      role: "caregiver",
      preferredLanguage: "en"
    });
  }

  if (eventType === "user.deleted") {
    await supabaseAdmin.from("users").delete().eq("clerk_user_id", userData.id);
  }

  return { eventType };
}
