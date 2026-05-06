import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { getMeHandler, updateOnboardingHandler } from "./users.controller";
import { onboardingSchema } from "./users.schemas";

export const usersRouter = Router();

usersRouter.get("/me", requireAuth, asyncHandler(getMeHandler));
usersRouter.patch("/onboarding", requireAuth, validateBody(onboardingSchema), asyncHandler(updateOnboardingHandler));
