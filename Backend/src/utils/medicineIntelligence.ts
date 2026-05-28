import fs from "node:fs";
import path from "node:path";

export type MedicineSupportMode =
  | "full_support"
  | "recognition_only"
  | "manual_only"
  | "manual_only_high_risk"
  | "blocked";

export type MedicineCatalogMatch = {
  id: string;
  brandName: string;
  genericName: string;
  strength: string;
  form: string;
  category: string;
  medicineType: string;
  supportMode: MedicineSupportMode;
  highRisk: boolean;
  requiresManualVerification: boolean;
  isBetaSupported: boolean;
  indiaPriorityScore: number;
  aliases: string[];
  searchTokens: string[];
  commonOCRMistakes: string[];
};

export const MANUAL_HIGH_RISK_MESSAGE =
  "This medicine requires careful manual management. Please verify timing and dosage directly with your doctor or pharmacist.";

export const BLOCKED_MEDICINE_MESSAGE =
  "This medicine needs more careful management than Swasthi currently supports. Please manage it directly with your doctor or pharmacist.";

const SUPPORT_MODE_MESSAGES: Record<MedicineSupportMode, string> = {
  full_support: "",
  recognition_only:
    "This medicine can be recognized and stored, but automated refill or long-term adherence assumptions are not enabled by default.",
  manual_only:
    "This medicine can be saved only after manual verification. Swasthi will not infer its schedule automatically.",
  manual_only_high_risk: MANUAL_HIGH_RISK_MESSAGE,
  blocked: BLOCKED_MEDICINE_MESSAGE,
};

let headersCache: string[] | null = null;
const shardCache = new Map<string, MedicineCatalogMatch[]>();
let generatedShardLoaders: Record<string, () => any[]> | null | undefined;
const STOP_INDEX_TOKENS = new Set([
  "cap",
  "capsule",
  "capsules",
  "cream",
  "drop",
  "drops",
  "gel",
  "gm",
  "g",
  "injection",
  "iu",
  "mcg",
  "mg",
  "ml",
  "ointment",
  "oral",
  "solution",
  "suspension",
  "syrup",
  "tab",
  "tablet",
  "tablets",
]);

function catalogCsvPath() {
  return (
    process.env.MEDICINE_INTELLIGENCE_CSV_PATH ||
    path.resolve(__dirname, "..", "..", "..", "swasthi_beta_intelligence_v2.csv")
  );
}

