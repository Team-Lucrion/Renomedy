import type { Request, Response } from "express";
import { ok } from "../../utils/api-response";
import { createRazorpayOrder, getPaymentStatus, verifyRazorpayPayment, handleWebhook } from "./payments.service";

export async function createOrderHandler(req: Request, res: Response) {
  const data = await createRazorpayOrder(req.auth!.token, req.body);
  return ok(res, data, "Payment order created");
}

export async function verifyPaymentHandler(req: Request, res: Response) {
  const data = await verifyRazorpayPayment(req.auth!.token, req.body);
  return ok(res, data, "Payment verified");
}

export async function paymentStatusHandler(req: Request, res: Response) {
  const data = await getPaymentStatus(req.auth!.token, req.body.razorpay_order_id);
  return ok(res, data, "Payment status");
}

export async function webhookHandler(req: Request, res: Response) {
  const data = await handleWebhook(req);
  return ok(res, data, "Webhook processed");
}
