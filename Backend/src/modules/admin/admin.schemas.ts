import { z } from "zod/v3";

export const createBetaInviteSchema = z.object({
  code: z.string().trim().min(6).max(64).optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
  notes: z.string().optional(),
  expires_at: z.string().optional()
});

export const assignSubscriptionSchema = z.object({
  user_id: z.string().uuid(),
  plan_slug: z.enum(["free", "care", "family_plus"]),
  billing_cycle: z.enum(["monthly", "yearly", "lifetime"])
});

export const createAcquisitionLeadSchema = z.object({
  source: z.string().trim().min(1).max(64),
  source_url: z.string().url().max(2048).optional(),
  public_handle: z.string().trim().min(1).max(256).optional(),
  contact_channel: z.string().trim().min(1).max(64).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  caregiver_type: z.string().trim().min(1).max(120).optional(),
  care_context: z.string().trim().min(1).max(1000).optional(),
  medicine_complexity: z.number().int().min(0).max(2).optional(),
  prescription_confusion: z.boolean().optional(),
  reminder_refill_problem: z.boolean().optional(),
  feedback_willing: z.boolean().optional(),
  referral_likelihood: z.boolean().optional(),
  consent_status: z.enum(["research_only", "opted_in", "do_not_contact"]).optional(),
  research_summary: z.string().max(2000).optional(),
  founder_notes: z.string().max(4000).optional()
});

export const updateAcquisitionLeadSchema = z.object({
  status: z.enum(["researched", "qualified", "awaiting_approval", "approved", "contacted", "replied", "qualified_conversation", "beta_invited", "beta_redeemed", "first_upload", "won", "lost", "do_not_contact"]).optional(),
  consent_status: z.enum(["research_only", "opted_in", "do_not_contact"]).optional(),
  approval_status: z.enum(["not_required", "pending", "approved", "rejected"]).optional(),
  contacted_at: z.string().nullable().optional(),
  last_response_at: z.string().nullable().optional(),
  next_follow_up_at: z.string().nullable().optional(),
  beta_invite_id: z.string().uuid().nullable().optional(),
  founder_notes: z.string().max(4000).optional()
});
