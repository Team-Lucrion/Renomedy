import { env } from "../../config/env";
import { supabaseAdmin } from "../../lib/supabase";
import { writeAuditLog } from "../../services/audit.service";
import { getCurrentUserRecord } from "../../services/current-user.service";
import { HttpError } from "../../utils/http-error";

export type FeatureGate =
  | "prescription_scan"
  | "family_member"
  | "caregiver_alerts"
  | "refill_prediction"
  | "adherence_history";

export type SubscriptionPlan = {
  slug: "free" | "care" | "family_plus";
  display_name: string;
  monthly_price_inr: number;
  yearly_price_inr: number | null;
  scan_limit_monthly: number | null;
  family_member_limit: number | null;
  reminder_limit: number | null;
  caregiver_alerts_enabled: boolean;
  refill_prediction_enabled: boolean;
  adherence_history_enabled: boolean;
  premium_support_enabled: boolean;
  metadata?: Record<string, unknown>;
};

const founderIds = env.FOUNDER_CLERK_USER_IDS.split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const Renomedy_PLANS: SubscriptionPlan[] = [
  {
    slug: "free",
    display_name: "Free",
    monthly_price_inr: 0,
    yearly_price_inr: null,
    scan_limit_monthly: 5,
    family_member_limit: 1,
    reminder_limit: null,
    caregiver_alerts_enabled: false,
    refill_prediction_enabled: false,
    adherence_history_enabled: false,
    premium_support_enabled: false,
    metadata: {
      cta: "Start Free",
      positioning: "Family Care Simplified"
    }
  },
  {
    slug: "care",
    display_name: "Care",
    monthly_price_inr: 199,
    yearly_price_inr: 1999,
    scan_limit_monthly: null,
    family_member_limit: 3,
    reminder_limit: null,
    caregiver_alerts_enabled: true,
    refill_prediction_enabled: true,
    adherence_history_enabled: true,
    premium_support_enabled: false,
    metadata: {
      badge: "Most Popular",
      cta: "Protect Your Family",
      positioning: "Protect Your Family"
    }
  },
  {
    slug: "family_plus",
    display_name: "Family Plus",
    monthly_price_inr: 299,
    yearly_price_inr: 2999,
    scan_limit_monthly: null,
    family_member_limit: 10,
    reminder_limit: null,
    caregiver_alerts_enabled: true,
    refill_prediction_enabled: true,
    adherence_history_enabled: true,
    premium_support_enabled: true,
    metadata: {
      cta: "Coordinate Family Care",
      positioning: "Coordinate Full Family Care",
      early_beta_ai_features: true,
      multi_caregiver_coordination: true,
      nri_family_management: true,
      smart_escalation_alerts: true
    }
  }
];

function monthWindow() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    periodStart: monthStart.toISOString().slice(0, 10),
    periodEnd: nextMonthStart.toISOString().slice(0, 10)
  };
}

export function isFounderClerkUser(clerkUserId?: string | null) {
  return Boolean(clerkUserId && founderIds.includes(clerkUserId));
}

async function ensurePlanSeeded(slug: SubscriptionPlan["slug"]) {
  const plan = Renomedy_PLANS.find((item) => item.slug === slug);
  if (!plan) {
    throw new HttpError(500, `Unknown subscription plan: ${slug}`);
  }

  const { data, error } = await supabaseAdmin
    .from("subscription_plans")
    .upsert(plan, { onConflict: "slug" })
    .select("*")
    .single();

  if (error || !data) {
    throw new HttpError(500, "Failed to seed subscription plan", error);
  }

  return data;
}

