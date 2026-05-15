import express, { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../utils/async-handler";
import { createOrderHandler, paymentStatusHandler, verifyPaymentHandler, webhookHandler } from "./payments.controller";
import { createOrderSchema, paymentStatusSchema, verifyPaymentSchema } from "./payments.schemas";

export const paymentsRouter = Router();

paymentsRouter.post("/create-order", requireAuth, validateBody(createOrderSchema), asyncHandler(createOrderHandler));
paymentsRouter.post("/verify", requireAuth, validateBody(verifyPaymentSchema), asyncHandler(verifyPaymentHandler));
paymentsRouter.post("/status", requireAuth, validateBody(paymentStatusSchema), asyncHandler(paymentStatusHandler));
paymentsRouter.post("/webhook", express.raw({ limit: "2mb", type: "application/json" }), asyncHandler(webhookHandler));
