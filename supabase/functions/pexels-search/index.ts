import { corsHeaders } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("PEXELS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "PEXELS_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type = "photo", query, page = 1, per_page = 20 } = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams({ query, page: String(page), per_page: String(per_page) });

    const url =
      type === "video"
        ? `https://api.pexels.com/videos/search?${params}`
        : `https://api.pexels.com/v1/search?${params}`;

    const res = await fetch(url, {
      headers: { Authorization: apiKey },
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: `Pexels API error: ${res.status}`, detail: text }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();

    let results;
    if (type === "video") {
      results = (data.videos || []).map((v: any) => ({
        id: v.id,
        thumbnail: v.image,
        url: v.video_files?.[0]?.link || "",
        videographer: v.user?.name || "",
        duration: v.duration,
        width: v.width,
        height: v.height,
      }));
    } else {
      results = (data.photos || []).map((p: any) => ({
        id: p.id,
        thumbnail: p.src?.medium || p.src?.small || "",
        url: p.src?.original || "",
        photographer: p.photographer || "",
        width: p.width,
        height: p.height,
      }));
    }

    return new Response(
      JSON.stringify({ results, total_results: data.total_results, page: data.page }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
