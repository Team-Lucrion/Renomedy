import crypto from "crypto";
import type { Request } from "express";
import { logger } from "../../config/logger";
import { env } from "../../config/env";
import { supabaseAdmin } from "../../lib/supabase";
import { writeAuditLog } from "../../services/audit.service";
import { ensureClosedBetaAccess } from "../../services/beta-access.service";
import { getCurrentUserRecord } from "../../services/current-user.service";
import { HttpError } from "../../utils/http-error";

// Plan pricing in paise (INR * 100)
const PLAN_PRICES = {
  care: { monthly: 19900, yearly: 199900 },
  family_plus: { monthly: 29900, yearly: 299900 },
};

type PaymentStatus = "pending" | "captured" | "failed";

type SanctuaryPaymentRecord = {
  id: string;
  family_group_id: string;
  user_id: string;
  plan_slug: "care" | "family_plus";
  billing_cycle: "monthly" | "yearly";
  razorpay_order_id: string;
  razorpay_payment_id?: string | null;
  amount_inr: number;
  status: PaymentStatus;
  metadata?: Record<string, unknown> | null;
  family_groups?: {
    id: string;
    plan_slug?: string | null;
    subscription_status?: string | null;
    subscription_expires_at?: string | null;
  } | null;
};

type RazorpayPaymentEntity = {
  id?: string;
  order_id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  error_code?: string;
  error_description?: string;
  error_reason?: string;
  error_source?: string;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: RazorpayPaymentEntity;
    };
  };
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

function getSubscriptionDurationDays(billingCycle: SanctuaryPaymentRecord["billing_cycle"]) {
  return billingCycle === "yearly" ? 365 : 30;
}

function computeSubscriptionExpiry(payment: SanctuaryPaymentRecord) {
  const currentExpiry = payment.family_groups?.subscription_expires_at
    ? new Date(payment.family_groups.subscription_expires_at).getTime()
    : 0;
  const baseTime = currentExpiry > Date.now() ? currentExpiry : Date.now();
  return new Date(baseTime + getSubscriptionDurationDays(payment.billing_cycle) * 24 * 60 * 60 * 1000).toISOString();
}

function mergePaymentMetadata(
  existing: SanctuaryPaymentRecord["metadata"],
  update: Record<string, unknown>
): Record<string, unknown> {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
  return { ...base, ...update };
}

async function loadPaymentByOrderId(razorpayOrderId: string) {
  const { data: payment, error } = await supabaseAdmin
    .from("sanctuary_payments")
    .select("*, family_groups(id, plan_slug, subscription_status, subscription_expires_at)")
    .eq("razorpay_order_id", razorpayOrderId)
    .single<SanctuaryPaymentRecord>();

  if (error) {
    throw new HttpError(500, "Failed to fetch payment record", error);
  }

  if (!payment) {
    throw new HttpError(404, `Payment record not found for order ${razorpayOrderId}`);
  }

  return payment;
}