export async function syncFounderSubscription(userId: string, clerkUserId?: string | null) {
  if (!isFounderClerkUser(clerkUserId)) {
    return null;
  }

  const plan = await ensurePlanSeeded("family_plus");
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .upsert(
      {
        user_id: userId,
        plan_id: plan.id,
        plan_slug: "family_plus",
        billing_cycle: "lifetime",
        status: "active",
        source: "founder",
        started_at: new Date().toISOString(),
        current_period_start: null,
        current_period_end: null,
        cancel_at: null
      },
      { onConflict: "user_id" }
    )
    .select("*, subscription_plans(*)")
    .single();

  if (error || !data) {
    throw new HttpError(500, "Failed to activate founder subscription", error);
  }

  return data;
}

async function ensureDefaultSubscription(userId: string) {
  const plan = await ensurePlanSeeded("free");
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .upsert(
      {
        user_id: userId,
        plan_id: plan.id,
        plan_slug: "free",
        billing_cycle: "monthly",
        status: "active",
        source: "beta_manual",
        started_at: new Date().toISOString()
      },
      { onConflict: "user_id", ignoreDuplicates: true }
    )
    .select("*, subscription_plans(*)")
    .single();

  if (error || !data) {
    throw new HttpError(500, "Failed to activate default subscription", error);
  }

  return data;
}

async function getSanctuarySubscriptionForUser(userId: string) {
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("family_group_memberships")
    .select("family_group_id, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    throw new HttpError(500, "Failed to fetch sanctuary membership", membershipError);
  }

  if (!membership?.family_group_id) {
    return null;
  }

  const { data: sanctuary, error: sanctuaryError } = await supabaseAdmin
    .from("family_groups")
    .select("id, plan_slug, subscription_status, subscription_expires_at")
    .eq("id", membership.family_group_id)
    .maybeSingle();

  if (sanctuaryError) {
    throw new HttpError(500, "Failed to fetch sanctuary subscription", sanctuaryError);
  }

  if (!sanctuary || sanctuary.subscription_status !== "active" || !sanctuary.plan_slug || sanctuary.plan_slug === "free") {
    return null;
  }

  if (sanctuary.subscription_expires_at && new Date(sanctuary.subscription_expires_at).getTime() < Date.now()) {
    return null;
  }

  const plan = await ensurePlanSeeded(sanctuary.plan_slug as SubscriptionPlan["slug"]);

  return {
    id: `sanctuary-${sanctuary.id}`,
    user_id: userId,
    plan_id: plan.id,
    plan_slug: sanctuary.plan_slug,
    billing_cycle: "monthly",
    status: "active",
    source: "payment_gateway",
    current_period_end: sanctuary.subscription_expires_at,
    subscription_plans: plan,
    sanctuary_id: sanctuary.id,
  };
}

export async function getActiveSubscriptionForUser(userId: string, clerkUserId?: string | null) {
  const founderSubscription = await syncFounderSubscription(userId, clerkUserId);
  if (founderSubscription) {
    return founderSubscription;
  }

  const sanctuarySubscription = await getSanctuarySubscriptionForUser(userId);
  if (sanctuarySubscription) {
    return sanctuarySubscription;
  }

  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .select("*, subscription_plans(*)")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Failed to fetch subscription", error);
  }

  return data ?? ensureDefaultSubscription(userId);
}

export async function getMySubscription(jwt: string) {
  const user = await getCurrentUserRecord(jwt);
  const subscription = await getActiveSubscriptionForUser(user.id, user.clerk_user_id);
  const usage = await getCurrentUsage(user.id);

  return {
    subscription,
    plan: subscription.subscription_plans,
    usage
  };
}

export async function listPlans() {
  await Promise.all(Renomedy_PLANS.map((plan) => ensurePlanSeeded(plan.slug)));
  const { data, error } = await supabaseAdmin.from("subscription_plans").select("*").order("sort_order", { ascending: true });
  if (error) throw new HttpError(500, "Failed to list subscription plans", error);
  return data;
}

