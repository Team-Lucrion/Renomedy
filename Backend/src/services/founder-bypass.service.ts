import { env } from "../config/env";
import { logger } from "../config/logger";
import { supabaseAdmin } from "../lib/supabase";
import { writeAuditLog } from "./audit.service";
import { HttpError } from "../utils/http-error";

type FounderBypassUser = {
  id: string;
  clerk_user_id?: string | null;
  phone?: string | null;
  beta_access_approved?: boolean | null;
  beta_access_status?: string | null;
};

function parseFounderBypassIdentifiers() {
  return `${env.FOUNDER_BYPASS_IDENTIFIERS},${env.FOUNDER_CLERK_USER_IDS}`.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizePhoneNumber(value?: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

export function isFounderBypassUser(input: { clerkUserId?: string | null; phone?: string | null }) {
  const identifiers = parseFounderBypassIdentifiers();
  if (identifiers.length === 0) {
    return false;
  }

  const clerkUserId = input.clerkUserId?.trim();
  const normalizedPhone = normalizePhoneNumber(input.phone);

  return identifiers.some((identifier) => {
    if (clerkUserId && identifier === clerkUserId) {
      return true;
    }

    return Boolean(normalizedPhone) && normalizePhoneNumber(identifier) === normalizedPhone;
  });
}

export async function ensureFounderBetaBypass(user: FounderBypassUser, source: string) {
  if (!isFounderBypassUser({ clerkUserId: user.clerk_user_id, phone: user.phone })) {
    return user;
  }

  if (user.beta_access_approved || user.beta_access_status === "active") {
    return user;
  }

  const approvedAt = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("users")
    .update({
      beta_access_approved: true,
      beta_access_status: "active",
      beta_approved_at: approvedAt,
      beta_access_granted_at: approvedAt,
      beta_access_revoked_at: null,
    })
    .eq("id", user.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new HttpError(500, "Failed to grant founder beta bypass", error);
  }

  logger.info(
    {
      userId: user.id,
      clerkUserId: user.clerk_user_id ?? null,
      phone: user.phone ?? null,
      source,
    },
    "Founder beta bypass granted"
  );

  await writeAuditLog({
    userId: user.id,
    action: "beta.founder_bypass_granted",
    entityType: "user",
    entityId: user.id,
    metadata: {
      source,
      clerk_user_id: user.clerk_user_id ?? null,
      phone: user.phone ?? null,
    },
  });

  return data;
}
