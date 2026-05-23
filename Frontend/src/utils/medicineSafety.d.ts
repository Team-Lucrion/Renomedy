export type ExcludedMedicineSignal = {
  category: string;
  label: string;
  matchedTerm: string;
};

export const EXCLUDED_MEDICINE_RULES: Array<{
  category: string;
  label: string;
  terms: string[];
}>;

export function detectExcludedMedicine(input: string | {
  medicineName?: string | null;
  brandName?: string | null;
  genericName?: string | null;
  instructions?: string | null;
}): ExcludedMedicineSignal | null;

export function hasDecimalDosage(...values: Array<string | null | undefined>): boolean;
export function parsePositiveInteger(value: string | null | undefined): number | null;
