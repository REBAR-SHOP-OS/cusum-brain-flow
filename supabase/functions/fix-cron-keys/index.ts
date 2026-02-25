Deno.serve(async (_req) => {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Return just the key so we can use it to fix cron jobs
  return new Response(JSON.stringify({ key }), {
    headers: { "Content-Type": "application/json" },
  });
});
