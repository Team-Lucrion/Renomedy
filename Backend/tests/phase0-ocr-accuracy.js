const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const { DirectGeminiOcrProvider } = require("../dist/services/ocr/direct-gemini-ocr.provider.js");
const { TesseractGroqOcrProvider } = require("../dist/services/ocr/tesseract-groq-ocr.provider.js");
const { VisionGeminiOcrProvider } = require("../dist/services/ocr/vision-gemini-ocr.provider.js");

const OUT_DIR = path.resolve(__dirname, "phase0-artifacts");
const IMAGE_DIR = path.join(OUT_DIR, "synthetic-prescriptions");
const RESULTS_PATH = path.join(OUT_DIR, "ocr-phase0-results.json");
const REPORT_PATH = path.join(OUT_DIR, "ocr-phase0-report.md");

const MEDICINES = [
  ["Dolo", "650mg", "1 tablet", "BD", "morning and night", "after food", "5 days"],
  ["Azithral", "500mg", "1 tablet", "OD", "morning", "after food", "3 days"],
  ["Pan", "40mg", "1 tablet", "OD", "morning", "before food", "10 days"],
  ["Azee", "250mg", "1 tablet", "OD", "night", "after food", "5 days"],
  ["Allegra", "120mg", "1 tablet", "OD", "night", "after food", "7 days"],
  ["Calpol", "500mg", "1 tablet", "SOS", "as needed", "after food", "3 days"],
  ["Shelcal", "500mg", "1 tablet", "OD", "morning", "after food", "30 days"],
  ["Telma", "40mg", "1 tablet", "OD", "morning", "after food", "30 days"],
  ["Metformin", "500mg", "1 tablet", "BD", "morning and night", "after food", "30 days"],
  ["Atorva", "10mg", "1 tablet", "HS", "bedtime", "after food", "30 days"],
  ["Augmentin", "625mg", "1 tablet", "BD", "morning and night", "after food", "5 days"],
  ["Montair", "10mg", "1 tablet", "OD", "night", "after food", "14 days"],
  ["Cetzine", "10mg", "1 tablet", "OD", "night", "after food", "5 days"],
  ["Rantac", "150mg", "1 tablet", "BD", "morning and night", "before food", "7 days"],
  ["Ecosprin", "75mg", "1 tablet", "OD", "night", "after food", "30 days"]
];

function usage() {
  console.log("Usage: node tests/phase0-ocr-accuracy.js [--providers=direct_gemini,tesseract_groq,vision_gemini] [--limit=50]");
}

function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sampleFor(index) {
  const kind = index < 25 ? "printed" : "handwritten";
  const [medicineName, strength, dose, frequency, timing, foodTiming, duration] = MEDICINES[index % MEDICINES.length];
  return {
    id: `rx-${String(index + 1).padStart(2, "0")}`,
    kind,
    expected: { medicineName, strength, dose, frequency, timing, foodTiming, duration }
  };
}

function makeSvg(sample) {
  const e = sample.expected;
  const isHand = sample.kind === "handwritten";
  const font = isHand ? "'Segoe Print', 'Comic Sans MS', cursive" : "Arial, sans-serif";
  const fill = isHand ? "#253247" : "#172033";
  const lines = isHand
    ? [
        "Rx",
        `${e.medicineName} ${e.strength}`,
        `${e.dose.replace("tablet", "tab")} ${e.frequency}`,
        `${e.timing} ${e.foodTiming === "after food" ? "PC" : "AC"}`,
        `x ${e.duration}`
      ]
    : [
        "Swasthi Clinic",
        "Prescription",
        `Medicine: ${e.medicineName}`,
        `Strength: ${e.strength}`,
        `Dose: ${e.dose}`,
        `Frequency: ${e.frequency}`,
        `Timing: ${e.timing}`,
        `Food: ${e.foodTiming}`,
        `Duration: ${e.duration}`
      ];
  const baseY = isHand ? 145 : 110;
  const gap = isHand ? 94 : 72;
  const text = lines
    .map((line, lineIndex) => {
      const x = isHand ? 145 + ((lineIndex % 2) * 18) : 115;
      const y = baseY + lineIndex * gap;
      const rotate = isHand ? (lineIndex % 2 === 0 ? -1.4 : 1.1) : 0;
      const size = isHand ? (lineIndex === 0 ? 72 : 58) : lineIndex < 2 ? 46 : 38;
      return `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})" font-family="${font}" font-size="${size}" fill="${fill}">${xmlEscape(line)}</text>`;
    })
    .join("\n");
  return `
<svg width="1200" height="850" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="850" fill="#ffffff"/>
  <rect x="60" y="55" width="1080" height="735" rx="18" fill="#ffffff" stroke="#d8dee9" stroke-width="3"/>
  ${isHand ? '<path d="M125 225 C 340 210, 620 235, 850 220" fill="none" stroke="#edf2f7" stroke-width="3"/>' : ""}
  ${text}
</svg>`;
}

