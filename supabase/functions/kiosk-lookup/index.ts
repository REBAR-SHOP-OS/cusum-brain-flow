import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  return handleRequest(req, async (ctx) => {
    const { name } = ctx.body;
    const trimmed = (name || "").trim();
    if (trimmed.length < 2) {
      return new Response(JSON.stringify({ candidates: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build fuzzy search: match any word in the input against full_name
    const words = trimmed.split(/\s+/).filter((w: string) => w.length >= 2);
    
    // Use OR conditions: full_name ILIKE '%word%' for each word
    const patterns = [
      `%${trimmed}%`,
      ...words.map((w: string) => `%${w}%`),
    ];

    // Remove duplicates
    const uniquePatterns = [...new Set(patterns)];

    // Query profiles matching any pattern
    let allMatches: any[] = [];
    const seenIds = new Set<string>();

    for (const pattern of uniquePatterns) {
      const { data } = await ctx.serviceClient
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("company_id", ctx.companyId)
        .eq("is_active", true)
        .ilike("full_name", pattern)
        .limit(10);

      if (data) {
        for (const row of data) {
          if (!seenIds.has(row.id)) {
            seenIds.add(row.id);
            allMatches.push(row);
          }
        }
      }
    }

    // Return top 5
    const candidates = allMatches.slice(0, 5).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      avatar_url: p.avatar_url,
    }));

    ctx.log.info("Lookup complete", { query: trimmed, found: candidates.length });

    return new Response(JSON.stringify({ candidates }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }, {
    functionName: "kiosk-lookup",
    requireCompany: true,
    rawResponse: true,
  });
});
