import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { requireFounder } from "../../middleware/founder";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import {
  createBetaInviteHandler,
  dismissFailedAlertHandler,
  listBetaInvitesHandler,
  listBetaUsersHandler,
  listOperationalIssuesHandler,
  retryFailedAlertHandler,
  revokeBetaAccessHandler
} from "./admin.controller";
import { createBetaInviteSchema } from "./admin.schemas";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireFounder);
adminRouter.get("/beta-users", asyncHandler(listBetaUsersHandler));
adminRouter.get("/beta-invites", asyncHandler(listBetaInvitesHandler));
adminRouter.post("/beta-invites", validateBody(createBetaInviteSchema), asyncHandler(createBetaInviteHandler));
adminRouter.post("/beta-users/:userId/revoke", asyncHandler(revokeBetaAccessHandler));
adminRouter.get("/issues", asyncHandler(listOperationalIssuesHandler));
adminRouter.post("/alerts/:alertId/retry", asyncHandler(retryFailedAlertHandler));
adminRouter.post("/alerts/:alertId/dismiss", asyncHandler(dismissFailedAlertHandler));
