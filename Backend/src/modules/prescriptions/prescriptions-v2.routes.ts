import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { processPrescriptionV2BodySchema } from "./prescriptions.schemas";
import { processPrescriptionV2Handler } from "./prescriptions.controller";

export const prescriptionsV2Router = Router();

prescriptionsV2Router.post(
  "/process",
  requireAuth,
  validateBody(processPrescriptionV2BodySchema),
  asyncHandler(processPrescriptionV2Handler)
);
