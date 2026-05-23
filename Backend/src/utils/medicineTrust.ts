type MedicineInput = {
  medicine_name?: string | null;
  brand_name?: string | null;
  generic_name?: string | null;
  strength?: string | null;
  dosage?: string | null;
  category?: string | null;
};

const BRAND_GENERIC_MAP: Record<string, { genericName: string; category: string }> = {
  pan: { genericName: "Pantoprazole", category: "gastro" },
  pantoprazole: { genericName: "Pantoprazole", category: "gastro" },
  "pan 40": { genericName: "Pantoprazole", category: "gastro" },
  pan40: { genericName: "Pantoprazole", category: "gastro" },
  dolo: { genericName: "Paracetamol", category: "pain_fever" },
  paracetamol: { genericName: "Paracetamol", category: "pain_fever" },
  "dolo 650": { genericName: "Paracetamol", category: "pain_fever" },
  dolo650: { genericName: "Paracetamol", category: "pain_fever" },
  telma: { genericName: "Telmisartan", category: "cardiovascular" },
  telmisartan: { genericName: "Telmisartan", category: "cardiovascular" },
  "telma 40": { genericName: "Telmisartan", category: "cardiovascular" },
  telma40: { genericName: "Telmisartan", category: "cardiovascular" },
  telmikind: { genericName: "Telmisartan", category: "cardiovascular" },
  tazloc: { genericName: "Telmisartan", category: "cardiovascular" },
  "telma am": { genericName: "Telmisartan + Amlodipine", category: "cardiovascular" },
  glycomet: { genericName: "Metformin", category: "diabetes" },
  metformin: { genericName: "Metformin", category: "diabetes" },
  "glycomet 500": { genericName: "Metformin", category: "diabetes" },
  glycomet500: { genericName: "Metformin", category: "diabetes" },
  "glycomet gp": { genericName: "Metformin + Glimepiride", category: "diabetes" },
  ecosprin: { genericName: "Aspirin", category: "cardiovascular" },
  aspirin: { genericName: "Aspirin", category: "cardiovascular" },
  "ecosprin 75": { genericName: "Aspirin", category: "cardiovascular" },
  ecosprin75: { genericName: "Aspirin", category: "cardiovascular" },
  januvia: { genericName: "Sitagliptin", category: "diabetes" },
  sitagliptin: { genericName: "Sitagliptin", category: "diabetes" },
  janumet: { genericName: "Sitagliptin + Metformin", category: "diabetes" },
  istamet: { genericName: "Sitagliptin + Metformin", category: "diabetes" },
  "galvus met": { genericName: "Vildagliptin + Metformin", category: "diabetes" },
  thyronorm: { genericName: "Levothyroxine", category: "thyroid" },
  levothyroxine: { genericName: "Levothyroxine", category: "thyroid" },
  "thyronorm 50": { genericName: "Levothyroxine", category: "thyroid" },
  thyronorm50: { genericName: "Levothyroxine", category: "thyroid" },
  thyronom: { genericName: "Levothyroxine", category: "thyroid" },
  cetcip: { genericName: "Cetirizine", category: "allergy" },
  cetzine: { genericName: "Cetirizine", category: "allergy" },
  cetirizine: { genericName: "Cetirizine", category: "allergy" },
  cetrizine: { genericName: "Cetirizine", category: "allergy" },
  citrezene: { genericName: "Cetirizine", category: "allergy" },
  cetrezene: { genericName: "Cetirizine", category: "allergy" },
  eltroxin: { genericName: "Levothyroxine", category: "thyroid" }
};

const CATEGORY_TRUST_DEFAULTS: Record<string, Record<string, unknown>> = {
  cardiovascular: {
    riskTier: "medium",
    refillCriticality: "high",
    strictTiming: true,
    decimalSensitive: false,
    updateSensitivity: "high",
    caregiverCautionState: "confirm_changes"
  },
  diabetes: {
    riskTier: "medium",
    refillCriticality: "high",
    strictTiming: true,
    decimalSensitive: true,
    updateSensitivity: "high",
    caregiverCautionState: "confirm_changes"
  },
  thyroid: {
    riskTier: "medium",
    refillCriticality: "high",
    strictTiming: true,
    decimalSensitive: true,
    updateSensitivity: "high",
    caregiverCautionState: "confirm_strength"
  },
  gastro: {
    riskTier: "low",
    refillCriticality: "medium",
    strictTiming: false,
    decimalSensitive: false,
    updateSensitivity: "medium",
    caregiverCautionState: "confirm_formulation"
  },
  pain_fever: {
    riskTier: "low",
    refillCriticality: "low",
    strictTiming: false,
    decimalSensitive: false,
    updateSensitivity: "medium",
    caregiverCautionState: "confirm_need"
  },
  allergy: {
    riskTier: "low",
    refillCriticality: "low",
    strictTiming: false,
    decimalSensitive: false,
    updateSensitivity: "low",
    caregiverCautionState: "routine"
  }
};

