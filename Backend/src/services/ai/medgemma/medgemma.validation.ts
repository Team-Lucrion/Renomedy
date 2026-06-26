import { z } from "zod/v3";
import { logger } from "../../../config/logger";

export const medGemmaMedicineSchema = z.object({
  medicine_name: z.string().optional().default(""),
  generic_name: z.string().optional().default(""),
  dosage: z.string().optional().default(""),
  frequency: z.string().optional().default(""),
  duration: z.string().optional().default(""),
  instructions: z.string().optional().default(""),
  confidence: z.enum(["high", "medium", "low"]).catch("low"),
});

export const medGemmaResponseSchema = z.object({
  medicines: z.array(medGemmaMedicineSchema).optional().default([]),
  warnings: z.array(z.string()).optional().default([]),
  ocr_quality: z.enum(["high", "medium", "low"]).catch("low"),
});

export type MedGemmaPrescriptionPayload = z.infer<typeof medGemmaResponseSchema>;

export function parseMedGemmaResponse(rawText: string): MedGemmaPrescriptionPayload {
  const cleanedText = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(cleanedText);
  } catch (error) {
    // Attempt best-effort extraction if there's text surrounding the JSON
    const match = cleanedText.match(/\{[\s\S]*\}/);
    if (!match) {
      logger.error({ rawText: cleanedText.substring(0, 200) }, "MedGemma returned non-JSON response");
      throw new Error("MedGemma returned malformed JSON");
    }

    try {
      parsedJson = JSON.parse(match[0]);
    } catch (fallbackError) {
      logger.error({ rawText: match[0].substring(0, 200) }, "MedGemma returned unparseable JSON even after extraction");
      throw new Error("MedGemma returned unparseable JSON");
    }
  }

  const result = medGemmaResponseSchema.safeParse(parsedJson);

  if (!result.success) {
    logger.warn({ errors: result.error.errors, parsedJson }, "MedGemma response failed schema validation, applying fallback");
    // Even if it failed strict validation, if it's an object we can try to salvage what we can using a partial parse
    // or just return the default empty state if completely malformed
    return {
      medicines: [],
      warnings: [],
      ocr_quality: "low"
    };
  }

  return result.data;
}
