import { z } from "zod/v3";

export const createBetaInviteSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
  clerk_user_id: z.string().min(3).optional(),
  notes: z.string().optional(),
  expires_at: z.string().optional()
});

export const assignSubscriptionSchema = z.object({
  user_id: z.string().uuid(),
  plan_slug: z.enum(["free", "care", "family_plus"]),
  billing_cycle: z.enum(["monthly", "yearly", "lifetime"])
});
