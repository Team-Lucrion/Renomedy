import { supabaseAdmin } from "./src/lib/supabase";

async function run() {
  const { data, error } = await supabaseAdmin
    .from("prescriptions")
    .select("*, prescription_uploads(*)")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  console.log("LAST PRESCRIPTION:", JSON.stringify(data, null, 2));
}

run();
