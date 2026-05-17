import { supabaseAdmin, getUserSupabaseClient } from "../lib/supabase";
import { HttpError } from "../utils/http-error";

type JwtPayload = {
  sub?: string;
  email?: string;
  phone_number?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  preferred_language?: string;
  public_metadata?: {
    role?: "self" | "caregiver";
    preferred_language?: string;
  };
};

function decodeJwtPayload(token: string): JwtPayload {
  try {
    const [, payload = ""] = token.split(".");
    const json = Buffer.from(payload, "base64url").toString("utf8");
    return JSON.parse(json) as JwtPayload;
  } catch {
    return {};
  }
}

function deriveFullName(payload: JwtPayload) {
  const explicitName = payload.name?.trim();
  if (explicitName) return explicitName;

  const joined = [payload.given_name, payload.family_name].filter(Boolean).join(" ").trim();
  return joined || null;
}

async function ensureCurrentUserExists(jwt: string) {
  const payload = decodeJwtPayload(jwt);
  if (!payload.sub) {
    throw new HttpError(401, "Authenticated user record not found");
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .upsert(
      {
        clerk_user_id: payload.sub,
        email: payload.email ?? null,
        phone: payload.phone_number ?? null,
        full_name: deriveFullName(payload),
        role: payload.public_metadata?.role ?? "caregiver",
        preferred_language: payload.public_metadata?.preferred_language ?? payload.preferred_language ?? "en"
      },
      { onConflict: "clerk_user_id" }
    )
    .select("id, clerk_user_id, full_name, role, beta_access_status, beta_invite_id, beta_access_approved")
    .single();

  if (error || !data) {
    throw new HttpError(500, "Failed to provision authenticated user", error);
  }

  return data;
}

export async function getCurrentUserRecord(jwt: string) {
  const sb = getUserSupabaseClient(jwt);
  const { data, error } = await sb
    .from("users")
    .select("id, clerk_user_id, full_name, role, beta_access_status, beta_invite_id, beta_access_approved")
    .single();
  if (!error && data) return data;
  return ensureCurrentUserExists(jwt);
}
