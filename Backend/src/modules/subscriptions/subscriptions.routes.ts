import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/async-handler";
import { getMySubscriptionHandler, listPlansHandler } from "./subscriptions.controller";

export const subscriptionsRouter = Router();

subscriptionsRouter.get("/plans", requireAuth, asyncHandler(listPlansHandler));
subscriptionsRouter.get("/me", requireAuth, asyncHandler(getMySubscriptionHandler));
