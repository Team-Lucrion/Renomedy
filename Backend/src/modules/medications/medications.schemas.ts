import { z } from "zod/v3";

export const activateMedicationSchema = z.object({
  family_member_id: z.string().uuid(),
  prescription_medication_id: z.string().uuid(),
  start_date: z.string(),
  end_date: z.string().optional(),
  reminder_times: z.array(z.string()).default([]),
  food_relation: z.string().optional(),
  refill_threshold_days: z.number().int().min(1).max(30).default(3),
  quantity_total: z.number().int().positive().optional(),
  quantity_remaining: z.number().int().min(0).optional(),
  daily_depletion: z.number().positive().optional(),
  projected_runout_date: z.string().optional()
});

export const doseLogSchema = z.object({
  medication_schedule_id: z.string().uuid(),
  scheduled_time: z.string(),
  taken_time: z.string().optional(),
  status: z.enum(["taken", "missed", "skipped", "snoozed"]),
  notes: z.string().optional()
});
