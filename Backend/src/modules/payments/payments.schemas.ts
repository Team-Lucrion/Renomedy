import { z } from "zod";

export const createOrderSchema = z.object({
  plan_slug: z.enum(["care", "family_plus"]),
  billing_cycle: z.enum(["monthly", "yearly"]).default("monthly"),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const paymentStatusSchema = z.object({
  razorpay_order_id: z.string().min(1),
});
