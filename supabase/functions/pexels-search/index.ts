import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const apiKey = Deno.env.get("PEXELS_API_KEY");
    if (!apiKey) throw new Error("PEXELS_API_KEY not configured");

    const { type = "photo", query, page = 1, per_page = 20 } = body;
    if (!query) {
      return new Response(JSON.stringify({ error: "query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams({ query, page: String(page), per_page: String(per_page) });
    const url = type === "video"
      ? `https://api.pexels.com/videos/search?${params}`
      : `https://api.pexels.com/v1/search?${params}`;

    const res = await fetch(url, { headers: { Authorization: apiKey } });

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
        id: v.id, thumbnail: v.image, url: v.video_files?.[0]?.link || "",
        videographer: v.user?.name || "", duration: v.duration, width: v.width, height: v.height,
      }));
    } else {
      results = (data.photos || []).map((p: any) => ({
        id: p.id, thumbnail: p.src?.medium || p.src?.small || "",
        url: p.src?.original || "", photographer: p.photographer || "", width: p.width, height: p.height,
      }));
    }

    return { results, total_results: data.total_results, page: data.page };
  }, { functionName: "pexels-search", authMode: "none", requireCompany: false, wrapResult: false })
);
