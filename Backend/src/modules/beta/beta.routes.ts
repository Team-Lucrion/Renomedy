import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { redeemBetaInviteHandler, validateBetaInviteHandler } from "./beta.controller";
import { betaInviteCodeSchema } from "./beta.schemas";

export const betaRouter = Router();

betaRouter.use(requireAuth);
betaRouter.post("/validate", validateBody(betaInviteCodeSchema), asyncHandler(validateBetaInviteHandler));
betaRouter.post("/redeem", validateBody(betaInviteCodeSchema), asyncHandler(redeemBetaInviteHandler));