export async function assignManualSubscription(
  jwt: string,
  input: { user_id: string; plan_slug: "free" | "care" | "family_plus"; billing_cycle: "monthly" | "yearly" | "lifetime" }
) {
  const founder = await getCurrentUserRecord(jwt);
  const plan = await ensurePlanSeeded(input.plan_slug);
  const { data, error } = await supabaseAdmin
    .from("user_subscriptions")
    .upsert(
      {
        user_id: input.user_id,
        plan_id: plan.id,
        plan_slug: input.plan_slug,
        billing_cycle: input.billing_cycle,
        status: "active",
        source: "admin_manual",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    )
    .select("*, subscription_plans(*)")
    .single();

  if (error || !data) {
    throw new HttpError(500, "Failed to assign subscription", error);
  }

  await writeAuditLog({
    userId: founder.id,
    action: "subscription.assigned",
    entityType: "user",
    entityId: input.user_id,
    metadata: { plan_slug: input.plan_slug, billing_cycle: input.billing_cycle, source: "admin_manual" }
  });

  return data;
}

export async function getCurrentUsage(userId: string) {
  const { periodStart, periodEnd } = monthWindow();
  const { data, error } = await supabaseAdmin
    .from("usage_tracking")
    .select("*")
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Failed to fetch usage tracking", error);
  }

  return (
    data ?? {
      user_id: userId,
      period_start: periodStart,
      period_end: periodEnd,
      prescription_scans_used: 0,
      reminders_created: 0,
      caregiver_alerts_used: 0
    }
  );
}

export async function incrementScanUsage(userId: string) {
  const usage = await getCurrentUsage(userId);
  const { periodStart, periodEnd } = monthWindow();
  const nextCount = Number(usage.prescription_scans_used ?? 0) + 1;
  const { error } = await supabaseAdmin.from("usage_tracking").upsert(
    {
      user_id: userId,
      period_start: periodStart,
      period_end: periodEnd,
      prescription_scans_used: nextCount
    },
    { onConflict: "user_id,period_start,period_end" }
  );

  if (error) {
    throw new HttpError(500, "Failed to update scan usage", error);
  }

  return nextCount;
}

export async function assertFeatureAccess(input: { jwt: string; feature: FeatureGate; currentCount?: number }) {
  const user = await getCurrentUserRecord(input.jwt);
  const subscription = await getActiveSubscriptionForUser(user.id, user.clerk_user_id);
  const plan = subscription.subscription_plans as SubscriptionPlan;

  if (subscription.plan_slug === "family_plus" && subscription.billing_cycle === "lifetime") {
    return { user, subscription, plan };
  }

  if (input.feature === "prescription_scan" && plan.scan_limit_monthly !== null) {
    const usage = await getCurrentUsage(user.id);
    if (Number(usage.prescription_scans_used ?? 0) >= plan.scan_limit_monthly) {
      throw new HttpError(402, "Free plan includes 5 prescription scans per month. Upgrade to Care for unlimited scans.", {
        code: "scan_limit_exceeded",
        plan_slug: subscription.plan_slug,
        upgrade_plan_slug: "care"
      });
    }
  }

  if (input.feature === "family_member" && plan.family_member_limit !== null) {
    if ((input.currentCount ?? 0) >= plan.family_member_limit) {
      throw new HttpError(402, `Your ${plan.display_name} plan supports up to ${plan.family_member_limit} family member(s).`, {
        code: "family_member_limit_exceeded",
        plan_slug: subscription.plan_slug,
        upgrade_plan_slug: subscription.plan_slug === "care" ? "family_plus" : "care"
      });
    }
  }

  const featureFlagMap: Partial<Record<FeatureGate, keyof SubscriptionPlan>> = {
    caregiver_alerts: "caregiver_alerts_enabled",
    refill_prediction: "refill_prediction_enabled",
    adherence_history: "adherence_history_enabled"
  };
  const flag = featureFlagMap[input.feature];

  if (flag && !plan[flag]) {
    throw new HttpError(402, "This care feature is included in Renomedy Care and Family Plus.", {
      code: `${input.feature}_locked`,
      plan_slug: subscription.plan_slug,
      upgrade_plan_slug: "care"
    });
  }

  return { user, subscription, plan };
}
