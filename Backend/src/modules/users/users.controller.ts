import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import { getCurrentUser, updateOnboarding } from "./users.service";

export async function getMeHandler(req: Request, res: Response) {
  const data = await getCurrentUser(req.auth!.token);
  return ok(res, data, "User profile");
}

export async function updateOnboardingHandler(req: Request, res: Response) {
  const data = await updateOnboarding(req.auth!.token, req.body);
  return ok(res, data, "Onboarding updated");
}
