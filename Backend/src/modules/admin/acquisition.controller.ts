import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import { HttpError } from "../../utils/http-error";
import {
  createAcquisitionLead,
  getAcquisitionDailyBrief,
  listAcquisitionLeads,
  updateAcquisitionLead,
  isAcquisitionLeadStatus,
  type AcquisitionLeadStatus
} from "./acquisition.service";

export async function createAcquisitionLeadHandler(req: Request, res: Response) {
  const data = await createAcquisitionLead(req.body);
  return ok(res, data, "Acquisition lead created");
}

export async function listAcquisitionLeadsHandler(req: Request, res: Response) {
  const rawStatus = typeof req.query.status === "string" ? req.query.status : undefined;
  if (rawStatus && !isAcquisitionLeadStatus(rawStatus)) throw new HttpError(400, "Invalid acquisition lead status");
  const data = await listAcquisitionLeads(rawStatus as AcquisitionLeadStatus | undefined);
  return ok(res, data, "Acquisition leads");
}

export async function updateAcquisitionLeadHandler(req: Request, res: Response) {
  const data = await updateAcquisitionLead(req.params.leadId, req.body);
  return ok(res, data, "Acquisition lead updated");
}

export async function getAcquisitionDailyBriefHandler(_req: Request, res: Response) {
  const data = await getAcquisitionDailyBrief();
  return ok(res, data, "Acquisition daily brief");
}
