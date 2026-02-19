import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();

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

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    });

    const raw = result.content;
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
    const parsed = JSON.parse(jsonMatch[1]!.trim());

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("qb-audit error:", e);
    if (e instanceof AIError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});