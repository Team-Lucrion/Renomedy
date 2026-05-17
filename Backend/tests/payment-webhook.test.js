const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

function loadPaymentsService(state) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    FOUNDER_CLERK_USER_IDS: process.env.FOUNDER_CLERK_USER_IDS,
  };

  process.env.NODE_ENV = "test";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.SUPABASE_STORAGE_BUCKET = "prescriptions";
  process.env.CLERK_SECRET_KEY = "clerk_secret";
  process.env.CLERK_WEBHOOK_SECRET = "whsec_test";
  process.env.RAZORPAY_KEY_ID = "rzp_test_123";
  process.env.RAZORPAY_KEY_SECRET = "razorpay_secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "razorpay_webhook_secret";
  process.env.FOUNDER_CLERK_USER_IDS = "";

  const servicePath = require.resolve("../dist/modules/payments/payments.service.js");
  const envPath = require.resolve("../dist/config/env.js");
  const supabasePath = require.resolve("../dist/lib/supabase.js");
  const auditPath = require.resolve("../dist/services/audit.service.js");
  const loggerPath = require.resolve("../dist/config/logger.js");

  delete require.cache[servicePath];
  delete require.cache[envPath];
  delete require.cache[supabasePath];
  delete require.cache[auditPath];
  delete require.cache[loggerPath];

  require.cache[supabasePath] = {
    id: supabasePath,
    filename: supabasePath,
    loaded: true,
    exports: {
      supabaseAdmin: {
        from(table) {
          if (table === "sanctuary_payments") {
            return {
              select() {
                return {
                  eq(_column, value) {
                    return {
                      async single() {
                        return { data: state.paymentsByOrderId[value] ?? null, error: null };
                      },
                    };
                  },
                };
              },
              update(payload) {
                return {
                  async eq(_column, value) {
                    state.paymentUpdates.push({ value, payload });
                    const payment = Object.values(state.paymentsByOrderId).find((entry) => entry.id === value);
                    if (payment) {
                      Object.assign(payment, payload);
                    }
                    return { error: null };
                  },
                };
              },
            };
          }

          if (table === "family_groups") {
            return {
              update(payload) {
                return {
                  async eq(_column, value) {
                    state.familyUpdates.push({ value, payload });
                    state.familyGroups[value] = { ...(state.familyGroups[value] ?? {}), ...payload };
                    return { error: null };
                  },
                };
              },
            };
          }

          throw new Error(`Unexpected table ${table}`);
        },
      },
    },
  };

  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: {
      async writeAuditLog(input) {
        state.auditWrites.push(input);
      },
    },
  };

  require.cache[loggerPath] = {
    id: loggerPath,
    filename: loggerPath,
    loaded: true,
    exports: {
      logger: {
        info(payload, message) {
          state.logs.push({ level: "info", payload, message });
        },
        warn(payload, message) {
          state.logs.push({ level: "warn", payload, message });
        },
        error() {},
        debug() {},
      },
    },
  };

  const service = require(servicePath);

  Object.assign(process.env, previous);

  return service;
}

function signBody(body) {
  return crypto.createHmac("sha256", "razorpay_webhook_secret").update(body).digest("hex");
}

function buildRequest(payload, signature = signBody(payload)) {
  return {
    body: Buffer.from(payload),
    requestId: "req-1",
    header(name) {
      if (name.toLowerCase() === "x-razorpay-signature") {
        return signature;
      }
      return undefined;
    },
  };
}