function generatedIndexLoadersPath() {
  return path.resolve(__dirname, "..", "..", "..", "Frontend", "src", "data", "medicineIndex", "loaders.js");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseList(value: string) {
  const raw = String(value || "").trim();
  if (!raw || raw === "[]") return [];
  const matches = [...raw.matchAll(/'([^']*)'/g)].map((match) => match[1].trim()).filter(Boolean);
  if (matches.length > 0) return matches;
  return raw
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9+/.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSearchText(value: unknown) {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, "");
}

function splitSearchTokens(value: unknown) {
  return normalizeSearchText(value).split(" ").filter(Boolean);
}

function shardKeyFor(value: unknown) {
  const compact = compactSearchText(value);
  if (compact.length < 2) return null;
  return compact.slice(0, Math.min(3, compact.length));
}

function toBoolean(value: string) {
  return String(value || "").toLowerCase() === "true";
}

function toRecord(headers: string[], values: string[]): MedicineCatalogMatch {
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  return {
    id: row.id,
    brandName: row.brandName,
    genericName: row.genericName,
    strength: row.strength,
    form: row.form,
    supportMode: (row.supportMode || "recognition_only") as MedicineSupportMode,
    highRisk: toBoolean(row.highRisk),
    requiresManualVerification: toBoolean(row.requiresManualVerification),
    isBetaSupported: toBoolean(row.isBetaSupported),
    searchTokens: parseList(row.searchTokens),
    commonOCRMistakes: parseList(row.commonOCRMistakes),
    indiaPriorityScore: Number(row.indiaPriorityScore || 0),
    aliases: parseList(row.aliases),
    category: row.category,
    medicineType: row.medicineType,
  };
}

function expandGeneratedRecord(record: any): MedicineCatalogMatch {
  if (record.brandName) return record as MedicineCatalogMatch;
  return {
    id: record.id,
    brandName: record.b,
    genericName: record.g,
    strength: record.s,
    form: record.f,
    category: record.c,
    medicineType: record.mt,
    supportMode: (record.sm || "recognition_only") as MedicineSupportMode,
    highRisk: Boolean(record.hr),
    requiresManualVerification: Boolean(record.rmv),
    isBetaSupported: Boolean(record.beta),
    indiaPriorityScore: Number(record.ps || 0),
    aliases: record.a || [],
    searchTokens: record.t || [],
    commonOCRMistakes: record.o || [],
  };
}

function getGeneratedShardLoaders() {
  if (generatedShardLoaders !== undefined) {
    return generatedShardLoaders;
  }

  const loadersPath = generatedIndexLoadersPath();
  if (!fs.existsSync(loadersPath)) {
    generatedShardLoaders = null;
    return generatedShardLoaders;
  }

  // The frontend offline catalog index is generated from the same finalized CSV.
  // Use it server-side when present so activation safety lookup stays indexed.
  generatedShardLoaders = require(loadersPath) as Record<string, () => any[]>;
  return generatedShardLoaders;
}

function recordShardKeys(record: MedicineCatalogMatch) {
  const keys = new Set<string>();
  const values = [
    record.brandName,
    record.genericName,
    record.strength,
    ...record.aliases,
    ...record.searchTokens,
    ...record.commonOCRMistakes,
  ];

  for (const value of values) {
    const normalized = normalizeSearchText(value);
    const phraseKey = shardKeyFor(normalized);
    if (phraseKey) keys.add(phraseKey);

    for (const token of normalized.split(" ").filter((item) => item && !STOP_INDEX_TOKENS.has(item))) {
      const tokenKey = shardKeyFor(token);
      if (tokenKey) keys.add(tokenKey);
    }

    for (const molecule of normalized.split("+")) {
      const key = shardKeyFor(molecule);
      if (key) keys.add(key);
    }

    const compactKey = shardKeyFor(compactSearchText(value));
    if (compactKey) keys.add(compactKey);
  }

  return keys;
}

function parseQuery(value: string) {
  const normalized = normalizeSearchText(value);
  const strengthMatch = normalized.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s*(mg|mcg|g|iu|iu\/ml))?(?:\s|$)/i);
  const nameOnly = strengthMatch
    ? normalized.replace(strengthMatch[0], " ").replace(/\s+/g, " ").trim()
    : normalized;

  return {
    normalized,
    nameOnly,
    compact: compactSearchText(value),
    tokens: splitSearchTokens(nameOnly || normalized),
  };
}

function getQueryKeys(query: ReturnType<typeof parseQuery>) {
  const keys = new Set<string>();
  for (const token of query.tokens) {
    if (STOP_INDEX_TOKENS.has(token)) continue;
    const key = shardKeyFor(token);
    if (key) keys.add(key);
  }
  const compactKey = shardKeyFor(query.compact);
  if (compactKey) keys.add(compactKey);
  return [...keys];
}

function loadShard(key: string) {
  if (shardCache.has(key)) {
    return shardCache.get(key)!;
  }

  const generatedLoaders = getGeneratedShardLoaders();
  const generatedLoader = generatedLoaders?.[key];
  if (generatedLoader) {
    const records = generatedLoader().map(expandGeneratedRecord);
    shardCache.set(key, records);
    return records;
  }

  const csv = catalogCsvPath();
  if (!fs.existsSync(csv)) {
    shardCache.set(key, []);
    return [];
  }

  const lines = fs.readFileSync(csv, "utf8").split(/\r?\n/).filter(Boolean);
  const headers = headersCache ?? parseCsvLine(lines[0]);
  headersCache = headers;
  const records: MedicineCatalogMatch[] = [];

  for (const line of lines.slice(1)) {
    const record = toRecord(headers, parseCsvLine(line));
    if (recordShardKeys(record).has(key)) {
      records.push(record);
    }
  }

  shardCache.set(key, records);
  return records;
}

