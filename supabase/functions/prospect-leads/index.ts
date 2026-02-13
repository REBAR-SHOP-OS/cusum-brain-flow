import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, corsHeaders, json } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userId, serviceClient } = await requireAuth(req).catch((r) => {
      if (r instanceof Response) throw r;
      throw r;
    });

    const { region } = await req.json();
    const targetRegion = region || "Ontario, Canada";

    // Get user's company_id
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("company_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.company_id) {
      return json({ error: "No company found for user" }, 400);
    }

    // Create batch record
    const { data: batch, error: batchErr } = await serviceClient
      .from("prospect_batches")
      .insert({
        created_by: userId,
        company_id: profile.company_id,
        region: targetRegion,
        status: "generating",
        prospect_count: 0,
      })
      .select("id")
      .single();

    if (batchErr || !batch) {
      console.error("Batch insert error:", batchErr);
      return json({ error: "Failed to create batch" }, 500);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ error: "AI not configured" }, 500);
    }

    const systemPrompt = `You are an expert B2B lead researcher for rebar.shop — a Canadian rebar fabrication company based in Ontario.

Your job is to generate 50 highly targeted, realistic lead prospects for rebar fabrication services in Ontario, Canada.

Target industries:
- General contractors (commercial, industrial, infrastructure)
- Structural engineering firms
- Real estate developers (commercial/industrial)
- Precast concrete companies
- Infrastructure project managers (bridges, highways, transit)
- Concrete construction companies

Geographic focus: Ontario, Canada — specifically cities like Toronto, Ottawa, Hamilton, London, Kitchener-Waterloo, Mississauga, Brampton, Markham, Vaughan, Burlington, Oshawa, Barrie, Kingston, Windsor, Sudbury, Thunder Bay, and surrounding areas.

For each prospect, provide realistic but AI-generated data:
- Company name (realistic sounding, industry-appropriate)
- Contact name (realistic full name)
- Contact title (decision-maker level: VP Construction, Project Manager, Procurement Director, etc.)
- Email (format: firstname.lastname@companydomainname.com — use realistic company domain)
- Phone (realistic format for region)
- City (real cities in target region)
- Industry vertical
- Estimated annual rebar procurement value in CAD
- Why this company is a good fit for rebar.shop
- A specific angle for introducing rebar.shop to them

Make prospects diverse across industries, cities, and company sizes. Include both large firms and mid-market companies.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate exactly 50 lead prospects for rebar fabrication services in ${targetRegion}. Return them using the tool.` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_prospects",
              description: "Return an array of 50 lead prospects",
              parameters: {
                type: "object",
                properties: {
                  prospects: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        company_name: { type: "string" },
                        contact_name: { type: "string" },
                        contact_title: { type: "string" },
                        email: { type: "string" },
                        phone: { type: "string" },
                        city: { type: "string" },
                        industry: { type: "string" },
                        estimated_value: { type: "number", description: "Annual rebar procurement value in CAD" },
                        fit_reason: { type: "string" },
                        intro_angle: { type: "string" },
                      },
                      required: ["company_name", "contact_name", "contact_title", "email", "city", "industry", "fit_reason", "intro_angle"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["prospects"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_prospects" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      // Update batch as failed
      await serviceClient.from("prospect_batches").update({ status: "archived" }).eq("id", batch.id);

      if (response.status === 429) {
        return json({ error: "Rate limited — please try again in a minute" }, 429);
      }
      if (response.status === 402) {
        return json({ error: "AI credits exhausted — please add credits" }, 402);
      }
      return json({ error: "AI generation failed" }, 500);
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let prospects: any[] = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        prospects = parsed.prospects || [];
      } catch {
        console.error("Failed to parse AI response");
      }
    }

    if (prospects.length === 0) {
      await serviceClient.from("prospect_batches").update({ status: "archived" }).eq("id", batch.id);
      return json({ error: "AI returned no prospects" }, 500);
    }

    // Insert all prospects
    const rows = prospects.map((p: any) => ({
      batch_id: batch.id,
      company_name: p.company_name,
      contact_name: p.contact_name,
      contact_title: p.contact_title || null,
      email: p.email || null,
      phone: p.phone || null,
      city: p.city || null,
      industry: p.industry || null,
      estimated_value: p.estimated_value || null,
      fit_reason: p.fit_reason || null,
      intro_angle: p.intro_angle || null,
      status: "pending",
      company_id: profile.company_id,
    }));

    const { error: insertErr } = await serviceClient.from("prospects").insert(rows);
    if (insertErr) {
      console.error("Prospect insert error:", insertErr);
      await serviceClient.from("prospect_batches").update({ status: "archived" }).eq("id", batch.id);
      return json({ error: "Failed to save prospects" }, 500);
    }

    // Update batch status
    await serviceClient.from("prospect_batches").update({
      status: "ready",
      prospect_count: prospects.length,
    }).eq("id", batch.id);

    return json({ batchId: batch.id, count: prospects.length });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("prospect-leads error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
