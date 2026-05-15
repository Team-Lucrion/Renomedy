import { supabaseAdmin } from "../../lib/supabase";
import { ensureClosedBetaAccess } from "../../services/beta-access.service";
import { writeAuditLog } from "../../services/audit.service";
import { getCurrentUserRecord } from "../../services/current-user.service";
import { HttpError } from "../../utils/http-error";
import { env } from "../../config/env";

// Plan pricing in paise (INR * 100)
const PLAN_PRICES = {
  care: { monthly: 19900, yearly: 199900 },
  family_plus: { monthly: 29900, yearly: 299900 },
};

function isMockMode() {
  return !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET;
}

async function getMockRazorpayOrder(planSlug: string, billingCycle: string) {
  return {
    id: `mock_order_${Date.now()}`,
    amount: PLAN_PRICES[planSlug as keyof typeof PLAN_PRICES]?.[billingCycle as "monthly" | "yearly"] ?? 19900,
    currency: "INR",
    receipt: `mock_${planSlug}_${Date.now()}`,
    status: "created",
    mock: true,
  };
}

export async function createRazorpayOrder(
  jwt: string,
  input: { plan_slug: string; billing_cycle: string }
) {
  await ensureClosedBetaAccess(jwt);
  const user = await getCurrentUserRecord(jwt);
  const memberships = await supabaseAdmin
    .from("family_group_memberships")
    .select("family_group_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("role", "owner")
    .maybeSingle();

  if (!memberships.data) {
    throw new HttpError(403, "Only sanctuary owners can initiate payments");
  }

  const amount =
    PLAN_PRICES[input.plan_slug as keyof typeof PLAN_PRICES]?.[
      input.billing_cycle as "monthly" | "yearly"
    ] ?? 0;

  if (!amount) {
    throw new HttpError(400, "Invalid plan or billing cycle");
  }

  if (isMockMode()) {
    const order = await getMockRazorpayOrder(input.plan_slug, input.billing_cycle);
    await supabaseAdmin.from("sanctuary_payments").insert({
      family_group_id: memberships.data.family_group_id,
      user_id: user.id,
      plan_slug: input.plan_slug,
      billing_cycle: input.billing_cycle,
      razorpay_order_id: order.id,
      amount_inr: amount / 100,
      status: "pending",
      metadata: { mock: true },
    });
    return order;
  }

  // Live Razorpay integration would go here
  throw new HttpError(501, "Live Razorpay integration requires valid API keys. Use mock mode for testing.");
}

export async function verifyRazorpayPayment(
  jwt: string,
  input: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
) {
  await ensureClosedBetaAccess(jwt);
  const user = await getCurrentUserRecord(jwt);

  // Mock mode: accept any signature for testing
  if (isMockMode() || input.razorpay_order_id.startsWith("mock_order_")) {
    const { data: payment } = await supabaseAdmin
      .from("sanctuary_payments")
      .select("*, family_groups(*)")
      .eq("razorpay_order_id", input.razorpay_order_id)
      .eq("user_id", user.id)
      .single();

    if (!payment) {
      throw new HttpError(404, "Payment record not found");
    }

    const periodDays = payment.billing_cycle === "yearly" ? 365 : 30;
    const expiresAt = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from("sanctuary_payments")
      .update({
        razorpay_payment_id: input.razorpay_payment_id,
        status: "captured",
      })
      .eq("id", payment.id);

    await supabaseAdmin
      .from("family_groups")
      .update({
        plan_slug: payment.plan_slug,
        subscription_status: "active",
        subscription_expires_at: expiresAt,
      })
      .eq("id", payment.family_group_id);

    await writeAuditLog({
      userId: user.id,
      action: "payment.completed",
      entityType: "family_group",
      entityId: payment.family_group_id,
      metadata: {
        plan_slug: payment.plan_slug,
        order_id: input.razorpay_order_id,
        payment_id: input.razorpay_payment_id,
        mock: true,
      },
    });

    return {
      success: true,
      plan_slug: payment.plan_slug,
      billing_cycle: payment.billing_cycle,
      subscription_status: "active",
      expires_at: expiresAt,
    };
  }

  throw new HttpError(501, "Live Razorpay signature verification not implemented.");
}

export async function getPaymentStatus(jwt: string, razorpayOrderId: string) {
  await ensureClosedBetaAccess(jwt);
  const user = await getCurrentUserRecord(jwt);
  const { data: payment, error } = await supabaseAdmin
    .from("sanctuary_payments")
    .select("*")
    .eq("razorpay_order_id", razorpayOrderId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, "Failed to fetch payment status", error);
  }

  if (!payment) {
    throw new HttpError(404, "Payment record not found");
  }

  const isCaptured = payment.status === "captured";
  return {
    razorpay_order_id: payment.razorpay_order_id,
    plan_slug: payment.plan_slug,
    billing_cycle: payment.billing_cycle,
    status: payment.status,
    captured: isCaptured,
    amount_inr: payment.amount_inr,
  };
}

export async function handleWebhook(req: any) {
  // Mock mode: log webhook but do not process
  if (isMockMode()) {
    return { received: true, mock: true };
  }

  // Live Razorpay webhook verification would go here
  return { received: true };
}
