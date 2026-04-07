import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Invalid token");

    const body = await req.json().catch(() => ({}));
    const dateStr = body.date || new Date().toISOString().split("T")[0];

    // Build full context
    const { buildFullVizzyContext } = await import("../_shared/vizzyFullContext.ts");
    const contextText = await buildFullVizzyContext(supabase, user.id);

    // Call AI to generate comprehensive report
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a senior business analyst writing a comprehensive Daily Operations Report for REBAR SHOP, a rebar fabrication company. 
Write a LONG, DETAILED report (3000-5000 words) covering EVERY department. Use ONLY the real data provided — never fabricate numbers.

Format the report in clean HTML sections. Use these exact section headers:
1. EXECUTIVE SUMMARY — Key highlights, risks, and wins in 3-5 bullet points
2. TEAM & ATTENDANCE — Who clocked in/out, hours worked, who's absent
3. FINANCIAL HEALTH — AR, AP, overdue invoices, recent payments, cash flow status
4. PRODUCTION — Machine runs, cut plans, queue items, output quantities, operator performance
5. SALES PIPELINE — Open leads, hot deals, conversion rates, follow-up needed
6. CUSTOMER COMMUNICATIONS — Emails received, calls made/received, unanswered items
7. DELIVERIES & LOGISTICS — Scheduled deliveries, in-transit, completed
8. AI AGENT ACTIVITY — Which agents were used, session counts, key actions
9. ERP SYSTEM ACTIVITY — User actions, page views, mutations by department
10. RED FLAGS & RECOMMENDATIONS — Issues needing immediate attention, suggestions

Rules:
- Use real numbers from the data, formatted as currency where applicable
- Include specific employee names, customer names, amounts
- If a section has no data, state "No activity recorded for this period"
- Write in professional business English
- Use bullet points and sub-sections for readability
- DO NOT wrap output in markdown code fences — output raw HTML only`
          },
          {
            role: "user",
            content: `Generate the Daily Operations Report for ${dateStr}.\n\nHere is all operational data:\n\n${contextText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI generation failed (${aiResponse.status})`);
    }

    const aiData = await aiResponse.json();
    const reportContent = aiData.choices?.[0]?.message?.content || "Report generation failed.";

    // Build full HTML document
    const htmlDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Daily Operations Report — ${dateStr}</title>
<style>
  @page { margin: 1in; size: letter; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; background: #fff; }
  .header { text-align: center; border-bottom: 3px solid #1a56db; padding-bottom: 20px; margin-bottom: 30px; }
  .header h1 { font-size: 28px; color: #1a56db; margin-bottom: 5px; }
  .header .subtitle { font-size: 14px; color: #666; }
  .header .date { font-size: 18px; font-weight: 600; color: #333; margin-top: 8px; }
  h2 { font-size: 18px; color: #1a56db; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin: 30px 0 15px; page-break-after: avoid; }
  h3 { font-size: 15px; color: #374151; margin: 15px 0 8px; }
  p { margin-bottom: 10px; font-size: 14px; }
  ul, ol { margin: 8px 0 15px 25px; font-size: 14px; }
  li { margin-bottom: 5px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0 20px; font-size: 13px; }
  th { background: #f3f4f6; text-align: left; padding: 8px 12px; border: 1px solid #d1d5db; font-weight: 600; }
  td { padding: 6px 12px; border: 1px solid #d1d5db; }
  tr:nth-child(even) { background: #f9fafb; }
  .highlight { background: #fef3c7; padding: 2px 6px; border-radius: 3px; }
  .red-flag { color: #dc2626; font-weight: 600; }
  .footer { margin-top: 40px; padding-top: 15px; border-top: 2px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
<div class="header">
  <h1>🏭 REBAR SHOP — Daily Operations Report</h1>
  <div class="date">${dateStr}</div>
  <div class="subtitle">Generated on ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC</div>
</div>

${reportContent}

<div class="footer">
  <p>REBAR SHOP Operations Intelligence — Confidential</p>
  <p>Auto-generated by Vizzy AI • ${dateStr}</p>
</div>
</body>
</html>`;

    // Upload to storage
    const fileName = `daily-report-${dateStr}-${Date.now()}.html`;
    const { error: uploadError } = await supabase.storage
      .from("invoice-pdfs")
      .upload(fileName, new TextEncoder().encode(htmlDoc), {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw new Error("Failed to upload report");
    }

    // Generate signed URL (30 days)
    const { data: signedData, error: signedError } = await supabase.storage
      .from("invoice-pdfs")
      .createSignedUrl(fileName, 60 * 60 * 24 * 30);

    if (signedError || !signedData?.signedUrl) {
      throw new Error("Failed to generate download URL");
    }

    return new Response(JSON.stringify({ url: signedData.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-daily-report-pdf error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
