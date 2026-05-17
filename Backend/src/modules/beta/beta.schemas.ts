import { z } from "zod/v3";

export const betaInviteCodeSchema = z.object({
  invite_code: z.string().trim().min(6).max(64)
});
