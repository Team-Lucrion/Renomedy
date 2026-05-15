import { z } from "zod/v3";

export const createFamilySchema = z.object({
  family_name: z.string().min(2),
  member_role: z.enum(["caregiver", "patient", "family_member"]).default("caregiver"),
  invite_family_later: z.boolean().optional(),
});

export const joinFamilySchema = z.object({
  invite_code: z.string().trim().min(6).max(16),
  role: z.enum(["caregiver", "patient", "family_member"]).optional()
});

export const addFamilyMemberSchema = z.object({
  family_group_id: z.string().uuid(),
  full_name: z.string().min(1),
  relationship: z.string().min(1),
  age: z.number().int().min(0).max(120).optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  role: z.enum(["caregiver", "patient", "family_member"]).default("family_member"),
  avatar_url: z.string().url().or(z.string().startsWith("file:")).or(z.string().startsWith("content:")).or(z.string().startsWith("ph://")).optional(),
  chronic_conditions: z.array(z.string()).default([]),
  allergies: z.array(z.string()).default([]),
  notes: z.string().optional(),
  is_primary_dependent: z.boolean().default(false)
});

export const updateFamilyMemberSchema = z.object({
  full_name: z.string().min(1).optional(),
  relationship: z.string().min(1).optional(),
  age: z.number().int().min(0).max(120).nullable().optional(),
  dob: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  role: z.enum(["caregiver", "patient", "family_member"]).optional(),
  avatar_url: z.string().url().or(z.string().startsWith("file:")).or(z.string().startsWith("content:")).or(z.string().startsWith("ph://")).nullable().optional(),
  chronic_conditions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  is_primary_dependent: z.boolean().optional()
});