function getRecordSearchPhrases(record: MedicineCatalogMatch) {
  return [
    record.brandName,
    record.genericName,
    record.strength,
    ...record.aliases,
    ...record.searchTokens,
  ].filter(Boolean);
}

function getRecordOcrPhrases(record: MedicineCatalogMatch) {
  return [
    record.brandName,
    record.genericName,
    ...record.aliases,
    ...record.searchTokens,
    ...record.commonOCRMistakes,
  ].filter(Boolean);
}

function phraseMatchesQuery(phrase: string, query: ReturnType<typeof parseQuery>) {
  const normalizedPhrase = normalizeSearchText(phrase);
  const compactPhrase = compactSearchText(phrase);
  const normalizedQuery = query.nameOnly || query.normalized;
  const compactQuery = compactSearchText(normalizedQuery);

  if (!normalizedQuery || normalizedQuery.length < 2) return false;
  if (normalizedPhrase === normalizedQuery || compactPhrase === compactQuery) return true;
  if (normalizedPhrase.startsWith(`${normalizedQuery} `) || compactPhrase.startsWith(compactQuery)) return true;

  const phraseTokens = splitSearchTokens(phrase);
  return query.tokens.every((queryToken) =>
    phraseTokens.some((phraseToken) => phraseToken === queryToken || phraseToken.startsWith(queryToken))
  );
}

function recordMatchesQuery(record: MedicineCatalogMatch, query: ReturnType<typeof parseQuery>) {
  return getRecordSearchPhrases(record).some((phrase) => phraseMatchesQuery(phrase, query));
}

function recordMatchesOcrCorrection(record: MedicineCatalogMatch, query: ReturnType<typeof parseQuery>) {
  return getRecordOcrPhrases(record).some((phrase) => phraseMatchesQuery(phrase, query));
}

function levenshteinDistance(left: unknown, right: unknown) {
  const a = compactSearchText(left);
  const b = compactSearchText(right);
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_unused, index) => index);
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

function getOcrCorrectionDistance(record: MedicineCatalogMatch, query: ReturnType<typeof parseQuery>) {
  const normalizedQuery = query.nameOnly || query.normalized;
  const phrases = [
    record.brandName,
    record.genericName,
    ...record.aliases,
    ...record.searchTokens,
  ].filter(Boolean);
  const candidates: string[] = [];

  for (const phrase of phrases) {
    const normalized = normalizeSearchText(phrase);
    candidates.push(normalized);
    candidates.push(...normalized.split(" ").filter((token) => token.length >= 2));
  }

  return candidates.reduce((best, candidate) => Math.min(best, levenshteinDistance(normalizedQuery, candidate)), 999);
}

function isExactBrandMatch(record: MedicineCatalogMatch, query: ReturnType<typeof parseQuery>) {
  const normalizedBrand = normalizeSearchText(record.brandName);
  const compactBrand = compactSearchText(record.brandName);
  const queries = [query.normalized, query.nameOnly].filter(Boolean);
  return (
    queries.some((candidate) =>
      normalizedBrand === candidate ||
      normalizedBrand.startsWith(`${candidate} `) ||
      compactBrand === compactSearchText(candidate) ||
      compactBrand.startsWith(compactSearchText(candidate))
    )
  );
}

function normalizeStrengthToken(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/microgram|mcgs?/g, "mcg");
}

function queryStrengthToken(query: ReturnType<typeof parseQuery>) {
  const strengthMatch = query.normalized.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s*(mg|mcg|g|iu|iu\/ml))?(?:\s|$)/i);
  if (!strengthMatch) return "";
  return normalizeStrengthToken(`${strengthMatch[1]} ${strengthMatch[2] || (/thyro|eltroxin|thyrox/.test(query.normalized) ? "mcg" : "mg")}`);
}

