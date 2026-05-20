import fs from "node:fs";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { cleanOcrText } from "./gemini-prescription-parse";

const VISION_SCOPE = "https://www.googleapis.com/auth/cloud-vision";
const VISION_ANNOTATE_URL = "https://vision.googleapis.com/v1/images:annotate";
const BACKEND_ROOT = path.resolve(__dirname, "../../..");

let cachedAuth: GoogleAuth | null = null;
let cachedCredentialSource: VisionCredentialSource | null = null;

type VisionServiceAccount = Record<string, unknown> & {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

type VisionCredentialSource = {
  source: "GOOGLE_VISION_SERVICE_ACCOUNT_JSON" | "GOOGLE_APPLICATION_CREDENTIALS";
  resolvedPath?: string;
  credentials: VisionServiceAccount;
};

export function normalizeGoogleVisionPrivateKey(privateKey: unknown) {
  if (typeof privateKey !== "string") {
    return undefined;
  }

  return privateKey.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trimEnd();
}

function maskEmail(value?: string) {
  if (!value || !value.includes("@")) {
    return value ?? null;
  }

  const [localPart, domain] = value.split("@");
  const visiblePrefix = localPart.slice(0, 2);
  return `${visiblePrefix}***@${domain}`;
}

function parseServiceAccountJson(rawJson: string, sourceLabel: string): VisionServiceAccount {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error(`${sourceLabel} is not valid JSON`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${sourceLabel} must be a JSON object`);
  }

  const credentials = parsed as VisionServiceAccount;
  credentials.private_key = normalizeGoogleVisionPrivateKey(credentials.private_key);
  credentials.client_email = typeof credentials.client_email === "string" ? credentials.client_email.trim() : undefined;
  credentials.project_id = typeof credentials.project_id === "string" ? credentials.project_id.trim() : undefined;

  if (!credentials.client_email) {
    throw new Error(`${sourceLabel} is missing client_email`);
  }

  if (!credentials.private_key) {
    throw new Error(`${sourceLabel} is missing private_key`);
  }

  return credentials;
}

export function resolveGoogleVisionCredentialsPath(inputPath: string) {
  const trimmed = inputPath.trim();
  if (!trimmed) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is empty");
  }

  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }

  const cwdResolved = path.resolve(process.cwd(), trimmed);
  if (fs.existsSync(cwdResolved)) {
    return cwdResolved;
  }

  const backendResolved = path.resolve(BACKEND_ROOT, trimmed);
  if (fs.existsSync(backendResolved)) {
    return backendResolved;
  }

  return backendResolved;
}

function loadVisionCredentialSource(): VisionCredentialSource {
  const json = env.GOOGLE_VISION_SERVICE_ACCOUNT_JSON?.trim();
  const keyFile = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  if (json) {
    return {
      source: "GOOGLE_VISION_SERVICE_ACCOUNT_JSON",
      credentials: parseServiceAccountJson(json, "GOOGLE_VISION_SERVICE_ACCOUNT_JSON")
    };
  }

  if (keyFile) {
    const resolvedPath = resolveGoogleVisionCredentialsPath(keyFile);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`GOOGLE_APPLICATION_CREDENTIALS file was not found at ${resolvedPath}`);
    }

    const rawJson = fs.readFileSync(resolvedPath, "utf8");
    return {
      source: "GOOGLE_APPLICATION_CREDENTIALS",
      resolvedPath,
      credentials: parseServiceAccountJson(rawJson, "GOOGLE_APPLICATION_CREDENTIALS file")
    };
  }

  throw new Error(
    "Google Vision credentials are required: set GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON) or GOOGLE_VISION_SERVICE_ACCOUNT_JSON (inline JSON)."
  );
}

function getGoogleAuth(): GoogleAuth {
  if (cachedAuth) {
    return cachedAuth;
  }

  cachedCredentialSource = loadVisionCredentialSource();
  cachedAuth = new GoogleAuth({
    credentials: cachedCredentialSource.credentials,
    scopes: [VISION_SCOPE]
  });
  return cachedAuth;
}

async function getVisionAccessToken(): Promise<string> {
  const client = await getGoogleAuth().getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) {
    throw new Error("Google Vision: failed to obtain access token (check service account and Vision API enablement).");
  }
  return token;
}

export async function logGoogleVisionAuthDiagnostic() {
  if (env.OCR_PROVIDER !== "vision_gemini") {
    return;
  }

  try {
    const credentialSource = loadVisionCredentialSource();
    cachedCredentialSource = credentialSource;

    const privateKey = credentialSource.credentials.private_key ?? "";
    const token = await getVisionAccessToken();

    logger.info(
      {
        source: credentialSource.source,
        resolvedPath: credentialSource.resolvedPath ?? null,
        fileExists: credentialSource.resolvedPath ? fs.existsSync(credentialSource.resolvedPath) : null,
        projectId: credentialSource.credentials.project_id ?? null,
        clientEmail: maskEmail(credentialSource.credentials.client_email),
        privateKeyLineCount: typeof privateKey === "string" ? privateKey.split("\n").length : 0,
        hasEscapedNewlines: typeof privateKey === "string" ? privateKey.includes("\\n") : false,
        authCheck: "ok",
        accessTokenPresent: Boolean(token)
      },
      "Google Vision auth diagnostic"
    );
  } catch (error) {
    logger.error(
      {
        err: error,
        source: cachedCredentialSource?.source ?? null,
        resolvedPath: cachedCredentialSource?.resolvedPath ?? null,
        authCheck: "failed"
      },
      "Google Vision auth diagnostic failed"
    );
  }
}

type VisionAnnotateResponse = {
  responses?: Array<{
    fullTextAnnotation?: { text?: string };
    textAnnotations?: Array<{ description?: string }>;
    error?: { message?: string };
  }>;
  error?: { message?: string };
};

async function callVisionAnnotate(imageBase64: string, featureType: "DOCUMENT_TEXT_DETECTION" | "TEXT_DETECTION") {
  const token = await getVisionAccessToken();
  const response = await fetch(VISION_ANNOTATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          image: { content: imageBase64 },
          features: [{ type: featureType, maxResults: 1 }],
        },
      ],
    }),
  });

  const payload = (await response.json()) as VisionAnnotateResponse;
  if (!response.ok) {
    const msg = payload?.error?.message ?? response.statusText;
    throw new Error(`Google Vision API error (${response.status}): ${msg}`);
  }

  const first = payload.responses?.[0];
  if (first?.error?.message) {
    throw new Error(`Google Vision: ${first.error.message}`);
  }

  return first;
}

/**
 * Extract full document text using Google Cloud Vision (DOCUMENT_TEXT_DETECTION), with TEXT_DETECTION fallback.
 */
export async function extractTextWithGoogleVision(imageBuffer: Buffer): Promise<string> {
  const imageBase64 = imageBuffer.toString("base64");

  const doc = await callVisionAnnotate(imageBase64, "DOCUMENT_TEXT_DETECTION");
  const docText = doc?.fullTextAnnotation?.text;
  if (docText && docText.trim().length > 0) {
    return cleanOcrText(docText);
  }

  const text = await callVisionAnnotate(imageBase64, "TEXT_DETECTION");
  const fallback = text?.textAnnotations?.[0]?.description;
  return cleanOcrText(fallback ?? "");
}
