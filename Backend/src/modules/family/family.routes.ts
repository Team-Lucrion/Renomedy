import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { addFamilyMemberHandler, createFamilyHandler, getFamilyMemberHandler, joinFamilyHandler, listFamilyHandler } from "./family.controller";
import { addFamilyMemberSchema, createFamilySchema, joinFamilySchema } from "./family.schemas";

export const familyRouter = Router();

familyRouter.post("/create", requireAuth, validateBody(createFamilySchema), asyncHandler(createFamilyHandler));
familyRouter.post("/join", requireAuth, validateBody(joinFamilySchema), asyncHandler(joinFamilyHandler));
familyRouter.post("/add-member", requireAuth, validateBody(addFamilyMemberSchema), asyncHandler(addFamilyMemberHandler));
familyRouter.get("/list", requireAuth, asyncHandler(listFamilyHandler));
familyRouter.get("/member/:id", requireAuth, asyncHandler(getFamilyMemberHandler));
