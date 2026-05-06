import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { asyncHandler } from "../../utils/async-handler";
import { getFamilyOverviewHandler } from "./dashboard.controller";

export const dashboardRouter = Router();

dashboardRouter.get("/family-overview", requireAuth, asyncHandler(getFamilyOverviewHandler));
