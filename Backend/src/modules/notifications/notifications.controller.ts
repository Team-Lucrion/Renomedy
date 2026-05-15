import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import { registerNotificationToken, sendTestPush, unregisterNotificationToken, updateNotificationPreferences } from "./notifications.service";

export async function registerTokenHandler(req: Request, res: Response) {
  const data = await registerNotificationToken(req.auth!.token, req.body);
  return ok(res, data, "Notification token registered");
}

export async function updatePreferencesHandler(req: Request, res: Response) {
  const data = await updateNotificationPreferences(req.auth!.token, req.body);
  return ok(res, data, "Notification preferences updated");
}

export async function unregisterTokenHandler(req: Request, res: Response) {
  const data = await unregisterNotificationToken(req.auth!.token, req.body);
  return ok(res, data, "Notification token removed");
}

export async function sendTestPushHandler(req: Request, res: Response) {
  const data = await sendTestPush(req.auth!.token);
  return ok(res, data, "Test push attempted");
}
