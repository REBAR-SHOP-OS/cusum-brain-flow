import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIM = 768;

async function generateQueryEmbedding(apiKey: string, text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: text.slice(0, 2048) }] },
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: EMBEDDING_DIM,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding API error: ${response.status} — ${errText}`);
  }

  const data = await response.json();
  return data.embedding.values;
}

Deno.serve((req) =>
  handleRequest(req, async ({ body, serviceClient }) => {
    const { query, domain, companyId, matchCount, threshold } = body;
    if (!query) {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");

    const queryEmbedding = await generateQueryEmbedding(geminiKey, query);

    const { data, error } = await serviceClient.rpc("match_documents", {
      query_embedding: `[${queryEmbedding.join(",")}]`,
      match_count: matchCount || 5,
      filter_company_id: companyId || null,
    });

    if (error) {
      console.error("Search error:", error);
      throw new Error("Search failed: " + error.message);
    }

    return { results: data || [], count: data?.length || 0, query, domain };
  }, { functionName: "search-embeddings", authMode: "none", requireCompany: false, wrapResult: false })
);
