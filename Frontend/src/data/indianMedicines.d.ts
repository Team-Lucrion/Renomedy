export type IndianMedicineCatalogItem = {
  brandName: string;
  genericName: string;
  category: string;
  strengths: string[];
  aliases?: string[];
  selectedStrength?: string;
  parsedInput?: {
    raw: string;
    normalized: string;
    nameOnly: string;
    parsedStrength: string;
    strengthToken: string;
  };
  molecules?: string[];
  trustMetadata?: {
    riskTier: 'low' | 'medium' | 'high' | 'unknown';
    refillCriticality: 'low' | 'medium' | 'high';
    strictTiming: boolean;
    updateSensitivity: 'low' | 'medium' | 'high';
    formulation: string;
    decimalSensitive: boolean;
    caregiverCautionState: string;
  };
};

export const commonIndianMedicines: IndianMedicineCatalogItem[];
export function parseIndianMedicineEntry(query: string): {
  raw: string;
  normalized: string;
  nameOnly: string;
  parsedStrength: string;
  strengthToken: string;
};
export function searchIndianMedicines(query: string, limit?: number): IndianMedicineCatalogItem[];
