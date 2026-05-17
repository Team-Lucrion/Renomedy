import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import { redeemBetaInvite, validateBetaInvite } from "./beta.service";

export async function validateBetaInviteHandler(req: Request, res: Response) {
  const data = await validateBetaInvite(req.auth!.token, req.body.invite_code);
  return ok(res, data, "Beta invite valid");
}

export async function redeemBetaInviteHandler(req: Request, res: Response) {
  const data = await redeemBetaInvite(req.auth!.token, req.body.invite_code);
  return ok(res, data, "Beta invite redeemed");
}
