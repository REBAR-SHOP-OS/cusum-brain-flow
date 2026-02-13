import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a senior forensic accountant AI. Analyze the QuickBooks data provided and return actionable audit findings.

Return ONLY a JSON object with this exact shape:
{
  "findings": [
    {
      "id": "unique-slug",
      "type": "error" | "warning" | "info" | "success",
      "category": "Receivables" | "Payables" | "Cash Flow" | "Data Quality" | "Collections" | "Customers" | "Vendors" | "General",
      "title": "Short title with numbers/amounts",
      "description": "1-2 sentence explanation with specific advice"
    }
  ]
}

Rules:
- Use "error" for critical issues (overdue AR >$5k, possible fraud, duplicates)
- Use "warning" for attention items (aging AP, low collection rate, cash flow risk)
- Use "info" for optimization suggestions (dormant customers, vendor consolidation)
- Use "success" for areas that look healthy
- Always include dollar amounts formatted as $X,XXX.XX
- Always include a summary finding at the top
- Return 5-15 findings ordered by severity
- Be specific: name customers, amounts, dates when available
- Look for: overdue AR/AP, duplicate invoices, cash flow gaps, unusual patterns, collection efficiency, vendor concentration risk, dormant accounts`;

    const userPrompt = `Analyze this QuickBooks data:\n\n${JSON.stringify(payload, null, 2)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error(`AI gateway returned ${response.status}`);
    }

    const aiResult = await response.json();
    const raw = aiResult.choices?.[0]?.message?.content ?? "";

    // Extract JSON from possible markdown fences
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
    const parsed = JSON.parse(jsonMatch[1]!.trim());

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("qb-audit error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
