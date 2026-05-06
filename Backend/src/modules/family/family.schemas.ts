import { z } from "zod";

export const createFamilySchema = z.object({
  family_name: z.string().min(2)
});

export const joinFamilySchema = z.object({
  invite_code: z.string().trim().min(6).max(16)
});

export const addFamilyMemberSchema = z.object({
  family_group_id: z.string().uuid(),
  full_name: z.string().min(1),
  relationship: z.string().min(1),
  dob: z.string().optional(),
  gender: z.string().optional(),
  chronic_conditions: z.array(z.string()).default([]),
  allergies: z.array(z.string()).default([]),
  notes: z.string().optional(),
  is_primary_dependent: z.boolean().default(false)
});
