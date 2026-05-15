import { GoogleAuth } from "google-auth-library";
import { env } from "../../config/env";
import { cleanOcrText } from "./gemini-prescription-parse";

const VISION_SCOPE = "https://www.googleapis.com/auth/cloud-vision";
const VISION_ANNOTATE_URL = "https://vision.googleapis.com/v1/images:annotate";

let cachedAuth: GoogleAuth | null = null;

function getGoogleAuth(): GoogleAuth {
  if (cachedAuth) {
    return cachedAuth;
  }

  const json = env.GOOGLE_VISION_SERVICE_ACCOUNT_JSON?.trim();
  const keyFile = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();

  if (json) {
    try {
      cachedAuth = new GoogleAuth({
        credentials: JSON.parse(json) as Record<string, unknown>,
        scopes: [VISION_SCOPE],
      });
      return cachedAuth;
    } catch {
      throw new Error("GOOGLE_VISION_SERVICE_ACCOUNT_JSON is not valid JSON");
    }
  }

  if (keyFile) {
    cachedAuth = new GoogleAuth({
      keyFilename: keyFile,
      scopes: [VISION_SCOPE],
    });
    return cachedAuth;
  }

  throw new Error(
    "Google Vision credentials are required: set GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON) or GOOGLE_VISION_SERVICE_ACCOUNT_JSON (inline JSON)."
  );
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
