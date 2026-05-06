import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import { activateMedication, listSchedules, logDose, refillStatus } from "./medications.service";

export async function activateMedicationHandler(req: Request, res: Response) {
  const data = await activateMedication(req.auth!.token, req.body);
  return ok(res, data, "Medication schedule activated");
}

export async function listSchedulesHandler(req: Request, res: Response) {
  const data = await listSchedules(req.auth!.token, String(req.query.familyMemberId ?? ""));
  return ok(res, data, "Medication schedules");
}

export async function logDoseHandler(req: Request, res: Response) {
  const data = await logDose(req.auth!.token, req.body);
  return ok(res, data, "Dose logged");
}

export async function refillStatusHandler(req: Request, res: Response) {
  const data = await refillStatus(req.auth!.token, String(req.query.familyMemberId ?? ""));
  return ok(res, data, "Refill continuity status");
}