async function ensureImages(samples) {
  await fs.mkdir(IMAGE_DIR, { recursive: true });
  for (const sample of samples) {
    const filePath = path.join(IMAGE_DIR, `${sample.id}-${sample.kind}.jpg`);
    const svg = makeSvg(sample);
    await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toFile(filePath);
    sample.imagePath = filePath;
  }
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\btwice daily\b/g, "bd")
    .replace(/\bonce daily\b/g, "od")
    .replace(/\bthree times daily\b/g, "tds")
    .replace(/\bfour times daily\b/g, "qid")
    .replace(/\bat bedtime\b/g, "hs")
    .replace(/\bas needed\b/g, "sos")
    .replace(/\bbefore food\b/g, "ac")
    .replace(/\bafter food\b/g, "pc")
    .replace(/\btablet\b/g, "tab")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesAll(actual, expectedTokens) {
  const value = normalize(actual);
  return expectedTokens.every((token) => value.includes(normalize(token)));
}

function actualFields(result) {
  const med = Array.isArray(result.medications) ? result.medications[0] : null;
  return {
    medicineName: med?.medicineName || "",
    strength: med?.strength || med?.dosage || "",
    dose: med?.dose || med?.dosage || "",
    frequency: med?.frequency || med?.shorthandExplanation || "",
    timing: med?.timing || med?.instructions || "",
    foodTiming: [med?.foodTiming, med?.instructions, med?.shorthandExplanation].filter(Boolean).join(" "),
    duration: med?.duration || med?.instructions || "",
    confidenceScore: typeof med?.confidenceScore === "number" ? med.confidenceScore : null
  };
}

function scoreField(field, expected, actual) {
  if (field === "medicineName") return includesAll(actual, [expected.medicineName]);
  if (field === "strength") return includesAll(actual, [expected.strength.replace(/\s+/g, "")]);
  if (field === "dose") return includesAll(actual, [expected.dose]);
  if (field === "frequency") return includesAll(actual, [expected.frequency]);
  if (field === "timing") {
    if (["as needed", "bedtime", "immediately"].includes(String(expected.timing).toLowerCase())) {
      return includesAll(actual, [expected.timing]);
    }
    return expected.timing.split(/\s+and\s+|\s+/).filter((part) => !["and"].includes(part)).every((part) => includesAll(actual, [part]));
  }
  if (field === "foodTiming") return includesAll(actual, [expected.foodTiming === "after food" ? "PC" : "AC"]);
  if (field === "duration") return includesAll(actual, [expected.duration]);
  return false;
}

function makeProvider(name) {
  if (name === "direct_gemini") return new DirectGeminiOcrProvider();
  if (name === "tesseract_groq" || name === "prescripto_ai") return new TesseractGroqOcrProvider();
  if (name === "vision_gemini") return new VisionGeminiOcrProvider();
  throw new Error(`Unknown provider: ${name}`);
}

async function runProvider(providerName, samples) {
  const provider = makeProvider(providerName);
  const rows = [];
  for (const sample of samples) {
    const buffer = await fs.readFile(sample.imagePath);
    const startedAt = Date.now();
    let result;
    let error = null;
    try {
      result = await provider.parsePrescription(buffer);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      result = { parseStatus: "failed", medications: [], providerMetadata: { error } };
    }
    const actual = actualFields(result);
    for (const field of ["medicineName", "strength", "dose", "frequency", "timing", "foodTiming", "duration"]) {
      rows.push({
        provider: providerName,
        sampleId: sample.id,
        kind: sample.kind,
        field,
        expected: sample.expected[field],
        actual: actual[field],
        correct: scoreField(field, sample.expected, actual[field]),
        confidenceScore: actual.confidenceScore,
        parseStatus: result.parseStatus,
        elapsedMs: Date.now() - startedAt,
        error: error || result.providerMetadata?.error || "",
        cleanedTextPreview: String(result.cleanedText || result.rawText || "").slice(0, 500),
        rawModelResponsePreview: String(result.rawModelResponse || "").slice(0, 1000),
        providerMetadata: result.providerMetadata || {}
      });
    }
    console.log(`${providerName} ${sample.id} ${sample.kind} ${result.parseStatus}`);
  }
  return rows;
}

function summarize(rows) {
  const groups = {};
  for (const row of rows) {
    for (const key of [`${row.provider}|${row.kind}|all`, `${row.provider}|all|${row.field}`, `${row.provider}|${row.kind}|${row.field}`]) {
      groups[key] ||= { total: 0, correct: 0 };
      groups[key].total += 1;
      groups[key].correct += row.correct ? 1 : 0;
    }
  }
  return Object.fromEntries(
    Object.entries(groups).map(([key, value]) => [
      key,
      {
        total: value.total,
        correct: value.correct,
        accuracy: Number((value.correct / Math.max(value.total, 1)).toFixed(4))
      }
    ])
  );
}

