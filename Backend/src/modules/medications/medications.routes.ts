import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { activateMedicationHandler, listSchedulesHandler, logDoseHandler, refillStatusHandler , updateScheduleHandler } from "./medications.controller";
import { activateMedicationSchema, doseLogSchema , updateScheduleSchema } from "./medications.schemas";

export const medicationsRouter = Router();

medicationsRouter.post("/activate", requireAuth, validateBody(activateMedicationSchema), asyncHandler(activateMedicationHandler));
medicationsRouter.get("/schedules", requireAuth, asyncHandler(listSchedulesHandler));
medicationsRouter.post("/log-dose", requireAuth, validateBody(doseLogSchema), asyncHandler(logDoseHandler));
medicationsRouter.get("/refill-status", requireAuth, asyncHandler(refillStatusHandler));
medicationsRouter.patch("/schedules/:id", requireAuth, validateBody(updateScheduleSchema), asyncHandler(updateScheduleHandler));
