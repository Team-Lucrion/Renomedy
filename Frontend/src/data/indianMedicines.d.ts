export type IndianMedicineCatalogItem = {
  id: string;
  brandName: string;
  genericName: string;
  category: string;
  form?: string;
  medicineType?: string;
  supportMode: 'full_support' | 'recognition_only' | 'manual_only' | 'manual_only_high_risk' | 'blocked';
  highRisk: boolean;
  requiresManualVerification: boolean;
  isBetaSupported: boolean;
  indiaPriorityScore: number;
  strengths: string[];
  aliases?: string[];
  searchTokens?: string[];
  commonOCRMistakes?: string[];
  selectedStrength?: string;
  parsedInput?: {
    raw: string;
    normalized: string;
    compact: string;
    tokens: string[];
    nameOnly: string;
    parsedStrength: string;
    strengthToken: string;
  };
  molecules?: string[];
  trustMetadata?: {
    riskTier: 'low' | 'medium' | 'high' | 'unknown';
    refillCriticality: 'low' | 'medium' | 'high' | 'manual';
    strictTiming: boolean;
    updateSensitivity: 'low' | 'medium' | 'high';
    formulation: string;
    decimalSensitive: boolean;
    caregiverCautionState: string;
    supportMode: IndianMedicineCatalogItem['supportMode'];
    normalAutomationAllowed: boolean;
    safetyMessage: string;
  };
};

export const commonIndianMedicines: { length: number; source: string };
export function parseIndianMedicineEntry(query: string): {
  raw: string;
  normalized: string;
  compact: string;
  tokens: string[];
  nameOnly: string;
  parsedStrength: string;
  strengthToken: string;
};
export function searchIndianMedicines(query: string, limit?: number): IndianMedicineCatalogItem[];
export function findIndianMedicine(query: string): IndianMedicineCatalogItem | null;
export function suggestOcrMedicineCorrections(query: string, limit?: number): IndianMedicineCatalogItem[];
export function getSupportModeSafety(recordOrMode: IndianMedicineCatalogItem | IndianMedicineCatalogItem['supportMode']): {
  supportMode: IndianMedicineCatalogItem['supportMode'];
  normalAutomationAllowed: boolean;
  activationBlocked: boolean;
  message: string;
};
export const SUPPORT_MODE_MESSAGES: Record<IndianMedicineCatalogItem['supportMode'], string>;
