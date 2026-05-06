import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import {
  createBetaInvite,
  dismissFailedAlert,
  listBetaInvites,
  listBetaUsers,
  listOperationalIssues,
  retryFailedAlert,
  revokeBetaAccess
} from "./admin.service";

export async function createBetaInviteHandler(req: Request, res: Response) {
  const data = await createBetaInvite(req.auth!.token, req.body);
  return ok(res, data, "Beta invite created");
}

export async function listBetaUsersHandler(_req: Request, res: Response) {
  const data = await listBetaUsers();
  return ok(res, data, "Beta users");
}

export async function listBetaInvitesHandler(_req: Request, res: Response) {
  const data = await listBetaInvites();
  return ok(res, data, "Beta invites");
}

export async function revokeBetaAccessHandler(req: Request, res: Response) {
  const data = await revokeBetaAccess(req.auth!.token, req.params.userId);
  return ok(res, data, "Beta access revoked");
}

export async function listOperationalIssuesHandler(_req: Request, res: Response) {
  const data = await listOperationalIssues();
  return ok(res, data, "Operational issues");
}

export async function retryFailedAlertHandler(req: Request, res: Response) {
  const data = await retryFailedAlert(req.auth!.token, req.params.alertId);
  return ok(res, data, "Alert re-queued");
}

export async function dismissFailedAlertHandler(req: Request, res: Response) {
  const data = await dismissFailedAlert(req.auth!.token, req.params.alertId);
  return ok(res, data, "Alert dismissed");
}
