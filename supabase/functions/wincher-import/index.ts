import { corsHeaders, requireAuth, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, serviceClient } = await requireAuth(req);

    // Resolve company_id
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .single();
    const companyId = profile?.company_id;
    if (!companyId) throw new Error("No company profile found");

    const { domain_id, keywords } = await req.json();
    if (!domain_id) throw new Error("domain_id required");
    if (!Array.isArray(keywords) || !keywords.length) throw new Error("keywords array required");

    let upserted = 0;
    let errors = 0;

    // Process in batches of 50
    const batchSize = 50;
    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      const rows = batch.map((kw: any) => {
        const keyword = (kw.keyword || "").trim().toLowerCase();
        if (!keyword) return null;

        const position = kw.position != null ? Number(kw.position) : null;
        const change = kw.change != null ? Number(kw.change) : null;
        const traffic = kw.traffic != null ? Number(kw.traffic) : null;
        const trafficChange = kw.traffic_change != null ? Number(kw.traffic_change) : null;
        const volume = kw.volume != null ? Number(kw.volume) : null;

        // Determine status from change_status
        let status = "opportunity";
        const changeStatus = (kw.change_status || "").toUpperCase();
        if (position && position <= 3) status = "winner";
        else if (changeStatus === "LOST" || changeStatus === "DECLINED") status = "declining";
        else if (changeStatus === "IMPROVED" || changeStatus === "NEW") status = "opportunity";
        else if (changeStatus === "UNCHANGED" && position && position <= 10) status = "winner";

        // Parse SERP features
        const features = kw.features
          ? (kw.features as string).split(",").map((f: string) => f.trim()).filter(Boolean)
          : null;

        return {
          company_id: companyId,
          domain_id,
          keyword,
          wincher_position: position,
          wincher_position_change: change,
          wincher_traffic: traffic,
          volume,
          wincher_serp_features_json: features,
          top_page: kw.top_page || null,
          wincher_synced_at: kw.updated || new Date().toISOString(),
          status,
          sources: ["wincher"],
          source_count: 1,
        };
      }).filter(Boolean);

      if (!rows.length) continue;

      const { error } = await serviceClient
        .from("seo_keyword_ai")
        .upsert(rows, { onConflict: "domain_id,keyword" });

      if (error) {
        console.error("Batch upsert error:", error.message);
        errors += batch.length;
      } else {
        upserted += rows.length;
      }
    }

    // Update domain sync timestamp
    await serviceClient
      .from("seo_domains")
      .update({ wincher_synced_at: new Date().toISOString() })
      .eq("id", domain_id);

    return json({ success: true, upserted, errors, total: keywords.length });
  } catch (err) {
    if (err instanceof Response) return err;
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("wincher-import error:", msg);
    return json({ error: msg }, 400);
  }
});
