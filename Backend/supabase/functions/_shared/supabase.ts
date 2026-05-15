import { createClient } from "npm:@supabase/supabase-js@2";

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

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const defaultBucket = Deno.env.get("SUPABASE_STORAGE_BUCKET") ?? "prescriptions";

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Missing Supabase Edge Function environment variables");
}

export const storageBucket = defaultBucket;

export const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

export function jsonHeaders(extra?: HeadersInit) {
  return {
    "Content-Type": "application/json",
    ...extra
  };
}

export function getBearerToken(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  console.log("[edge-auth] authorization header present", Boolean(authHeader));
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing bearer token");
  }

  const jwt = authHeader.slice("Bearer ".length).trim();
  console.log("[edge-auth] bearer token present", Boolean(jwt));
  return jwt;
}

export function getUserClient(jwt: string) {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    }
  });
}

function decodeJwtPayload(jwt: string): JwtPayload {
  try {
    const [, payload = ""] = jwt.split(".");
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

function deriveFullName(payload: JwtPayload) {
  if (payload.name?.trim()) return payload.name.trim();
  const joined = [payload.given_name, payload.family_name].filter(Boolean).join(" ").trim();
  return joined || null;
}

export async function ensureCurrentUser(jwt: string) {
  const userClient = getUserClient(jwt);
  const { data, error } = await userClient
    .from("users")
    .select("id, clerk_user_id, role, beta_access_status, beta_invite_id")
    .single();
  if (!error && data) return data;

  const payload = decodeJwtPayload(jwt);
  if (!payload.sub) throw new Error("Authenticated user record not found");

  const { data: created, error: upsertError } = await adminClient
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
    .select("id, clerk_user_id, role, beta_access_status, beta_invite_id")
    .single();

  if (upsertError || !created) {
    throw new Error("Failed to provision authenticated user");
  }

  return created;
}

export async function ensureClosedBetaAccess(jwt: string) {
  const currentUser = await ensureCurrentUser(jwt);
  if (currentUser.beta_access_status !== "active") {
    throw new Error("Closed beta access is required");
  }

  return currentUser;
}

export async function writeAuditLog(input: {
  userId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await adminClient.from("audit_logs").insert({
    user_id: input.userId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {}
  });
}

export async function createSignedPrescriptionUrl(storagePath: string) {
  const { data, error } = await adminClient.storage.from(storageBucket).createSignedUrl(storagePath, 60 * 10);
  if (error || !data?.signedUrl) throw new Error("Failed to create signed prescription URL");
  return data.signedUrl;
}
