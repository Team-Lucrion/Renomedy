import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { syncClerkUserHandler } from "./auth.controller";
import { syncClerkUserSchema } from "./auth.schemas";

export const authRouter = Router();

authRouter.post("/sync-clerk-user", requireAuth, validateBody(syncClerkUserSchema), asyncHandler(syncClerkUserHandler));
