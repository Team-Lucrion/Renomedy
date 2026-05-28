const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const csvPath = path.join(repoRoot, 'swasthi_beta_intelligence_v2.csv');
const outputDir = path.join(__dirname, '..', 'src', 'data', 'medicineIndex');
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

function parseCsvLine(line) {
  const values = [];
  let current = '';
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

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function parseList(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '[]') return [];
  const matches = [...raw.matchAll(/'([^']*)'/g)].map((match) => match[1].trim()).filter(Boolean);
  if (matches.length > 0) return matches;
  return raw
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+/.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function shardKeyFor(value) {
  const compact = compactText(value);
  if (compact.length < 2) return null;
  return compact.slice(0, Math.min(3, compact.length));
}

function collectShardKeys(record) {
  const keys = new Set();
  const values = [
    record.brandName,
    record.genericName,
    record.strength,
    ...record.aliases,
    ...record.searchTokens,
    ...record.commonOCRMistakes,
  ];

  for (const value of values) {
    const normalized = normalizeText(value);
    const phraseKey = shardKeyFor(normalized);
    if (phraseKey) keys.add(phraseKey);

    for (const token of normalized.split(' ').filter((item) => item && !STOP_INDEX_TOKENS.has(item))) {
      const tokenKey = shardKeyFor(token);
      if (tokenKey) keys.add(tokenKey);
    }

    for (const molecule of normalized.split('+')) {
      const key = shardKeyFor(molecule);
      if (key) keys.add(key);
    }

    const compactKey = shardKeyFor(compactText(value));
    if (compactKey) keys.add(compactKey);
  }

  return keys;
}

function toBoolean(value) {
  return String(value || '').toLowerCase() === 'true';
}

function toRecord(headers, values) {
  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  return {
    id: row.id,
    brandName: row.brandName,
    genericName: row.genericName,
    strength: row.strength,
    form: row.form,
    supportMode: row.supportMode,
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

function writeShard(key, records) {
  const filePath = path.join(outputDir, `shard-${key}.js`);
  const compactRecords = records.map((record) => ({
    id: record.id,
    b: record.brandName,
    g: record.genericName,
    s: record.strength,
    f: record.form,
    c: record.category,
    mt: record.medicineType,
    sm: record.supportMode,
    hr: record.highRisk ? 1 : 0,
    rmv: record.requiresManualVerification ? 1 : 0,
    beta: record.isBetaSupported ? 1 : 0,
    ps: record.indiaPriorityScore,
    a: record.aliases,
    t: record.searchTokens,
    o: record.commonOCRMistakes,
  }));

  fs.writeFileSync(
    filePath,
    `module.exports = ${JSON.stringify(compactRecords)};\n`,
    'utf8',
  );
}

if (!fs.existsSync(csvPath)) {
  throw new Error(`Catalog CSV not found: ${csvPath}`);
}

fs.mkdirSync(outputDir, { recursive: true });

for (const file of fs.readdirSync(outputDir)) {
  if (/^shard-[a-z0-9]{1,3}\.js$/.test(file) || file === 'loaders.js') {
    fs.unlinkSync(path.join(outputDir, file));
  }
}

const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(Boolean);
const headers = parseCsvLine(lines[0]);
const shards = new Map();
const seenIds = new Set();

for (const line of lines.slice(1)) {
  const values = parseCsvLine(line);
  const record = toRecord(headers, values);

  if (!record.id || seenIds.has(record.id)) continue;
  seenIds.add(record.id);

  for (const key of collectShardKeys(record)) {
    if (!shards.has(key)) shards.set(key, []);
    shards.get(key).push(record);
  }
}

for (const [key, records] of [...shards.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  writeShard(key, records);
}

const manifest = {
  source: 'swasthi_beta_intelligence_v2.csv',
  records: seenIds.size,
  indexVersion: 2,
  shardStrategy: 'three-character token prefix shards with lazy static loaders',
  shards: [...shards.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, records]) => ({ key, records: records.length })),
};

fs.writeFileSync(
  path.join(outputDir, 'manifest.js'),
  `module.exports = ${JSON.stringify(manifest, null, 2)};\n`,
  'utf8',
);

fs.writeFileSync(
  path.join(outputDir, 'loaders.js'),
  `module.exports = {\n${manifest.shards
    .map((shard) => `  ${JSON.stringify(shard.key)}: () => require('./shard-${shard.key}')`)
    .join(',\n')}\n};\n`,
  'utf8',
);

console.log(`Built ${manifest.records} medicine records into ${manifest.shards.length} lazy shards.`);
