import { z } from "zod";
import { logger } from "../../config/logger";

export const medicationSchema = z.object({
  name: z.string().min(1),
  genericName: z.string().optional(),
  strength: z.string().optional(),
  dose: z.string().optional(),
  frequency: z.string().optional(),
  frequencyMeaning: z.string().optional(),
  timing: z.string().optional(),
  foodTiming: z.string().optional(),
  durationDays: z.number().nullable().optional(),
  instructions: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  needsReview: z.boolean().default(true)
});

export const reasoningResultSchema = z.object({
  medicines: z.array(medicationSchema).default([]),
  warnings: z.array(z.string()).default([])
});

export type StructuredReasoning = z.infer<typeof reasoningResultSchema>;

export function validateReasoningResponse(payload: unknown): StructuredReasoning {
  const result = reasoningResultSchema.safeParse(payload);
  if (result.success) {
    return result.data;
  }

  logger.error({ err: result.error }, "[ai-validation] schema validation failed");
  // Basic recovery: if it's an object but failed schema, try to salvage what we can
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const raw = payload as any;
    return {
      medicines: Array.isArray(raw.medicines) ? raw.medicines.filter((m: any) => m && typeof m.name === "string") : [],
      warnings: Array.isArray(raw.warnings) ? raw.warnings.filter((w: any) => typeof w === "string") : ["Validation recovery mode active"]
    };
  }

  return { medicines: [], warnings: ["Critical validation failure"] };
}

export function cleanJsonResponse(raw: string): string {
  // Strip markdown fences
  let cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();

  // Extract JSON block if surrounded by text
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    cleaned = match[0];
  }

  return cleaned;
}
