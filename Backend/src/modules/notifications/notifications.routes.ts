import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { registerTokenHandler, sendTestPushHandler, unregisterTokenHandler, updatePreferencesHandler } from "./notifications.controller";
import { notificationPreferencesSchema, registerTokenSchema, unregisterTokenSchema } from "./notifications.schemas";

export const notificationsRouter = Router();

notificationsRouter.post("/register-token", requireAuth, validateBody(registerTokenSchema), asyncHandler(registerTokenHandler));
notificationsRouter.post("/unregister-token", requireAuth, validateBody(unregisterTokenSchema), asyncHandler(unregisterTokenHandler));
notificationsRouter.patch("/preferences", requireAuth, validateBody(notificationPreferencesSchema), asyncHandler(updatePreferencesHandler));
notificationsRouter.post("/test-push", requireAuth, asyncHandler(sendTestPushHandler));
