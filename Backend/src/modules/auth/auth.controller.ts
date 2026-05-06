import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import { processClerkWebhook, upsertClerkUser } from "./auth.service";

export async function syncClerkUserHandler(req: Request, res: Response) {
  const user = await upsertClerkUser({
    clerkUserId: req.auth!.clerkUserId,
    fullName: req.body.full_name,
    email: req.body.email,
    phone: req.body.phone,
    role: req.body.role,
    preferredLanguage: req.body.preferred_language
  });
  return ok(res, user, "User synced");
}

export async function clerkWebhookHandler(req: Request, res: Response) {
  const result = await processClerkWebhook(req);
  return ok(res, result, "Webhook processed");
}
