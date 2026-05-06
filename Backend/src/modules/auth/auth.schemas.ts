import { z } from "zod";

export const syncClerkUserSchema = z.object({
  full_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(["self", "caregiver"]).default("caregiver"),
  preferred_language: z.string().default("en")
});
