const manifest = require('./medicineIndex/manifest');
const shardLoaders = require('./medicineIndex/loaders');

const loadedShards = new Map();
const searchCache = new Map();
const SEARCH_CACHE_LIMIT = 40;
const STOP_INDEX_TOKENS = new Set([
  'cap',
  'capsule',
  'capsules',
  'cream',
  'drop',
  'drops',
  'gel',
  'gm',
  'g',
  'injection',
  'iu',
  'mcg',
  'mg',
  'ml',
  'ointment',
  'oral',
  'solution',
  'suspension',
  'syrup',
  'tab',
  'tablet',
  'tablets',
]);

const SUPPORT_MODE_MESSAGES = {
  manual_only_high_risk:
    'This medicine requires careful manual management. Please verify timing and dosage directly with your doctor or pharmacist.',
  blocked:
    'This medicine needs more careful management than Swasthi currently supports. Please manage it directly with your doctor or pharmacist.',
  manual_only:
    'This medicine can be saved only after manual verification. Swasthi will not infer its schedule automatically.',
  recognition_only:
    'This medicine can be recognized and stored, but automated refill or long-term adherence assumptions are not enabled by default.',
  full_support: '',
};

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+/.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactSearchText(value) {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, '');
}

function normalizeStrengthToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/microgram|mcgs?/g, 'mcg');
}

function splitSearchTokens(value) {
  return normalizeSearchText(value).split(' ').filter(Boolean);
}

function parseIndianMedicineEntry(value) {
  const raw = String(value || '').trim();
  const normalized = normalizeSearchText(raw);
  const strengthMatch = normalized.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s*(mg|mcg|g|iu|iu\/ml))?(?:\s|$)/i);
  const parsedStrength = strengthMatch
    ? `${strengthMatch[1]} ${strengthMatch[2] || (/thyro|eltroxin|thyrox/.test(normalized) ? 'mcg' : 'mg')}`
    : '';
  const nameOnly = strengthMatch
    ? normalized.replace(strengthMatch[0], ' ').replace(/\s+/g, ' ').trim()
    : normalized;

  return {
    raw,
    normalized,
    compact: compactSearchText(raw),
    tokens: splitSearchTokens(nameOnly || normalized),
    nameOnly,
    parsedStrength,
    strengthToken: normalizeStrengthToken(parsedStrength),
  };
}

function shardKeyFor(value) {
  const compact = compactSearchText(value);
  if (compact.length < 2) return null;
  return compact.slice(0, Math.min(3, compact.length));
}

function getShardKeys(parsedQuery) {
  const keys = new Set();
  for (const token of parsedQuery.tokens) {
    if (STOP_INDEX_TOKENS.has(token)) continue;
    const key = shardKeyFor(token);
    if (key) keys.add(key);
  }

  const compactKey = shardKeyFor(parsedQuery.compact);
  if (compactKey) keys.add(compactKey);
  return [...keys];
}

function loadShard(key) {
  if (!loadedShards.has(key)) {
    const loader = shardLoaders[key];
    loadedShards.set(key, loader ? loader().map(expandRecord) : []);
  }

  return loadedShards.get(key);
}

function expandRecord(record) {
  if (record.brandName) return record;
  return {
    id: record.id,
    brandName: record.b,
    genericName: record.g,
    strength: record.s,
    form: record.f,
    category: record.c,
    medicineType: record.mt,
    supportMode: record.sm,
    highRisk: Boolean(record.hr),
    requiresManualVerification: Boolean(record.rmv),
    isBetaSupported: Boolean(record.beta),
    indiaPriorityScore: Number(record.ps || 0),
    aliases: record.a || [],
    searchTokens: record.t || [],
    commonOCRMistakes: record.o || [],
  };
}

function getRecordSearchPhrases(record) {
  return [
    record.brandName,
    record.genericName,
    record.strength,
    ...(record.aliases || []),
    ...(record.searchTokens || []),
  ].filter(Boolean);
}

function getRecordOcrPhrases(record) {
  return [
    record.brandName,
    record.genericName,
    ...(record.aliases || []),
    ...(record.searchTokens || []),
    ...(record.commonOCRMistakes || []),
  ].filter(Boolean);
}

