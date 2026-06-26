import { z } from "zod/v3";

export const uploadPrescriptionBodySchema = z.object({
  family_member_id: z.string().uuid(),
  doctor_name: z.string().optional(),
  hospital_name: z.string().optional(),
  prescription_date: z.string().optional()
});

export const decodePrescriptionBodySchema = uploadPrescriptionBodySchema;

export const scanPrescriptionBodySchema = uploadPrescriptionBodySchema.extend({
  imageBase64: z.string().min(1).optional(),
  imageUrl: z.string().url().optional(),
  mimeType: z.string().optional(),
  extractedText: z.string().optional(),
  ocrMetadata: z.record(z.any()).optional()
});

export const createManualPrescriptionDraftSchema = z.object({
  family_member_id: z.string().uuid()
});

export const parsePrescriptionSchema = z.object({
  force_reparse: z.boolean().default(false)
});

export const updateParsedMedicationSchema = z.object({
  medicine_name: z.string().min(1).optional(),
  brand_name: z.string().optional(),
  generic_name: z.string().optional(),
  strength: z.string().optional(),
  dose: z.string().optional(),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  timing: z.string().optional(),
  duration: z.string().optional(),
  food_timing: z.string().optional(),
  quantity_purchased: z.number().int().positive().optional(),
  start_date: z.string().optional(),
  instructions: z.string().optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  requires_manual_verification: z.boolean().optional(),
  verification_notes: z.string().optional(),
  verification_status: z.enum(["unverified", "user_verified", "pharmacist_verified", "doctor_verified"]).optional()
});

export const createManualMedicationSchema = z.object({
  medicine_name: z.string().min(1),
  brand_name: z.string().optional(),
  generic_name: z.string().optional(),
  strength: z.string().optional(),
  dose: z.string().optional(),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  timing: z.string().optional(),
  duration: z.string().optional(),
  food_timing: z.string().optional(),
  quantity_purchased: z.number().int().positive().optional(),
  start_date: z.string().optional(),
  instructions: z.string().optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  requires_manual_verification: z.boolean().optional(),
  verification_notes: z.string().optional(),
  verification_status: z.enum(["unverified", "user_verified", "pharmacist_verified", "doctor_verified"]).optional()
});

export const reconcilePrescriptionSchema = z.object({
  actions: z.array(z.object({
    type: z.enum(["continue_unchanged", "update_existing", "replace_existing", "discontinue", "add_new", "keep_active"]),
    existing_medication_id: z.string().uuid().optional(),
    new_medication_id: z.string().uuid().optional(),
    stop_old: z.boolean().optional(),
    begin_date: z.string().optional(),
    note: z.string().max(500).optional()
  })).min(1),
  superseded_prescription_ids: z.array(z.string().uuid()).optional()
});

export const processPrescriptionSchema = z.object({
  family_member_id: z.string().uuid(),
  extractedText: z.string().optional(),
  ocrMetadata: z.record(z.any()).optional(),
  segmentation: z.record(z.any()).optional(),
  image_url: z.string().optional()
});
