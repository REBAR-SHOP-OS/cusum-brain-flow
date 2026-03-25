import { handleRequest } from "../_shared/requestHandler.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: supabaseAdmin, body } = ctx;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, company_id")
      .eq("user_id", userId)
      .single();
    if (!profile) throw new Error("Profile not found");

    const { action, campaign_type, brief, title } = body;

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
      agentName: "email",
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

    return { campaign, message: "Campaign generated and pending approval" };
  }, { functionName: "email-campaign-generate", requireCompany: false, wrapResult: false })
);
