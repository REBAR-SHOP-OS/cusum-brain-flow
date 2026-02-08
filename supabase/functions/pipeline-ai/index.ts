import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead, activities, action } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are Blitz, the AI Sales Assistant for REBAR SHOP OS — a rebar fabrication company. You help sales teams manage their pipeline, follow up with customers, and close deals faster.

You understand:
- Construction industry sales cycles (RFQs, estimations, shop drawings, approvals)
- Rebar/steel fabrication terminology
- Canadian construction market

When analyzing a lead, consider:
1. Current stage and how long it's been there
2. Deal value and probability
3. Recent activity (or lack thereof)
4. Customer relationship history
5. Industry-standard follow-up timing

Always be actionable and specific. Suggest concrete next steps with timing.`;

    if (action === "suggest_actions") {
      const leadAge = lead.created_at ? Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000) : 0;
      const daysSinceUpdate = lead.updated_at ? Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000) : 0;
      const recentActivities = (activities || []).slice(0, 10).map((a: any) => 
        `[${a.activity_type}] ${a.title} - ${a.created_at}`
      ).join("\n");

      const prompt = `Analyze this lead and suggest 3-5 specific next actions:

LEAD: ${lead.title}
CUSTOMER: ${lead.customer_name || "Unknown"}
STAGE: ${lead.stage}
PRIORITY: ${lead.priority || "medium"}
VALUE: $${lead.expected_value || 0}
PROBABILITY: ${lead.probability || 0}%
AGE: ${leadAge} days
DAYS SINCE UPDATE: ${daysSinceUpdate} days
NOTES: ${lead.notes || "None"}
DESCRIPTION: ${lead.description || "None"}

RECENT ACTIVITY:
${recentActivities || "No activity recorded yet"}

Suggest specific, actionable next steps. For each, indicate:
- Action type (call, email, meeting, internal_task, follow_up)
- Priority (high, medium, low)  
- Suggested timing (today, tomorrow, this_week, next_week)
- Brief reason why`;

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
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "suggest_actions",
              description: "Return suggested next actions for the sales lead",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "One-sentence assessment of lead health" },
                  urgency: { type: "string", enum: ["critical", "high", "medium", "low"] },
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        action_type: { type: "string", enum: ["call", "email", "meeting", "internal_task", "follow_up", "stage_change"] },
                        title: { type: "string" },
                        description: { type: "string" },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                        timing: { type: "string", enum: ["today", "tomorrow", "this_week", "next_week"] },
                      },
                      required: ["action_type", "title", "description", "priority", "timing"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "urgency", "suggestions"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "suggest_actions" } },
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please top up." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const text = await response.text();
        console.error("AI error:", status, text);
        throw new Error("AI gateway error");
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const result = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fallback: return the raw content
      return new Response(JSON.stringify({ 
        summary: data.choices?.[0]?.message?.content || "Unable to analyze",
        urgency: "medium",
        suggestions: [] 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "draft_followup") {
      const prompt = `Draft a brief, professional follow-up email for this lead:

LEAD: ${lead.title}
CUSTOMER: ${lead.customer_name || "Unknown"}
STAGE: ${lead.stage}
CONTEXT: ${lead.notes || lead.description || "No additional context"}

Write a short, warm follow-up email (3-5 sentences) from the rebar.shop sales team. Be professional but not overly formal. Reference the specific project if possible.`;

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
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error("AI gateway error");
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ draft: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pipeline-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
