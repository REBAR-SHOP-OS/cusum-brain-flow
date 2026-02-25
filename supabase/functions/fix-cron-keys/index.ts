import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const client = createClient(supabaseUrl, serviceRoleKey);

  const newCmd4 = `
    SELECT net.http_post(
      url := '${supabaseUrl}/functions/v1/odoo-crm-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ${serviceRoleKey}'
      ),
      body := '{"mode":"incremental"}'::jsonb
    ) AS request_id;
  `;

  const newCmd5 = `
    SELECT net.http_post(
      url := '${supabaseUrl}/functions/v1/odoo-chatter-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ${serviceRoleKey}'
      ),
      body := '{"mode":"missing"}'::jsonb
    ) AS request_id;
  `;

  // Use execute_write_fix with UPDATE on cron.job table (single statement, no inner semicolons issue)
  const { data: d4, error: err4 } = await client.rpc("execute_write_fix", {
    sql_query: `UPDATE cron.job SET command = E'${newCmd4.replace(/'/g, "''").replace(/\n/g, "\\n")}' WHERE jobid = 4`,
  });

  const { data: d5, error: err5 } = await client.rpc("execute_write_fix", {
    sql_query: `UPDATE cron.job SET command = E'${newCmd5.replace(/'/g, "''").replace(/\n/g, "\\n")}' WHERE jobid = 5`,
  });

  return new Response(JSON.stringify({
    job4: err4 ? { error: err4.message } : { success: true, data: d4 },
    job5: err5 ? { error: err5.message } : { success: true, data: d5 },
  }), {
    headers: { "Content-Type": "application/json" },
  });
});
