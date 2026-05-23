const { commonIndianMedicines } = require('../data/indianMedicines');

const CATEGORY_TRUST_DEFAULTS = {
  cardiovascular: {
    riskTier: 'medium',
    refillCriticality: 'high',
    strictTiming: true,
    decimalSensitive: false,
    updateSensitivity: 'high',
    caregiverCautionState: 'confirm_changes',
  },
  diabetes: {
    riskTier: 'medium',
    refillCriticality: 'high',
    strictTiming: true,
    decimalSensitive: true,
    updateSensitivity: 'high',
    caregiverCautionState: 'confirm_changes',
  },
  thyroid: {
    riskTier: 'medium',
    refillCriticality: 'high',
    strictTiming: true,
    decimalSensitive: true,
    updateSensitivity: 'high',
    caregiverCautionState: 'confirm_strength',
  },
  antibiotics: {
    riskTier: 'low',
    refillCriticality: 'medium',
    strictTiming: true,
    decimalSensitive: false,
    updateSensitivity: 'medium',
    caregiverCautionState: 'confirm_duration',
  },
  pain_fever: {
    riskTier: 'low',
    refillCriticality: 'low',
    strictTiming: false,
    decimalSensitive: false,
    updateSensitivity: 'medium',
    caregiverCautionState: 'confirm_need',
  },
  gastro: {
    riskTier: 'low',
    refillCriticality: 'medium',
    strictTiming: false,
    decimalSensitive: false,
    updateSensitivity: 'medium',
    caregiverCautionState: 'confirm_formulation',
  },
  vitamins_supplements: {
    riskTier: 'low',
    refillCriticality: 'low',
    strictTiming: false,
    decimalSensitive: false,
    updateSensitivity: 'low',
    caregiverCautionState: 'routine',
  },
  allergy: {
    riskTier: 'low',
    refillCriticality: 'low',
    strictTiming: false,
    decimalSensitive: false,
    updateSensitivity: 'low',
    caregiverCautionState: 'routine',
  },
};

function normalizeMedicineText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStrength(value) {
  return normalizeMedicineText(value).replace(/\s+/g, '');
}

function normalizeStrengthToken(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '').replace(/microgram|mcgs?/g, 'mcg');
}

function parseBrandStrengthEntry(input) {
  const rawName = input.brandName || input.medicineName || input.medicine_name || '';
  const normalized = normalizeMedicineText(rawName);
  const strengthMatch = normalized.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s*(mg|mcg|g|iu))?(?:\s|$)/i);
  const parsedStrength = strengthMatch
    ? `${strengthMatch[1]} ${strengthMatch[2] || (/thyro|eltroxin|thyrox/.test(normalized) ? 'mcg' : 'mg')}`
    : '';
  const nameOnly = strengthMatch
    ? normalized.replace(strengthMatch[0], ' ').replace(/\s+/g, ' ').trim()
    : normalized;

  return {
    rawName,
    normalized,
    nameOnly,
    parsedStrength,
    strengthToken: normalizeStrengthToken(parsedStrength),
  };
}

function detectFormulation(...values) {
  const text = normalizeMedicineText(values.filter(Boolean).join(' '));
  if (/\bdsr\b/.test(text)) return 'dsr';
  if (/\bsr\b|sustained release/.test(text)) return 'sr';
  if (/\ber\b|extended release/.test(text)) return 'er';
  if (/\bxr\b/.test(text)) return 'xr';
  if (/\bcr\b|controlled release/.test(text)) return 'cr';
  if (/\bmr\b|modified release/.test(text)) return 'mr';
  if (/\bxl\b/.test(text)) return 'xl';
  return 'plain';
}

