import { z } from "zod";

export const uploadPrescriptionBodySchema = z.object({
  family_member_id: z.string().uuid(),
  doctor_name: z.string().optional(),
  hospital_name: z.string().optional(),
  prescription_date: z.string().optional()
});

export const parsePrescriptionSchema = z.object({
  force_reparse: z.boolean().default(false)
});

export const updateParsedMedicationSchema = z.object({
  medicine_name: z.string().min(1).optional(),
  brand_name: z.string().optional(),
  generic_name: z.string().optional(),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  timing: z.string().optional(),
  duration: z.string().optional(),
  food_timing: z.string().optional(),
  instructions: z.string().optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  requires_manual_verification: z.boolean().optional(),
  verification_notes: z.string().optional(),
  verification_status: z.enum(["unverified", "user_verified", "pharmacist_verified", "doctor_verified"]).optional()
});
