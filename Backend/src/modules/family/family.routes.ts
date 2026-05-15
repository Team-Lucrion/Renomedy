import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { addFamilyMemberHandler, archiveFamilyMemberHandler, createFamilyHandler, getFamilyMemberHandler, joinFamilyHandler, leaveFamilyHandler, listFamilyHandler, regenerateInviteHandler, removeFamilyMemberHandler, updateFamilyMemberHandler, validateInviteHandler } from "./family.controller";
import { addFamilyMemberSchema, createFamilySchema, joinFamilySchema, updateFamilyMemberSchema } from "./family.schemas";

export const familyRouter = Router();

familyRouter.post("/create", requireAuth, validateBody(createFamilySchema), asyncHandler(createFamilyHandler));
familyRouter.post("/join", requireAuth, validateBody(joinFamilySchema), asyncHandler(joinFamilyHandler));
familyRouter.get("/validate-invite/:code", requireAuth, asyncHandler(validateInviteHandler));
familyRouter.post("/regenerate-invite", requireAuth, asyncHandler(regenerateInviteHandler));
familyRouter.post("/leave", requireAuth, asyncHandler(leaveFamilyHandler));
familyRouter.post("/member/:id/remove", requireAuth, asyncHandler(removeFamilyMemberHandler));
familyRouter.post("/add-member", requireAuth, validateBody(addFamilyMemberSchema), asyncHandler(addFamilyMemberHandler));
familyRouter.get("/list", requireAuth, asyncHandler(listFamilyHandler));
familyRouter.get("/member/:id", requireAuth, asyncHandler(getFamilyMemberHandler));
familyRouter.patch("/member/:id", requireAuth, validateBody(updateFamilyMemberSchema), asyncHandler(updateFamilyMemberHandler));
familyRouter.post("/member/:id/archive", requireAuth, asyncHandler(archiveFamilyMemberHandler));