function phraseMatchesQuery(phrase, parsedQuery) {
  const normalizedPhrase = normalizeSearchText(phrase);
  const compactPhrase = compactSearchText(phrase);
  const query = parsedQuery.nameOnly || parsedQuery.normalized;
  const compactQuery = compactSearchText(query);

  if (!query || query.length < 2) return false;
  if (normalizedPhrase === query || compactPhrase === compactQuery) return true;
  if (normalizedPhrase.startsWith(`${query} `) || compactPhrase.startsWith(compactQuery)) return true;

  const phraseTokens = splitSearchTokens(phrase);
  return parsedQuery.tokens.every((queryToken) =>
    phraseTokens.some((phraseToken) => phraseToken === queryToken || phraseToken.startsWith(queryToken)),
  );
}

function isExactBrandMatch(record, parsedQuery) {
  const normalizedBrand = normalizeSearchText(record.brandName);
  const compactBrand = compactSearchText(record.brandName);
  const queries = [parsedQuery.normalized, parsedQuery.nameOnly].filter(Boolean);
  return queries.some((query) =>
    normalizedBrand === query ||
    normalizedBrand.startsWith(`${query} `) ||
    compactBrand === compactSearchText(query) ||
    compactBrand.startsWith(compactSearchText(query)),
  );
}

function hasRequestedStrength(record, parsedQuery) {
  return Boolean(parsedQuery.strengthToken && normalizeStrengthToken(record.strength) === parsedQuery.strengthToken);
}

function recordMatchesQuery(record, parsedQuery) {
  return getRecordSearchPhrases(record).some((phrase) => phraseMatchesQuery(phrase, parsedQuery));
}

function recordMatchesOcrCorrection(record, parsedQuery) {
  return getRecordOcrPhrases(record).some((phrase) => phraseMatchesQuery(phrase, parsedQuery));
}

function levenshteinDistance(left, right) {
  const a = compactSearchText(left);
  const b = compactSearchText(right);
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

function getOcrCorrectionDistance(record, parsedQuery) {
  const query = parsedQuery.nameOnly || parsedQuery.normalized;
  const phrases = [
    record.brandName,
    record.genericName,
    ...(record.aliases || []),
    ...(record.searchTokens || []),
  ].filter(Boolean);
  const candidates = [];

  for (const phrase of phrases) {
    const normalized = normalizeSearchText(phrase);
    candidates.push(normalized);
    candidates.push(...normalized.split(' ').filter((token) => token.length >= 2));
  }

  return candidates.reduce((best, candidate) => Math.min(best, levenshteinDistance(query, candidate)), 999);
}

function toCatalogItem(record, parsedQuery) {
  const selectedStrength =
    parsedQuery.strengthToken && normalizeStrengthToken(record.strength) === parsedQuery.strengthToken
      ? record.strength
      : '';

  return {
    ...record,
    strengths: record.strength ? [record.strength] : [],
    selectedStrength,
    parsedInput: parsedQuery,
    molecules: splitCatalogMolecules(record.genericName),
    trustMetadata: deriveCatalogTrustMetadata(record),
  };
}

function searchIndianMedicines(query, limit = 8) {
  const parsedQuery = parseIndianMedicineEntry(query);
  const normalizedQuery = parsedQuery.nameOnly || parsedQuery.normalized;
  if (normalizedQuery.length < 2) return [];
  const cacheKey = `${normalizedQuery}|${parsedQuery.strengthToken}|${limit}`;
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey);
    searchCache.delete(cacheKey);
    searchCache.set(cacheKey, cached);
    return cached;
  }

  const seen = new Set();
  const candidates = [];

  for (const key of getShardKeys(parsedQuery)) {
    for (const record of loadShard(key)) {
      if (seen.has(record.id)) continue;
      seen.add(record.id);
      if (!recordMatchesQuery(record, parsedQuery)) continue;
      candidates.push(record);
    }
  }

  const results = candidates
    .sort((left, right) => {
      const exactLeft = isExactBrandMatch(left, parsedQuery) ? 0 : 1;
      const exactRight = isExactBrandMatch(right, parsedQuery) ? 0 : 1;
      return (
        exactLeft - exactRight ||
        Number(hasRequestedStrength(right, parsedQuery)) - Number(hasRequestedStrength(left, parsedQuery)) ||
        Number(right.indiaPriorityScore || 0) - Number(left.indiaPriorityScore || 0) ||
        String(left.brandName).localeCompare(String(right.brandName))
      );
    })
    .slice(0, limit)
    .map((record) => toCatalogItem(record, parsedQuery));

  searchCache.set(cacheKey, results);
  if (searchCache.size > SEARCH_CACHE_LIMIT) {
    searchCache.delete(searchCache.keys().next().value);
  }

  return results;
}

