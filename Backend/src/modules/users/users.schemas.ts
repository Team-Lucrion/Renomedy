import { z } from "zod";

export const onboardingSchema = z.object({
  full_name: z.string().min(1).optional(),
  preferred_language: z.string().optional(),
  invite_code: z.string().min(6).optional(),
  onboarding_complete: z.boolean()
});