function phi(value) {
  const valid = value.filter((item) => item.confidenceScore !== null);
  if (valid.length < 2) return null;
  const meanX = valid.reduce((sum, item) => sum + item.confidenceScore, 0) / valid.length;
  const meanY = valid.reduce((sum, item) => sum + (item.correct ? 1 : 0), 0) / valid.length;
  let numerator = 0;
  let dx = 0;
  let dy = 0;
  for (const item of valid) {
    const x = item.confidenceScore - meanX;
    const y = (item.correct ? 1 : 0) - meanY;
    numerator += x * y;
    dx += x * x;
    dy += y * y;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? null : Number((numerator / denom).toFixed(4));
}

function makeMarkdown(samples, providers, rows, summary) {
  const lines = [];
  lines.push("# Phase 0 OCR Accuracy Test Results");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Test Set");
  lines.push("");
  lines.push(`- Total prescriptions: ${samples.length}`);
  lines.push(`- Printed / typed prescriptions: ${samples.filter((sample) => sample.kind === "printed").length}`);
  lines.push(`- Synthetic handwritten-style prescriptions: ${samples.filter((sample) => sample.kind === "handwritten").length}`);
  lines.push("- Fields scored per prescription: medicine name, strength, dose, frequency, timing, food timing, duration");
  lines.push("");
  lines.push("## Backends Tested");
  lines.push("");
  for (const provider of providers) lines.push(`- ${provider}`);
  lines.push("");
  lines.push("## Accuracy Summary");
  lines.push("");
  lines.push("| Backend | Printed field accuracy | Handwritten field accuracy |");
  lines.push("|---|---:|---:|");
  for (const provider of providers) {
    const printed = summary[`${provider}|printed|all`]?.accuracy ?? 0;
    const hand = summary[`${provider}|handwritten|all`]?.accuracy ?? 0;
    lines.push(`| ${provider} | ${(printed * 100).toFixed(1)}% | ${(hand * 100).toFixed(1)}% |`);
  }
  lines.push("");
  lines.push("## Per-Field Accuracy");
  lines.push("");
  lines.push("| Backend | Field | Accuracy |");
  lines.push("|---|---|---:|");
  for (const provider of providers) {
    for (const field of ["medicineName", "strength", "dose", "frequency", "timing", "foodTiming", "duration"]) {
      const item = summary[`${provider}|all|${field}`];
      lines.push(`| ${provider} | ${field} | ${(((item?.accuracy ?? 0) * 100)).toFixed(1)}% |`);
    }
  }
  lines.push("");
  lines.push("## Confidence Correlation");
  lines.push("");
  for (const provider of providers) {
    const corr = phi(rows.filter((row) => row.provider === provider));
    lines.push(`- ${provider}: ${corr === null ? "not available" : corr}`);
  }
  lines.push("");
  lines.push("## Raw Results");
  lines.push("");
  lines.push(`Machine-readable results: ${path.relative(path.dirname(REPORT_PATH), RESULTS_PATH).replace(/\\/g, "/")}`);
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- This test set is synthetic and anonymized; it contains no real patient data.");
  lines.push("- The handwriting subset is handwritten-style rendered text, not real doctor handwriting.");
  lines.push("- Confidence is provider-level medicine confidence, because the current backend model does not expose independent confidence for every field.");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  if (process.argv.includes("--help")) {
    usage();
    return;
  }
  const providers = getArg("providers", "direct_gemini,tesseract_groq")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const limit = Math.max(1, Math.min(50, Number(getArg("limit", "50")) || 50));
  const samples = Array.from({ length: 50 }, (_, index) => sampleFor(index)).slice(0, limit);

  await fs.mkdir(OUT_DIR, { recursive: true });
  await ensureImages(samples);

  const rows = [];
  for (const provider of providers) {
    rows.push(...await runProvider(provider, samples));
  }
  const summary = summarize(rows);
  const output = {
    generatedAt: new Date().toISOString(),
    providers,
    samples: samples.map((sample) => ({
      id: sample.id,
      kind: sample.kind,
      expected: sample.expected,
      imagePath: path.relative(OUT_DIR, sample.imagePath).replace(/\\/g, "/")
    })),
    summary,
    rows
  };
  await fs.writeFile(RESULTS_PATH, JSON.stringify(output, null, 2));
  await fs.writeFile(REPORT_PATH, makeMarkdown(samples, providers, rows, summary));
  console.log(`Wrote ${RESULTS_PATH}`);
  console.log(`Wrote ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