function stripFormulationTerms(value) {
  return normalizeMedicineText(value)
    .replace(/\b(dsr|sr|er|xr|cr|mr|xl)\b/g, ' ')
    .replace(/sustained release|extended release|controlled release|modified release/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitMolecules(value) {
  return stripFormulationTerms(value)
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .sort();
}

function findCatalogMatch(input) {
  const parsed = parseBrandStrengthEntry(input);
  const brandName = parsed.nameOnly || parsed.normalized;
  const genericName = normalizeMedicineText(input.genericName);

  return commonIndianMedicines.find((item) => {
    const itemBrand = normalizeMedicineText(item.brandName);
    const itemGeneric = normalizeMedicineText(item.genericName);
    const aliases = (item.aliases || []).map(normalizeMedicineText);
    return (
      itemBrand === brandName ||
      brandName.startsWith(`${itemBrand} `) ||
      aliases.includes(brandName) ||
      aliases.some((alias) => alias.startsWith(brandName) || alias === parsed.normalized) ||
      itemGeneric === brandName ||
      itemGeneric === genericName ||
      itemBrand === genericName
    );
  }) || null;
}

function getMedicineTrustProfile(input) {
  const parsedEntry = parseBrandStrengthEntry(input);
  const catalogMatch = findCatalogMatch(input) || {};
  const genericName = input.genericName || catalogMatch.genericName || input.medicineName || '';
  const category = catalogMatch.category || input.category || 'unknown';
  const formulation = detectFormulation(input.medicineName, input.brandName, input.genericName, input.strength, input.dosage);
  const molecules = splitMolecules(genericName);
  const defaults = CATEGORY_TRUST_DEFAULTS[category] || {
    riskTier: 'unknown',
    refillCriticality: 'medium',
    strictTiming: false,
    decimalSensitive: false,
    updateSensitivity: 'medium',
    caregiverCautionState: 'review_needed',
  };

  return {
    catalogBrandName: catalogMatch.brandName || null,
    familyDisplayName: input.brandName || input.medicineName || catalogMatch.brandName || null,
    genericName: genericName || null,
    category,
    molecules,
    formulation,
    parsedStrength: parsedEntry.parsedStrength || null,
    isCombination: molecules.length > 1,
    stateKey: `${molecules.join('+') || normalizeMedicineText(input.medicineName)}:${formulation}`,
    ...defaults,
  };
}

function evaluateMedicineRelationships(candidate, existingMedicines) {
  const candidateProfile = getMedicineTrustProfile(candidate);
  const candidateStrength = normalizeStrength(candidate.strength || candidate.dosage || candidateProfile.parsedStrength);

  return (existingMedicines || [])
    .map((existing) => {
      const existingProfile = getMedicineTrustProfile(existing);
      const existingStrength = normalizeStrength(existing.strength || existing.dosage || existingProfile.parsedStrength);
      const sharedMolecules = candidateProfile.molecules.filter((molecule) => existingProfile.molecules.includes(molecule));

      if (sharedMolecules.length === 0 || candidateProfile.molecules.length === 0 || existingProfile.molecules.length === 0) {
        return null;
      }

      const sameState = candidateProfile.stateKey === existingProfile.stateKey;
      const sameStrength = candidateStrength && existingStrength && candidateStrength === existingStrength;
      const isComboOverlap = candidateProfile.isCombination || existingProfile.isCombination;
      const formulationDiffers = candidateProfile.formulation !== existingProfile.formulation;

      let type = 'same_molecule';
      let severity = 'medium';
      let message = `This appears to share ${sharedMolecules.join(' + ')} with an active medicine. Confirm whether it replaces the old one.`;

      if (sameState && sameStrength) {
        type = 'duplicate_state';
        severity = 'high';
        message = 'This looks like the same medicine state already active. Do not keep duplicate reminders active.';
      } else if (formulationDiffers) {
        type = 'formulation_variant';
        severity = 'high';
        message = `Same molecule, different formulation (${existingProfile.formulation.toUpperCase()} vs ${candidateProfile.formulation.toUpperCase()}). Confirm against the prescription before replacing.`;
      } else if (isComboOverlap) {
        type = 'combo_overlap';
        severity = 'high';
        message = `Combination overlap detected for ${sharedMolecules.join(' + ')}. Keep both visible and confirm with the prescription.`;
      }

      return {
        type,
        severity,
        message,
        sharedMolecules,
        existingScheduleId: existing.scheduleId || existing.id || null,
        existingMedicationName: existing.medicineName || existing.brandName || existing.genericName || 'Active medicine',
        candidateProfile,
        existingProfile,
      };
    })
    .filter(Boolean);
}

module.exports = {
  evaluateMedicineRelationships,
  getMedicineTrustProfile,
  normalizeMedicineText,
  parseBrandStrengthEntry,
  splitMolecules,
};
