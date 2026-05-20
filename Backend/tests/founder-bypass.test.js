const test = require("node:test");
const assert = require("node:assert/strict");

function loadFounderBypassService({ founderIdentifiers, updateResult }) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
    CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
    FOUNDER_BYPASS_IDENTIFIERS: process.env.FOUNDER_BYPASS_IDENTIFIERS,
    FOUNDER_CLERK_USER_IDS: process.env.FOUNDER_CLERK_USER_IDS,
  };

  process.env.NODE_ENV = "test";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.SUPABASE_STORAGE_BUCKET = "prescriptions";
  process.env.CLERK_SECRET_KEY = "clerk_secret";
  process.env.CLERK_WEBHOOK_SECRET = "whsec_test";
  process.env.FOUNDER_BYPASS_IDENTIFIERS = founderIdentifiers;
  process.env.FOUNDER_CLERK_USER_IDS = "";

  const servicePath = require.resolve("../dist/services/founder-bypass.service.js");
  const envPath = require.resolve("../dist/config/env.js");
  const supabasePath = require.resolve("../dist/lib/supabase.js");
  const loggerPath = require.resolve("../dist/config/logger.js");
  const auditPath = require.resolve("../dist/services/audit.service.js");

  delete require.cache[servicePath];
  delete require.cache[envPath];
  delete require.cache[supabasePath];
  delete require.cache[loggerPath];
  delete require.cache[auditPath];

  const state = {
    updates: [],
    auditWrites: [],
    logs: [],
  };

  require.cache[supabasePath] = {
    id: supabasePath,
    filename: supabasePath,
    loaded: true,
    exports: {
      supabaseAdmin: {
        from(table) {
          if (table !== "users") {
            throw new Error(`Unexpected table ${table}`);
          }

          return {
            update(payload) {
              state.updates.push(payload);
              return {
                eq(_column, value) {
                  assert.equal(value, "user-1");
                  return {
                    select() {
                      return {
                        async single() {
                          return {
                            data: { id: "user-1", ...updateResult, ...payload },
                            error: null,
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
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
          state.logs.push({ payload, message });
        },
        warn() {},
        error() {},
        debug() {},
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

  const service = require(servicePath);
  Object.assign(process.env, previous);
  return { ...service, state };
}

test("isFounderBypassUser matches Clerk user IDs and phone numbers", () => {
  const { isFounderBypassUser } = loadFounderBypassService({
    founderIdentifiers: "user_founder_1,+91 99999 00000",
    updateResult: {},
  });

  assert.equal(isFounderBypassUser({ clerkUserId: "user_founder_1", phone: null }), true);
  assert.equal(isFounderBypassUser({ clerkUserId: "user_other", phone: "+91-99999-00000" }), true);
  assert.equal(isFounderBypassUser({ clerkUserId: "user_other", phone: "+91-88888-00000" }), false);
});

test("ensureFounderBetaBypass approves pending founders and logs the bypass", async () => {
  const { ensureFounderBetaBypass, state } = loadFounderBypassService({
    founderIdentifiers: "user_founder_1",
    updateResult: {
      clerk_user_id: "user_founder_1",
      phone: "+919999900000",
      beta_access_approved: true,
      beta_access_status: "active",
    },
  });

  const result = await ensureFounderBetaBypass(
    {
      id: "user-1",
      clerk_user_id: "user_founder_1",
      phone: "+919999900000",
      beta_access_approved: false,
      beta_access_status: "pending",
    },
    "test_case"
  );

  assert.equal(state.updates.length, 1);
  assert.equal(result.beta_access_approved, true);
  assert.equal(result.beta_access_status, "active");
  assert.equal(state.logs.some((entry) => entry.message === "Founder beta bypass granted"), true);
  assert.equal(state.auditWrites.some((entry) => entry.action === "beta.founder_bypass_granted"), true);
});
