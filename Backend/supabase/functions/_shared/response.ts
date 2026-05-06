export function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export function errorResponse(status: number, message: string, details?: unknown) {
  return jsonResponse(status, {
    success: false,
    error: message,
    details: details ?? null,
  });
}

export const swasthiTrustMetadata = {
  trust_rules: {
    no_diagnosis: "Swasthi does not diagnose medical conditions.",
    no_doctor_replacement: "Swasthi does not replace doctors or licensed pharmacists.",
    verification_required:
      "Prescription shorthand explanations and OCR interpretations require human verification.",
  },
  privacy_note: "Healthcare data is privacy-sensitive and access is protected by RLS.",
};