function findIndianMedicine(query) {
  return searchIndianMedicines(query, 1)[0] || null;
}

function suggestOcrMedicineCorrections(query, limit = 5) {
  const parsedQuery = parseIndianMedicineEntry(query);
  const normalizedQuery = parsedQuery.nameOnly || parsedQuery.normalized;
  if (normalizedQuery.length < 2) return [];

  const seen = new Set();
  const candidates = [];
  for (const key of getShardKeys(parsedQuery)) {
    for (const record of loadShard(key)) {
      if (seen.has(record.id)) continue;
      seen.add(record.id);
      if (recordMatchesOcrCorrection(record, parsedQuery)) candidates.push(record);
    }
  }

  return candidates
    .sort((left, right) => {
      const exactLeft = isExactBrandMatch(left, parsedQuery) ? 0 : 1;
      const exactRight = isExactBrandMatch(right, parsedQuery) ? 0 : 1;
      return (
        exactLeft - exactRight ||
        Number(hasRequestedStrength(right, parsedQuery)) - Number(hasRequestedStrength(left, parsedQuery)) ||
        getOcrCorrectionDistance(left, parsedQuery) - getOcrCorrectionDistance(right, parsedQuery) ||
        Number(right.indiaPriorityScore || 0) - Number(left.indiaPriorityScore || 0) ||
        String(left.brandName).localeCompare(String(right.brandName))
      );
    })
    .slice(0, limit)
    .map((record) => toCatalogItem(record, parsedQuery));
}

function deriveCatalogTrustMetadata(record) {
  const normalized = `${record.brandName || ''} ${record.genericName || ''} ${record.form || ''}`.toLowerCase();
  const support = getSupportModeSafety(record);
  const isDiabetes = /diabetes|insulin/.test(`${record.category || ''} ${record.medicineType || ''} ${record.genericName || ''}`.toLowerCase());
  const formulation = /\bdsr\b/.test(normalized)
    ? 'dsr'
    : /\bsr\b|sustained release/.test(normalized)
      ? 'sr'
      : /\ber\b|extended release/.test(normalized)
        ? 'er'
        : /\b(injection|injectable)\b/.test(normalized)
          ? 'injectable'
          : 'plain';

  return {
    riskTier: record.highRisk ? 'high' : isDiabetes || /hypertension|thyroid|cardio/.test(normalized) ? 'medium' : 'low',
    refillCriticality: support.normalAutomationAllowed && !record.highRisk ? 'high' : 'manual',
    strictTiming: /thyroid|hypertension|insulin|diabetes/.test(normalized),
    updateSensitivity: record.highRisk || !support.normalAutomationAllowed ? 'high' : 'medium',
    formulation,
    decimalSensitive: /\d+\.\d+/.test(normalized) || /thyroid|insulin/.test(normalized),
    caregiverCautionState: support.normalAutomationAllowed ? 'confirm_changes' : 'manual_review_required',
    supportMode: record.supportMode,
    normalAutomationAllowed: support.normalAutomationAllowed,
    safetyMessage: support.message,
  };
}

function splitCatalogMolecules(genericName) {
  return String(genericName || '')
    .replace(/sustained release|extended release/gi, '')
    .split('+')
    .map((part) => normalizeSearchText(part))
    .filter(Boolean)
    .sort();
}

function getSupportModeSafety(recordOrMode) {
  const supportMode =
    typeof recordOrMode === 'string'
      ? recordOrMode
      : recordOrMode?.supportMode || (recordOrMode?.highRisk ? 'manual_only_high_risk' : 'recognition_only');
  const normalAutomationAllowed = supportMode === 'full_support';
  return {
    supportMode,
    normalAutomationAllowed,
    activationBlocked: !normalAutomationAllowed,
    message: SUPPORT_MODE_MESSAGES[supportMode] || SUPPORT_MODE_MESSAGES.recognition_only,
  };
}

const commonIndianMedicines = {
  length: manifest.records,
  source: manifest.source,
};

module.exports = {
  commonIndianMedicines,
  findIndianMedicine,
  getSupportModeSafety,
  parseIndianMedicineEntry,
  searchIndianMedicines,
  suggestOcrMedicineCorrections,
  SUPPORT_MODE_MESSAGES,
};
