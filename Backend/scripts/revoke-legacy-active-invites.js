const path = require("path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

function getArgValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const before = getArgValue("--before") || process.env.LEGACY_INVITE_CUTOFF_ISO;
const apply = process.argv.includes("--apply");

if (!before || Number.isNaN(Date.parse(before))) {
  throw new Error("Provide an ISO cutoff with --before=YYYY-MM-DDTHH:mm:ss.sssZ or LEGACY_INVITE_CUTOFF_ISO");
}

const supabase = createClient(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);

async function main() {
  const { data: candidates, error: selectError } = await supabase
    .from("beta_invites")
    .select("id, created_at, status, used_count, used_by_user_id")
    .eq("status", "active")
    .eq("used_count", 0)
    .is("used_by_user_id", null)
    .lt("created_at", before);

  if (selectError) {
    throw selectError;
  }

  const ids = (candidates || []).map((invite) => invite.id);
  console.log(JSON.stringify({
    dryRun: !apply,
    cutoff: before,
    candidateCount: ids.length,
    candidateIds: ids
  }, null, 2));

  if (!apply || ids.length === 0) {
    return;
  }

  const { error: updateError } = await supabase
    .from("beta_invites")
    .update({
      status: "revoked",
      notes: `Revoked by legacy invite cleanup on ${new Date().toISOString()}`
    })
    .in("id", ids)
    .eq("status", "active")
    .eq("used_count", 0)
    .is("used_by_user_id", null);

  if (updateError) {
    throw updateError;
  }

  console.log(JSON.stringify({ revokedCount: ids.length }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
