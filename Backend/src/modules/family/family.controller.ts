import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import { addFamilyMember, archiveFamilyMember, createFamily, getFamilyMember, joinFamily, leaveFamily, listFamilies, regenerateInvite, removeFamilyMember, updateFamilyMember, validateInvite } from "./family.service";

export async function createFamilyHandler(req: Request, res: Response) {
  const data = await createFamily(req.auth!.token, req.body);
  return ok(res, data, "Sanctuary created");
}

export async function addFamilyMemberHandler(req: Request, res: Response) {
  const data = await addFamilyMember(req.auth!.token, req.body);
  return ok(res, data, "Sanctuary member added");
}

export async function joinFamilyHandler(req: Request, res: Response) {
  const data = await joinFamily(req.auth!.token, req.body.invite_code, req.body.role);
  return ok(res, data, "Joined sanctuary");
}

export async function validateInviteHandler(req: Request, res: Response) {
  const data = await validateInvite(req.params.code);
  return ok(res, data, "Invite validated");
}

export async function regenerateInviteHandler(req: Request, res: Response) {
  const data = await regenerateInvite(req.auth!.token);
  return ok(res, data, "Invite code regenerated");
}

export async function leaveFamilyHandler(req: Request, res: Response) {
  const data = await leaveFamily(req.auth!.token);
  return ok(res, data, "Left sanctuary");
}

export async function removeFamilyMemberHandler(req: Request, res: Response) {
  const data = await removeFamilyMember(req.auth!.token, req.params.id);
  return ok(res, data, "Member removed from sanctuary");
}

export async function listFamilyHandler(req: Request, res: Response) {
  const data = await listFamilies(req.auth!.token);
  return ok(res, data, "Sanctuary list");
}

export async function getFamilyMemberHandler(req: Request, res: Response) {
  const data = await getFamilyMember(req.auth!.token, req.params.id);
  return ok(res, data, "Sanctuary member details");
}

export async function updateFamilyMemberHandler(req: Request, res: Response) {
  const data = await updateFamilyMember(req.auth!.token, req.params.id, req.body);
  return ok(res, data, "Sanctuary member updated");
}

export async function archiveFamilyMemberHandler(req: Request, res: Response) {
  const data = await archiveFamilyMember(req.auth!.token, req.params.id);
  return ok(res, data, "Sanctuary member archived");
}
