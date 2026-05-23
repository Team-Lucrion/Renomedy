const MEDICAL_ABBREVIATION_DISPLAY = Object.freeze({
  OD: 'Once daily',
  BD: 'Twice daily',
  TDS: 'Three times daily',
  QID: 'Four times daily',
  SOS: 'As needed',
  AC: 'Before food',
  PC: 'After food',
  HS: 'At bedtime',
  STAT: 'Immediately',
  QOD: 'Every other day',
  QW: 'Once a week',
  BW: 'Twice a week',
});

function normalizeAbbreviation(value) {
  return String(value ?? '').trim().replace(/\./g, '').toUpperCase();
}

function isLikelyMedicalAbbreviation(value) {
  const normalized = normalizeAbbreviation(value);
  return /^[A-Z]{2,4}$/.test(normalized) || normalized === 'STAT';
}

function translateMedicalAbbreviation(value) {
  const raw = String(value ?? '').trim();
  const normalized = normalizeAbbreviation(raw);
  const displayText = MEDICAL_ABBREVIATION_DISPLAY[normalized];

  if (displayText) {
    return {
      raw,
      abbreviation: normalized === 'STAT' ? 'Stat' : normalized,
      displayText,
      isKnown: true,
      isAbbreviation: true,
    };
  }

  return {
    raw,
    abbreviation: raw,
    displayText: raw,
    isKnown: false,
    isAbbreviation: isLikelyMedicalAbbreviation(raw),
  };
}

function translateMedicalText(value) {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return {
      raw,
      displayText: '',
      knownTranslations: [],
      unknownAbbreviations: [],
    };
  }

  const tokens = raw.split(/(\s+|,|\/|\+|-)/);
  const knownTranslations = [];
  const unknownAbbreviations = [];
  const displayText = tokens
    .map((token) => {
      if (!token.trim() || /^[\s,\/+-]+$/.test(token)) {
        return token;
      }

      const translation = translateMedicalAbbreviation(token);
      if (translation.isKnown) {
        knownTranslations.push({
          abbreviation: translation.abbreviation,
          displayText: translation.displayText,
        });
        return translation.displayText;
      }

      if (translation.isAbbreviation) {
        unknownAbbreviations.push(translation.abbreviation);
      }

      return token;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    raw,
    displayText,
    knownTranslations,
    unknownAbbreviations: Array.from(new Set(unknownAbbreviations)),
  };
}

module.exports = {
  MEDICAL_ABBREVIATION_DISPLAY,
  normalizeAbbreviation,
  translateMedicalAbbreviation,
  translateMedicalText,
};