test("handleWebhook verifies payment.captured and activates the sanctuary subscription", async () => {
  const state = {
    paymentsByOrderId: {
      order_123: {
        id: "payment-row-1",
        family_group_id: "family-1",
        user_id: "user-1",
        plan_slug: "care",
        billing_cycle: "monthly",
        razorpay_order_id: "order_123",
        status: "pending",
        metadata: { existing: true },
        family_groups: {
          id: "family-1",
          subscription_status: "inactive",
          subscription_expires_at: null,
          plan_slug: "free",
        },
      },
    },
    familyGroups: {
      "family-1": {
        id: "family-1",
        subscription_status: "inactive",
        subscription_expires_at: null,
      },
    },
    paymentUpdates: [],
    familyUpdates: [],
    auditWrites: [],
    logs: [],
  };

  const { handleWebhook } = loadPaymentsService(state);
  const payload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_123",
          order_id: "order_123",
          status: "captured",
          amount: 19900,
          currency: "INR",
        },
      },
    },
  });

  const result = await handleWebhook(buildRequest(payload));

  assert.equal(result.received, true);
  assert.equal(result.event, "payment.captured");
  assert.equal(state.paymentUpdates.length, 1);
  assert.equal(state.paymentUpdates[0].payload.status, "captured");
  assert.equal(state.paymentUpdates[0].payload.razorpay_payment_id, "pay_123");
  assert.equal(state.paymentUpdates[0].payload.metadata.existing, true);
  assert.equal(state.paymentUpdates[0].payload.metadata.razorpay_event_type, "payment.captured");
  assert.equal(state.familyUpdates.length, 1);
  assert.equal(state.familyUpdates[0].payload.subscription_status, "active");
  assert.equal(typeof state.familyUpdates[0].payload.subscription_expires_at, "string");
  assert.equal(state.auditWrites.some((entry) => entry.action === "payment.completed"), true);
  assert.equal(
    state.logs.some(
      (entry) =>
        entry.level === "info" &&
        entry.payload.eventType === "payment.captured" &&
        entry.payload.paymentId === "pay_123"
    ),
    true
  );
});

test("handleWebhook verifies payment.failed and marks expired subscriptions past due", async () => {
  const state = {
    paymentsByOrderId: {
      order_456: {
        id: "payment-row-2",
        family_group_id: "family-2",
        user_id: "user-2",
        plan_slug: "family_plus",
        billing_cycle: "yearly",
        razorpay_order_id: "order_456",
        status: "pending",
        metadata: {},
        family_groups: {
          id: "family-2",
          subscription_status: "inactive",
          subscription_expires_at: null,
          plan_slug: "free",
        },
      },
    },
    familyGroups: {
      "family-2": {
        id: "family-2",
        subscription_status: "inactive",
        subscription_expires_at: null,
      },
    },
    paymentUpdates: [],
    familyUpdates: [],
    auditWrites: [],
    logs: [],
  };

  const { handleWebhook } = loadPaymentsService(state);
  const payload = JSON.stringify({
    event: "payment.failed",
    payload: {
      payment: {
        entity: {
          id: "pay_456",
          order_id: "order_456",
          status: "failed",
          error_code: "BAD_REQUEST_ERROR",
          error_description: "Payment declined",
        },
      },
    },
  });

  const result = await handleWebhook(buildRequest(payload));

  assert.equal(result.received, true);
  assert.equal(result.event, "payment.failed");
  assert.equal(state.paymentUpdates.length, 1);
  assert.equal(state.paymentUpdates[0].payload.status, "failed");
  assert.equal(state.paymentUpdates[0].payload.razorpay_payment_id, "pay_456");
  assert.equal(state.paymentUpdates[0].payload.metadata.razorpay_error_description, "Payment declined");
  assert.equal(state.familyUpdates.length, 1);
  assert.equal(state.familyUpdates[0].payload.subscription_status, "past_due");
  assert.equal(state.auditWrites.some((entry) => entry.action === "payment.failed"), true);
});

test("handleWebhook rejects invalid signatures", async () => {
  const state = {
    paymentsByOrderId: {
      order_789: {
        id: "payment-row-3",
        family_group_id: "family-3",
        user_id: "user-3",
        plan_slug: "care",
        billing_cycle: "monthly",
        razorpay_order_id: "order_789",
        status: "pending",
        metadata: {},
        family_groups: {
          id: "family-3",
          subscription_status: "inactive",
          subscription_expires_at: null,
          plan_slug: "free",
        },
      },
    },
    familyGroups: {},
    paymentUpdates: [],
    familyUpdates: [],
    auditWrites: [],
    logs: [],
  };

  const { handleWebhook } = loadPaymentsService(state);
  const payload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_789",
          order_id: "order_789",
          status: "captured",
        },
      },
    },
  });

  await assert.rejects(() => handleWebhook(buildRequest(payload, "bad_signature")), /Invalid Razorpay webhook signature/);
  assert.equal(state.paymentUpdates.length, 0);
  assert.equal(state.familyUpdates.length, 0);
  assert.equal(state.logs.some((entry) => entry.level === "warn"), true);
});
