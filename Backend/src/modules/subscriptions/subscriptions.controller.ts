import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import { getMySubscription, listPlans } from "./subscriptions.service";

export async function listPlansHandler(_req: Request, res: Response) {
  const data = await listPlans();
  return ok(res, data, "Renomedy subscription plans");
}

export async function getMySubscriptionHandler(req: Request, res: Response) {
  const data = await getMySubscription(req.auth!.token);
  return ok(res, data, "Active subscription");
}
