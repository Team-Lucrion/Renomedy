import { z } from "zod";

export const registerTokenSchema = z.object({
  fcm_token: z.string().min(8),
  platform: z.string().min(2)
});

export const notificationPreferencesSchema = z.object({
  reminders_enabled: z.boolean(),
  refill_alerts_enabled: z.boolean(),
  missed_dose_alerts_enabled: z.boolean(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional()
});
