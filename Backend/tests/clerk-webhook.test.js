const test = require("node:test");
const assert = require("node:assert/strict");

function loadAuthService({ verifyImpl, state }) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET
  };

  process.env.NODE_ENV = "test";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.SUPABASE_STORAGE_BUCKET = "prescriptions";
  process.env.CLERK_SECRET_KEY = "clerk_secret";
  process.env.CLERK_WEBHOOK_SECRET = "whsec_test";

  const authServicePath = require.resolve("../dist/modules/auth/auth.service.js");
  const envPath = require.resolve("../dist/config/env.js");
  const supabasePath = require.resolve("../dist/lib/supabase.js");
  const auditPath = require.resolve("../dist/services/audit.service.js");
  const loggerPath = require.resolve("../dist/config/logger.js");
  const sentryPath = require.resolve("../dist/lib/sentry.js");
  const svixPath = require.resolve("svix");

  delete require.cache[authServicePath];
  delete require.cache[envPath];
  delete require.cache[supabasePath];
  delete require.cache[auditPath];
  delete require.cache[loggerPath];
  delete require.cache[sentryPath];
  delete require.cache[svixPath];

  const auditWrites = [];

  const mockSupabaseAdmin = {
    from(table) {
      if (table === "users") {
        return {
          upsert(payload, options) {
            state.userUpserts.push({ payload, options });
            return {
              select() {
                return {
                  async single() {
                    return {
                      data: { id: "user-row-1", ...payload },
                      error: null
                    };
                  }
                };
              }
            };
          },
          select() {
            return {
              eq(_column, value) {
                state.userLookups.push(value);
                return {
                  async maybeSingle() {
                    return {
                      data: state.existingUsers[value] ?? null,
                      error: null
                    };
                  }
                };
              }
            };
          },
          delete() {
            return {
              async eq(_column, value) {
                state.userDeletes.push(value);
                return { error: null };
              }
            };
          }
        };
      }

      if (table === "audit_logs") {
        return {
          async insert(payload) {
            auditWrites.push(payload);
            return { error: null };
          }
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }
  };

  require.cache[supabasePath] = {
    id: supabasePath,
    filename: supabasePath,
    loaded: true,
    exports: { supabaseAdmin: mockSupabaseAdmin }
  };
  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: {
      async writeAuditLog(input) {
        auditWrites.push({
          user_id: input.userId ?? null,
          action: input.action,
          entity_type: input.entityType,
          entity_id: input.entityId ?? null,
          metadata: input.metadata ?? {}
        });
      }
    }
  };
  require.cache[loggerPath] = {
    id: loggerPath,
    filename: loggerPath,
    loaded: true,
    exports: { logger: { warn() {}, error() {}, info() {}, debug() {} } }
  };
  require.cache[sentryPath] = {
    id: sentryPath,
    filename: sentryPath,
    loaded: true,
    exports: { captureException() {} }
  };
  require.cache[svixPath] = {
    id: svixPath,
    filename: svixPath,
    loaded: true,
    exports: {
      Webhook: class {
        verify(rawBody, headers) {
          return verifyImpl(rawBody, headers);
        }
      }
    }
  };

  const service = require(authServicePath);

  Object.assign(process.env, previous);

  return { ...service, auditWrites };
}

function buildRequest(body, headers = {}) {
  return {
    body: Buffer.from(JSON.stringify(body)),
    headers,
    requestId: "req-1",
    originalUrl: "/auth/clerk-webhook",
    method: "POST",
    params: {},
    query: {},
    get() {
      return "node-test";
    }
  };
}

test("processClerkWebhook provisions user on user.created", async () => {
  const state = { userUpserts: [], userDeletes: [], userLookups: [], existingUsers: {} };
  const { processClerkWebhook, auditWrites } = loadAuthService({
    state,
    verifyImpl: () => ({
      type: "user.created",
      data: {
        id: "user_123",
        first_name: "Asha",
        last_name: "Patil",
        email_addresses: [{ email_address: "asha@example.com" }],
        phone_numbers: [{ phone_number: "+919999999999" }]
      }
    })
  });

  const result = await processClerkWebhook(
    buildRequest(
      { example: true },
      { "svix-id": "msg_1", "svix-timestamp": "123", "svix-signature": "sig_1" }
    )
  );

  assert.equal(result.eventType, "user.created");
  assert.equal(state.userUpserts.length, 1);
  assert.equal(state.userUpserts[0].options.onConflict, "clerk_user_id");
  assert.equal(state.userUpserts[0].payload.clerk_user_id, "user_123");
  assert.equal(auditWrites.some((entry) => entry.action === "user.synced"), true);
});

test("processClerkWebhook deletes mapped user on user.deleted", async () => {
  const state = {
    userUpserts: [],
    userDeletes: [],
    userLookups: [],
    existingUsers: { user_123: { id: "db-user-1", clerk_user_id: "user_123" } }
  };
  const { processClerkWebhook, auditWrites } = loadAuthService({
    state,
    verifyImpl: () => ({
      type: "user.deleted",
      data: { id: "user_123" }
    })
  });

  await processClerkWebhook(
    buildRequest(
      { example: true },
      { "svix-id": "msg_2", "svix-timestamp": "123", "svix-signature": "sig_2" }
    )
  );

  assert.deepEqual(state.userDeletes, ["user_123"]);
  const deletionAudit = auditWrites.find((entry) => entry.action === "user.deleted");
  assert.ok(deletionAudit);
  assert.equal(deletionAudit.user_id, "db-user-1");
  assert.equal(deletionAudit.metadata.existed_before_delete, true);
});

test("processClerkWebhook rejects invalid signatures and records the failure", async () => {
  const state = { userUpserts: [], userDeletes: [], userLookups: [], existingUsers: {} };
  const { processClerkWebhook, auditWrites } = loadAuthService({
    state,
    verifyImpl: () => {
      throw new Error("bad signature");
    }
  });

  await assert.rejects(
    () =>
      processClerkWebhook(
        buildRequest(
          { example: true },
          { "svix-id": "msg_3", "svix-timestamp": "123", "svix-signature": "sig_3" }
        )
      ),
    /Invalid Clerk webhook signature/
  );

  assert.equal(auditWrites.some((entry) => entry.action === "auth.clerk_webhook_rejected"), true);
});

test("processClerkWebhook stays replay-safe for duplicate user.created events", async () => {
  const state = { userUpserts: [], userDeletes: [], userLookups: [], existingUsers: {} };
  const { processClerkWebhook } = loadAuthService({
    state,
    verifyImpl: () => ({
      type: "user.created",
      data: {
        id: "user_123",
        first_name: "Asha",
        last_name: "Patil",
        email_addresses: [{ email_address: "asha@example.com" }],
        phone_numbers: []
      }
    })
  });

  const request = buildRequest(
    { example: true },
    { "svix-id": "msg_4", "svix-timestamp": "123", "svix-signature": "sig_4" }
  );

  await processClerkWebhook(request);
  await processClerkWebhook(request);

  assert.equal(state.userUpserts.length, 2);
  assert.equal(state.userUpserts.every((entry) => entry.options.onConflict === "clerk_user_id"), true);
});
