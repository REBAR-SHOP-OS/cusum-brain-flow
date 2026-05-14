// One-shot bootstrap: copies CRON_AUTH_TOKEN env into Vault so pg_cron can read it.
// Safe to invoke multiple times. Delete after use.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronToken = Deno.env.get("CRON_AUTH_TOKEN");
  if (!cronToken) {
    return new Response(JSON.stringify({ ok: false, error: "CRON_AUTH_TOKEN env not set" }), { status: 500 });
  }
  const sb = createClient(url, serviceKey);
  // Try update first; if not exists, create
  const { data: existing } = await sb.rpc("bootstrap_set_vault_secret", { p_name: "CRON_AUTH_TOKEN", p_value: cronToken });
  return new Response(JSON.stringify({ ok: true, result: existing }), { headers: { "Content-Type": "application/json" } });
});
