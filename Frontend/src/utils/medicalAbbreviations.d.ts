export type MedicalAbbreviationTranslation = {
  raw: string;
  abbreviation: string;
  displayText: string;
  isKnown: boolean;
  isAbbreviation: boolean;
};

export type MedicalTextTranslation = {
  raw: string;
  displayText: string;
  knownTranslations: Array<{
    abbreviation: string;
    displayText: string;
  }>;
  unknownAbbreviations: string[];
};

export const MEDICAL_ABBREVIATION_DISPLAY: Readonly<Record<string, string>>;
export function normalizeAbbreviation(value: string | null | undefined): string;
export function translateMedicalAbbreviation(value: string | null | undefined): MedicalAbbreviationTranslation;
export function translateMedicalText(value: string | null | undefined): MedicalTextTranslation;
