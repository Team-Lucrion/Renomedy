import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import { getFamilyOverview } from "./dashboard.service";

export async function getFamilyOverviewHandler(req: Request, res: Response) {
  const data = await getFamilyOverview(req.auth!.token);
  return ok(res, data, "Family overview");
}
