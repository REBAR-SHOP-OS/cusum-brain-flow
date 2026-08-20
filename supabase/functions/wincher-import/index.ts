import { handleRequest } from "../_shared/requestHandler.ts";
import { json } from "../_shared/auth.ts";

/**
 * Imports Wincher keyword data into seo_keyword_ai table.
 * Migrated to handleRequest wrapper (Phase 1.2).
 */
Deno.serve((req) =>
  handleRequest(req, async ({ companyId, serviceClient, body }) => {
    const { domain_id, keywords } = body;
    if (!domain_id) throw json({ error: "domain_id required" }, 400);
    if (!Array.isArray(keywords) || !keywords.length) throw json({ error: "keywords array required" }, 400);

    let upserted = 0;
    let errors = 0;

    const batchSize = 50;
    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      const rows = batch.map((kw: any) => {
        const keyword = (kw.keyword || "").trim().toLowerCase();
        if (!keyword) return null;

        const position = kw.position != null ? Number(kw.position) : null;
        const change = kw.change != null ? Number(kw.change) : null;
        const traffic = kw.traffic != null ? Number(kw.traffic) : null;
        const volume = kw.volume != null ? Number(kw.volume) : null;

        let status = "opportunity";
        const changeStatus = (kw.change_status || "").toUpperCase();
        if (position && position <= 3) status = "winner";
        else if (changeStatus === "LOST" || changeStatus === "DECLINED") status = "declining";
        else if (changeStatus === "IMPROVED" || changeStatus === "NEW") status = "opportunity";
        else if (changeStatus === "UNCHANGED" && position && position <= 10) status = "winner";

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

    await serviceClient
      .from("seo_domains")
      .update({ wincher_synced_at: new Date().toISOString() })
      .eq("id", domain_id);

    return { success: true, upserted, errors, total: keywords.length };
  }, { functionName: "wincher-import", wrapResult: false }),
);
