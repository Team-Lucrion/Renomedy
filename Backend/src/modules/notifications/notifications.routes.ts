import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { registerTokenHandler, sendTestPushHandler, updatePreferencesHandler } from "./notifications.controller";
import { notificationPreferencesSchema, registerTokenSchema } from "./notifications.schemas";

export const notificationsRouter = Router();

notificationsRouter.post("/register-token", requireAuth, validateBody(registerTokenSchema), asyncHandler(registerTokenHandler));
notificationsRouter.patch("/preferences", requireAuth, validateBody(notificationPreferencesSchema), asyncHandler(updatePreferencesHandler));
notificationsRouter.post("/test-push", requireAuth, asyncHandler(sendTestPushHandler));
