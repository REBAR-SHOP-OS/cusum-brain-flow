const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const baseUrl = Deno.env.get("WP_BASE_URL");
    const username = Deno.env.get("WP_USERNAME");
    const password = Deno.env.get("WP_APP_PASSWORD");

    if (!baseUrl || !username || !password) {
      return new Response(JSON.stringify({ ok: false, error: "Missing WP credentials" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const creds = btoa(`${username}:${password}`);

    const res = await fetch(`${baseUrl}/posts?per_page=1`, {
      headers: { Authorization: `Basic ${creds}` },
    });

    const body = await res.text();

    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, status: res.status, error: body }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const posts = JSON.parse(body);
    return new Response(JSON.stringify({
      ok: true,
      message: `Connected! Found ${posts.length} post(s).`,
      sample: posts[0] ? { id: posts[0].id, title: posts[0].title?.rendered } : null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
