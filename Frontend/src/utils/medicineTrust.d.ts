export type MedicineTrustProfile = {
  catalogBrandName: string | null;
  familyDisplayName: string | null;
  genericName: string | null;
  category: string;
  molecules: string[];
  formulation: string;
  parsedStrength: string | null;
  isCombination: boolean;
  stateKey: string;
  riskTier: 'low' | 'medium' | 'high' | 'unknown';
  refillCriticality: 'low' | 'medium' | 'high';
  strictTiming: boolean;
  decimalSensitive: boolean;
  updateSensitivity: 'low' | 'medium' | 'high';
  caregiverCautionState: string;
};

export type MedicineRelationshipNotice = {
  type: 'duplicate_state' | 'same_molecule' | 'combo_overlap' | 'formulation_variant';
  severity: 'medium' | 'high';
  message: string;
  sharedMolecules: string[];
  existingScheduleId: string | null;
  existingMedicationName: string;
  candidateProfile: MedicineTrustProfile;
  existingProfile: MedicineTrustProfile;
};

export function evaluateMedicineRelationships(
  candidate: Record<string, unknown>,
  existingMedicines: Array<Record<string, unknown>>,
): MedicineRelationshipNotice[];

export function getMedicineTrustProfile(input: Record<string, unknown>): MedicineTrustProfile;
export function normalizeMedicineText(value?: unknown): string;
export function parseBrandStrengthEntry(input: Record<string, unknown>): {
  rawName: string;
  normalized: string;
  nameOnly: string;
  parsedStrength: string;
  strengthToken: string;
};
export function splitMolecules(value?: unknown): string[];
