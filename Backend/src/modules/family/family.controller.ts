import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import { addFamilyMember, createFamily, getFamilyMember, joinFamily, listFamilies } from "./family.service";

export async function createFamilyHandler(req: Request, res: Response) {
  const data = await createFamily(req.auth!.token, req.body);
  return ok(res, data, "Family group created");
}

export async function addFamilyMemberHandler(req: Request, res: Response) {
  const data = await addFamilyMember(req.auth!.token, req.body);
  return ok(res, data, "Family member added");
}

export async function joinFamilyHandler(req: Request, res: Response) {
  const data = await joinFamily(req.auth!.token, req.body.invite_code);
  return ok(res, data, "Joined family group");
}

export async function listFamilyHandler(req: Request, res: Response) {
  const data = await listFamilies(req.auth!.token);
  return ok(res, data, "Family list");
}

export async function getFamilyMemberHandler(req: Request, res: Response) {
  const data = await getFamilyMember(req.auth!.token, req.params.id);
  return ok(res, data, "Family member details");
}