function hasRequestedStrength(record: MedicineCatalogMatch, query: ReturnType<typeof parseQuery>) {
  const strengthToken = queryStrengthToken(query);
  return Boolean(strengthToken && normalizeStrengthToken(record.strength) === strengthToken);
}

export function findMedicineCatalogMatch(input: {
  medicine_name?: unknown;
  medicineName?: unknown;
  brand_name?: unknown;
  brandName?: unknown;
  generic_name?: unknown;
  genericName?: unknown;
}) {
  const rawQuery =
    normalizeSearchText(input.brand_name ?? input.brandName) ||
    normalizeSearchText(input.medicine_name ?? input.medicineName) ||
    normalizeSearchText(input.generic_name ?? input.genericName);

  if (rawQuery.length < 2) {
    return null;
  }

  const query = parseQuery(rawQuery);
  const seen = new Set<string>();
  const candidates: MedicineCatalogMatch[] = [];

  for (const key of getQueryKeys(query)) {
    for (const record of loadShard(key)) {
      if (seen.has(record.id)) continue;
      seen.add(record.id);
      if (recordMatchesQuery(record, query)) {
        candidates.push(record);
      }
    }
  }

  return candidates.sort((left, right) => {
    const exactLeft = isExactBrandMatch(left, query) ? 0 : 1;
    const exactRight = isExactBrandMatch(right, query) ? 0 : 1;
      return (
        exactLeft - exactRight ||
        Number(hasRequestedStrength(right, query)) - Number(hasRequestedStrength(left, query)) ||
        Number(right.indiaPriorityScore || 0) - Number(left.indiaPriorityScore || 0) ||
        left.brandName.localeCompare(right.brandName)
      );
  })[0] ?? null;
}

export function findMedicineCatalogCorrectionCandidates(input: string, limit = 5) {
  const rawQuery = normalizeSearchText(input);
  if (rawQuery.length < 2) {
    return [];
  }

  const query = parseQuery(rawQuery);
  const seen = new Set<string>();
  const candidates: MedicineCatalogMatch[] = [];

  for (const key of getQueryKeys(query)) {
    for (const record of loadShard(key)) {
      if (seen.has(record.id)) continue;
      seen.add(record.id);
      if (recordMatchesOcrCorrection(record, query)) {
        candidates.push(record);
      }
    }
  }

  return candidates
    .sort((left, right) => {
      const exactLeft = isExactBrandMatch(left, query) ? 0 : 1;
      const exactRight = isExactBrandMatch(right, query) ? 0 : 1;
      return (
        exactLeft - exactRight ||
        Number(hasRequestedStrength(right, query)) - Number(hasRequestedStrength(left, query)) ||
        getOcrCorrectionDistance(left, query) - getOcrCorrectionDistance(right, query) ||
        Number(right.indiaPriorityScore || 0) - Number(left.indiaPriorityScore || 0) ||
        left.brandName.localeCompare(right.brandName)
      );
    })
    .slice(0, limit);
}

export function getMedicineSupportSafety(match: MedicineCatalogMatch | null) {
  const supportMode = match?.supportMode ?? "recognition_only";
  return {
    supportMode,
    normalAutomationAllowed: supportMode === "full_support",
    message: SUPPORT_MODE_MESSAGES[supportMode],
  };
}

export function isInsulinOrInjectableDiabetesMedicine(match: MedicineCatalogMatch | null, fallback: Record<string, unknown>) {
  const text = normalizeSearchText([
    match?.brandName,
    match?.genericName,
    match?.form,
    match?.category,
    match?.medicineType,
    fallback.medicine_name,
    fallback.brand_name,
    fallback.generic_name,
    fallback.instructions,
  ].filter(Boolean).join(" "));
  return /insulin|injectable diabetes|injection/.test(text) && /insulin|diabetes/.test(text);
}
