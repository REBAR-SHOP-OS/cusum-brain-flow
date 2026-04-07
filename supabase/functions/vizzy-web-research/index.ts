import { handleRequest } from "../_shared/requestHandler.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body, log }) => {
    const { query, limit } = body;
    if (!query || typeof query !== "string") {
      throw new Error("query string is required");
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) throw new Error("Firecrawl connector not configured");

    const searchLimit = Math.min(limit || 5, 10);

    log.info("Web research query", { query, limit: searchLimit });

    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: searchLimit,
        scrapeOptions: { formats: ["markdown"] },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Firecrawl search failed (${response.status})`);
    }

    // Summarize results for Vizzy — keep it concise
    const results = (data.data || []).map((r: any) => ({
      title: r.title || "Untitled",
      url: r.url,
      snippet: (r.markdown || r.description || "").slice(0, 500),
    }));

    return { results, query, count: results.length };
  }, { functionName: "vizzy-web-research", requireCompany: false, wrapResult: false })
);
