import { z } from "zod";

export const createBetaInviteSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
  clerk_user_id: z.string().min(3).optional(),
  notes: z.string().optional(),
  expires_at: z.string().optional()
});