export function normalizeMedicineText(value?: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStrength(value?: unknown) {
  return normalizeMedicineText(value).replace(/\s+/g, "");
}

function normalizeStrengthToken(value?: unknown) {
  return String(value ?? "").toLowerCase().replace(/\s+/g, "").replace(/microgram|mcgs?/g, "mcg");
}

export function parseBrandStrengthEntry(input: MedicineInput) {
  const rawName = input.brand_name || input.medicine_name || "";
  const normalized = normalizeMedicineText(rawName);
  const strengthMatch = normalized.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s*(mg|mcg|g|iu))?(?:\s|$)/i);
  const parsedStrength = strengthMatch
    ? `${strengthMatch[1]} ${strengthMatch[2] || (/thyro|eltroxin|thyrox/.test(normalized) ? "mcg" : "mg")}`
    : "";
  const nameOnly = strengthMatch
    ? normalized.replace(strengthMatch[0], " ").replace(/\s+/g, " ").trim()
    : normalized;

  return {
    rawName,
    normalized,
    nameOnly,
    parsedStrength,
    strengthToken: normalizeStrengthToken(parsedStrength)
  };
}

function detectFormulation(...values: Array<unknown>) {
  const text = normalizeMedicineText(values.filter(Boolean).join(" "));
  if (/\bdsr\b/.test(text)) return "dsr";
  if (/\bsr\b|sustained release/.test(text)) return "sr";
  if (/\ber\b|extended release/.test(text)) return "er";
  if (/\bxr\b/.test(text)) return "xr";
  if (/\bcr\b|controlled release/.test(text)) return "cr";
  if (/\bmr\b|modified release/.test(text)) return "mr";
  if (/\bxl\b/.test(text)) return "xl";
  return "plain";
}

function stripFormulationTerms(value?: unknown) {
  return normalizeMedicineText(value)
    .replace(/\b(dsr|sr|er|xr|cr|mr|xl)\b/g, " ")
    .replace(/sustained release|extended release|controlled release|modified release/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitMolecules(value?: unknown) {
  return stripFormulationTerms(value)
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .sort();
}

export function getMedicineTrustProfile(input: MedicineInput) {
  const parsedEntry = parseBrandStrengthEntry(input);
  const brandKey = parsedEntry.nameOnly || parsedEntry.normalized;
  const catalogKey = Object.keys(BRAND_GENERIC_MAP).find((key) => brandKey === key || parsedEntry.normalized === key || brandKey.startsWith(`${key} `));
  const catalogMatch = (catalogKey ? BRAND_GENERIC_MAP[catalogKey] : undefined) ?? BRAND_GENERIC_MAP[normalizeMedicineText(input.generic_name)];
  const genericName = input.generic_name || catalogMatch?.genericName || input.medicine_name || "";
  const category = input.category || catalogMatch?.category || "unknown";
  const formulation = detectFormulation(input.medicine_name, input.brand_name, input.generic_name, input.strength, input.dosage);
  const molecules = splitMolecules(genericName);
  const defaults = CATEGORY_TRUST_DEFAULTS[category] ?? {
    riskTier: "unknown",
    refillCriticality: "medium",
    strictTiming: false,
    decimalSensitive: false,
    updateSensitivity: "medium",
    caregiverCautionState: "review_needed"
  };

  return {
    catalogBrandName: catalogMatch ? brandKey : null,
    familyDisplayName: input.brand_name || input.medicine_name || null,
    genericName: genericName || null,
    category,
    molecules,
    formulation,
    parsedStrength: parsedEntry.parsedStrength || null,
    isCombination: molecules.length > 1,
    stateKey: `${molecules.join("+") || normalizeMedicineText(input.medicine_name)}:${formulation}`,
    ...defaults
  };
}

export function evaluateMedicineRelationships(candidate: MedicineInput, existingMedicines: Array<MedicineInput & { id?: string | null; schedule_id?: string | null }>) {
  const candidateProfile = getMedicineTrustProfile(candidate);
  const candidateStrength = normalizeStrength(candidate.strength || candidate.dosage || (candidateProfile.parsedStrength as string | null));

  return existingMedicines
    .map((existing) => {
      const existingProfile = getMedicineTrustProfile(existing);
      const existingStrength = normalizeStrength(existing.strength || existing.dosage || (existingProfile.parsedStrength as string | null));
      const sharedMolecules = candidateProfile.molecules.filter((molecule) => existingProfile.molecules.includes(molecule));

      if (sharedMolecules.length === 0 || candidateProfile.molecules.length === 0 || existingProfile.molecules.length === 0) {
        return null;
      }

      const sameState = candidateProfile.stateKey === existingProfile.stateKey;
      const sameStrength = Boolean(candidateStrength && existingStrength && candidateStrength === existingStrength);
      const formulationDiffers = candidateProfile.formulation !== existingProfile.formulation;
      const isComboOverlap = candidateProfile.isCombination || existingProfile.isCombination;

      if (sameState && sameStrength) {
        return { type: "duplicate_state", severity: "high", sharedMolecules, existingScheduleId: existing.schedule_id ?? existing.id ?? null };
      }

      if (formulationDiffers) {
        return { type: "formulation_variant", severity: "high", sharedMolecules, existingScheduleId: existing.schedule_id ?? existing.id ?? null };
      }

      if (isComboOverlap) {
        return { type: "combo_overlap", severity: "high", sharedMolecules, existingScheduleId: existing.schedule_id ?? existing.id ?? null };
      }

      return { type: "same_molecule", severity: "medium", sharedMolecules, existingScheduleId: existing.schedule_id ?? existing.id ?? null };
    })
    .filter((notice): notice is { type: string; severity: string; sharedMolecules: string[]; existingScheduleId: string | null } => Boolean(notice));
}