async function applyCapturedPayment(
  payment: SanctuaryPaymentRecord,
  input: {
    razorpayPaymentId: string;
    metadata?: Record<string, unknown>;
    auditMetadata?: Record<string, unknown>;
  }
) {
  const expiresAt = computeSubscriptionExpiry(payment);
  const mergedMetadata = mergePaymentMetadata(payment.metadata, input.metadata ?? {});

  const { error: paymentError } = await supabaseAdmin
    .from("sanctuary_payments")
    .update({
      razorpay_payment_id: input.razorpayPaymentId,
      status: "captured",
      metadata: mergedMetadata,
    })
    .eq("id", payment.id);

  if (paymentError) {
    throw new HttpError(500, "Failed to update captured payment record", paymentError);
  }

  const { error: familyError } = await supabaseAdmin
    .from("family_groups")
    .update({
      plan_slug: payment.plan_slug,
      subscription_status: "active",
      subscription_expires_at: expiresAt,
    })
    .eq("id", payment.family_group_id);

  if (familyError) {
    throw new HttpError(500, "Failed to activate sanctuary subscription", familyError);
  }

  await writeAuditLog({
    userId: payment.user_id,
    action: "payment.completed",
    entityType: "family_group",
    entityId: payment.family_group_id,
    metadata: {
      plan_slug: payment.plan_slug,
      billing_cycle: payment.billing_cycle,
      order_id: payment.razorpay_order_id,
      payment_id: input.razorpayPaymentId,
      expires_at: expiresAt,
      ...(input.auditMetadata ?? {}),
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

async function applyFailedPayment(
  payment: SanctuaryPaymentRecord,
  input: {
    razorpayPaymentId?: string;
    metadata?: Record<string, unknown>;
    auditMetadata?: Record<string, unknown>;
  }
) {
  const mergedMetadata = mergePaymentMetadata(payment.metadata, input.metadata ?? {});

  const updatePayload: {
    status: "failed";
    metadata: Record<string, unknown>;
    razorpay_payment_id?: string;
  } = {
    status: "failed",
    metadata: mergedMetadata,
  };

  if (input.razorpayPaymentId) {
    updatePayload.razorpay_payment_id = input.razorpayPaymentId;
  }

  const { error: paymentError } = await supabaseAdmin
    .from("sanctuary_payments")
    .update(updatePayload)
    .eq("id", payment.id);

  if (paymentError) {
    throw new HttpError(500, "Failed to update failed payment record", paymentError);
  }

  const familyGroup = payment.family_groups;
  const currentExpiry = familyGroup?.subscription_expires_at ? new Date(familyGroup.subscription_expires_at).getTime() : 0;
  const shouldMarkPastDue =
    !familyGroup ||
    familyGroup.subscription_status !== "active" ||
    !currentExpiry ||
    currentExpiry <= Date.now();

  if (shouldMarkPastDue) {
    const { error: familyError } = await supabaseAdmin
      .from("family_groups")
      .update({
        subscription_status: "past_due",
      })
      .eq("id", payment.family_group_id);

    if (familyError) {
      throw new HttpError(500, "Failed to mark sanctuary subscription past due", familyError);
    }
  }

  await writeAuditLog({
    userId: payment.user_id,
    action: "payment.failed",
    entityType: "family_group",
    entityId: payment.family_group_id,
    metadata: {
      plan_slug: payment.plan_slug,
      billing_cycle: payment.billing_cycle,
      order_id: payment.razorpay_order_id,
      payment_id: input.razorpayPaymentId ?? null,
      marked_past_due: shouldMarkPastDue,
      ...(input.auditMetadata ?? {}),
    },
  });

  return {
    success: true,
    plan_slug: payment.plan_slug,
    billing_cycle: payment.billing_cycle,
    subscription_status: shouldMarkPastDue ? "past_due" : familyGroup?.subscription_status ?? "unchanged",
  };
}

function getWebhookSecret() {
  const secret = env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new HttpError(500, "RAZORPAY_WEBHOOK_SECRET is required for webhook verification");
  }
  return secret;
}

function getRawBody(req: Request) {
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === "string") {
    return Buffer.from(req.body);
  }

  throw new HttpError(400, "Razorpay webhook requires a raw JSON request body");
}

function verifyWebhookSignature(rawBody: Buffer, signature: string) {
  const expected = crypto.createHmac("sha256", getWebhookSecret()).update(rawBody).digest("hex");
  const expectedBytes = Buffer.from(expected, "utf8");
  const actualBytes = Buffer.from(signature, "utf8");

  if (expectedBytes.length !== actualBytes.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBytes, actualBytes);
}

function parseWebhookPayload(rawBody: Buffer) {
  try {
    return JSON.parse(rawBody.toString("utf8")) as RazorpayWebhookPayload;
  } catch (error) {
    throw new HttpError(400, "Invalid Razorpay webhook payload", error);
  }
}

function getPaymentEntity(payload: RazorpayWebhookPayload) {
  const entity = payload.payload?.payment?.entity;
  if (!entity) {
    throw new HttpError(400, "Razorpay webhook payload is missing payment entity");
  }
  return entity;
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
    const payment = await loadPaymentByOrderId(input.razorpay_order_id);

    if (payment.user_id !== user.id) {
      throw new HttpError(404, "Payment record not found");
    }

    return applyCapturedPayment(payment, {
      razorpayPaymentId: input.razorpay_payment_id,
      metadata: { mock: true },
      auditMetadata: { mock: true },
    });
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

export async function handleWebhook(req: Request) {
  const rawBody = getRawBody(req);
  const signature = req.header("x-razorpay-signature")?.trim();

  if (!signature) {
    throw new HttpError(400, "Missing Razorpay webhook signature");
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    logger.warn({ requestId: req.requestId }, "Rejected Razorpay webhook with invalid signature");
    throw new HttpError(400, "Invalid Razorpay webhook signature");
  }

  const payload = parseWebhookPayload(rawBody);
  const eventType = payload.event?.trim();
  const payment = getPaymentEntity(payload);
  const paymentId = payment.id?.trim() ?? null;
  const orderId = payment.order_id?.trim();

  logger.info(
    {
      requestId: req.requestId,
      eventType: eventType ?? "unknown",
      paymentId,
      orderId: orderId ?? null,
    },
    "Received Razorpay webhook"
  );

  if (!eventType) {
    throw new HttpError(400, "Razorpay webhook payload is missing event type");
  }

  if (!orderId) {
    throw new HttpError(400, "Razorpay webhook payload is missing payment order_id");
  }

  const paymentRecord = await loadPaymentByOrderId(orderId);
  const eventMetadata = {
    razorpay_event_type: eventType,
    razorpay_webhook_received_at: new Date().toISOString(),
  };

  if (eventType === "payment.captured") {
    if (!paymentId) {
      throw new HttpError(400, "Razorpay payment.captured webhook is missing payment id");
    }

    await applyCapturedPayment(paymentRecord, {
      razorpayPaymentId: paymentId,
      metadata: {
        ...eventMetadata,
        razorpay_payment_status: payment.status ?? "captured",
        razorpay_payment_amount_paise: payment.amount ?? null,
        razorpay_payment_currency: payment.currency ?? null,
      },
      auditMetadata: {
        source: "razorpay_webhook",
      },
    });

    return { received: true, event: eventType, payment_id: paymentId, order_id: orderId };
  }

  if (eventType === "payment.failed") {
    await applyFailedPayment(paymentRecord, {
      razorpayPaymentId: paymentId ?? undefined,
      metadata: {
        ...eventMetadata,
        razorpay_payment_status: payment.status ?? "failed",
        razorpay_error_code: payment.error_code ?? null,
        razorpay_error_description: payment.error_description ?? null,
        razorpay_error_reason: payment.error_reason ?? null,
        razorpay_error_source: payment.error_source ?? null,
      },
      auditMetadata: {
        source: "razorpay_webhook",
        error_code: payment.error_code ?? null,
        error_description: payment.error_description ?? null,
      },
    });

    return { received: true, event: eventType, payment_id: paymentId, order_id: orderId };
  }

  return { received: true, ignored: true, event: eventType, payment_id: paymentId, order_id: orderId };
}
