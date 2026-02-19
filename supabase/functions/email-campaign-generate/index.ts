import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI, AIError } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, company_id")
      .eq("user_id", userId)
      .single();
    if (!profile) throw new Error("Profile not found");

    const { action, campaign_type, brief, title } = await req.json();

    // Fetch brand kit for context
    const { data: brandKit } = await supabaseAdmin
      .from("brand_kit")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    // Fetch knowledge for RAG
    const { data: knowledge } = await supabaseAdmin
      .from("knowledge")
      .select("title, content")
      .limit(20);

    // Count eligible contacts
    const { count: contactCount } = await supabaseAdmin
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .not("email", "is", null);

    const brandContext = brandKit
      ? `Brand: ${brandKit.business_name}. Voice: ${brandKit.brand_voice}. Value prop: ${brandKit.value_prop}.`
      : "Brand: Rebar.Shop — steel fabrication and supply.";

    const knowledgeContext = (knowledge || [])
      .map((k: any) => `- ${k.title}: ${k.content?.substring(0, 200)}`)
      .join("\n");

    const systemPrompt = `You are an email marketing campaign planner for ${brandContext}

RULES:
- Only use facts from the KNOWLEDGE section below. If a needed fact is missing, write "[NEEDS HUMAN INPUT]".
- Never invent pricing, lead times, certifications, or policies.
- Every marketing email MUST include a CAN-SPAM compliant footer with physical address and unsubscribe link.
- Use {{unsubscribe_url}} as the unsubscribe placeholder.
- Keep subject lines under 60 characters.
- Write clear, professional, construction-industry-friendly copy.

KNOWLEDGE:
${knowledgeContext || "No knowledge entries available."}

AUDIENCE SIZE: ~${contactCount || 0} contacts with email addresses.`;

    const userPrompt = `Campaign type: ${campaign_type || "newsletter"}
Brief: ${brief || "General marketing campaign"}
${title ? `Suggested title: ${title}` : ""}

Generate a complete email campaign draft.`;

    const result = await callAI({
      provider: "gpt",
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "create_campaign_draft",
          description: "Create an email campaign draft with all required fields.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              subject_line: { type: "string" },
              preview_text: { type: "string" },
              body_html: { type: "string" },
              body_text: { type: "string" },
              segment_rules: { type: "object" },
              estimated_recipients: { type: "number" },
              scheduled_recommendation: { type: "string" },
            },
            required: ["title", "subject_line", "body_html", "body_text", "estimated_recipients"],
            additionalProperties: false,
          },
        },
      }],
      toolChoice: { type: "function", function: { name: "create_campaign_draft" } },
    });

    let draft: any;
    if (result.toolCalls.length > 0) {
      draft = JSON.parse(result.toolCalls[0].function.arguments);
    } else {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        draft = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("AI did not return a valid campaign draft");
      }
    }

    // Save to database
    const { data: campaign, error: insertErr } = await supabaseAdmin
      .from("email_campaigns")
      .insert({
        title: draft.title || title || "Untitled Campaign",
        campaign_type: campaign_type || "newsletter",
        status: "pending_approval",
        subject_line: draft.subject_line,
        preview_text: draft.preview_text || null,
        body_html: draft.body_html,
        body_text: draft.body_text || null,
        segment_rules: draft.segment_rules || {},
        estimated_recipients: draft.estimated_recipients || contactCount || 0,
        metadata: {
          ai_generated: true,
          brief,
          scheduled_recommendation: draft.scheduled_recommendation,
          variants: draft.variants,
        },
        created_by: profile.id,
        company_id: profile.company_id,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({ campaign, message: "Campaign generated and pending approval" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("email-campaign-generate error:", e);
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