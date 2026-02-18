import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, corsHeaders } from "../_shared/auth.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

const systemPrompt = `You are Blitz, an AI sales assistant for rebar.shop — a Canadian rebar fabrication company.
You help sales reps manage their pipeline, draft communications, score leads, and recommend actions.
Be concise, professional, and data-driven. Format numbers clearly. Use metric units (tonnes, mm).
When drafting emails, write from the perspective of the rebar.shop sales team.`;

function buildLeadContext(lead: any, activities?: any[]): string {
  const parts: string[] = [];
  parts.push(`Lead: ${lead.title || "Untitled"}`);
  if (lead.customer_name) parts.push(`Customer: ${lead.customer_name}`);
  if (lead.stage) parts.push(`Stage: ${lead.stage}`);
  if (lead.priority) parts.push(`Priority: ${lead.priority}`);
  if (lead.probability != null) parts.push(`Probability: ${lead.probability}%`);
  if (lead.expected_revenue) parts.push(`Expected Revenue: $${Number(lead.expected_revenue).toLocaleString()}`);
  if (lead.source) parts.push(`Source: ${lead.source}`);
  if (lead.notes) parts.push(`Notes: ${lead.notes}`);
  if (lead.created_at) parts.push(`Created: ${lead.created_at}`);
  if (lead.next_action_date) parts.push(`Next Action: ${lead.next_action_date}`);
  if (lead.assigned_to) parts.push(`Assigned To: ${lead.assigned_to}`);

  if (activities && activities.length > 0) {
    parts.push("\nRecent Activities:");
    for (const a of activities.slice(0, 10)) {
      parts.push(`- [${a.event_type}] ${a.description || ""} (${a.created_at})`);
    }
  }

  return parts.join("\n");
}

async function callAI(messages: any[], tools?: any[], toolChoice?: any): Promise<any> {
  const body: any = {
    model: "gemini-2.5-flash",
    messages,
    temperature: 0.7,
  };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI API error ${res.status}: ${text}`);
  }
  return res.json();
}

function extractToolResult(data: any): any | null {
  const msg = data.choices?.[0]?.message;
  if (msg?.tool_calls?.[0]?.function?.arguments) {
    try {
      return JSON.parse(msg.tool_calls[0].function.arguments);
    } catch { return null; }
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth guard
    try { await requireAuth(req); } catch (res) { if (res instanceof Response) return res; throw res; }

    const body = await req.json();
    const { lead, activities, action, userMessage, pipelineStats, auditType } = body;

    // ── pipeline_audit (no lead context needed) ──
    // Pipeline data includes Odoo-synced leads (source: odoo_sync) with metadata fields
    const odooSnapshot = "";

    if (action === "pipeline_audit") {
      const auditSystemPrompt = `${systemPrompt}

You are now acting as a Sales Accountability Partner. Your job is to hold the sales team accountable by identifying gaps, flagging risks, and recommending specific actions with deadlines and owner assignments.

Be direct, data-driven, and constructive. Use tables and bullet points. Flag critical issues first.

${odooSnapshot}`;

      let auditPromptBody = "";
      const statsJson = JSON.stringify(pipelineStats || {}, null, 2);

      switch (auditType) {
        case "pipeline_audit":
          auditPromptBody = `Run a full pipeline audit. Current pipeline stats:\n\n${statsJson}\n\nProvide: 1) Executive summary 2) Critical issues (stale leads, missing follow-ups) 3) Salesperson accountability breakdown 4) Top 5 recommended actions with owners and deadlines.`;
          break;
        case "stale_report":
          auditPromptBody = `Generate a stale leads report. Stats:\n\n${statsJson}\n\nList stale leads (5+ days without update), grouped by salesperson. For each, suggest specific action and deadline.`;
          break;
        case "followup_gaps":
          auditPromptBody = `Identify follow-up gaps in the pipeline. Stats:\n\n${statsJson}\n\nFlag leads missing follow-ups, leads stuck too long in a stage, and salespersons with the most gaps.`;
          break;
        case "revenue_forecast":
          auditPromptBody = `Generate a revenue forecast. Stats:\n\n${statsJson}\n\nShow weighted pipeline value, best/worst case, highlight risks. Suggest actions to improve close rates.`;
          break;
        case "salesperson_report":
          auditPromptBody = `Generate a team performance report. Stats:\n\n${statsJson}\n\nRank salespersons by: total leads, stale leads, pipeline value. Identify top performer and who needs coaching.`;
          break;
        case "custom_question":
          auditPromptBody = `User asks about the pipeline. Stats:\n\n${statsJson}\n\nQuestion: ${userMessage || "Give me a pipeline overview."}\n\nAnswer with data. Be specific and actionable.`;
          break;
        default:
          auditPromptBody = `Analyze this pipeline. Stats:\n\n${statsJson}\n\n${userMessage || "Provide an overview with key recommendations."}`;
      }

      const data = await callAI([
        { role: "system", content: auditSystemPrompt },
        { role: "user", content: auditPromptBody },
      ]);

      const answer = data.choices?.[0]?.message?.content || "Unable to generate report.";
      return new Response(JSON.stringify({ answer }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const context = buildLeadContext(lead, activities);
    const enrichedSystemPrompt = `${systemPrompt}\n\n${odooSnapshot}`;

    // ── suggest_actions ──
    if (action === "suggest_actions") {
      const prompt = `Analyze this lead and suggest 3-5 specific next actions:\n\n${context}\n\nSuggest specific, actionable next steps. For each, indicate action type, priority, timing, and reason.`;
      const data = await callAI(
        [{ role: "system", content: enrichedSystemPrompt }, { role: "user", content: prompt }],
        [{
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
        { type: "function", function: { name: "suggest_actions" } }
      );

      const result = extractToolResult(data) || {
        summary: data.choices?.[0]?.message?.content || "Unable to analyze",
        urgency: "medium",
        suggestions: [],
      };

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── draft_followup ──
    if (action === "draft_followup") {
      const prompt = `Draft a brief, professional follow-up email for this lead:\n\n${context}\n\nAdditional context from user: ${userMessage || ""}\n\nCRITICAL RULES:\n1. NEVER use placeholder text like [Sales Rep Name], [Your Name], [Company Name], or any bracketed tokens. NEVER.\n2. Address the recipient by their FIRST NAME ONLY (e.g., "Hi Sarah,").\n3. Reference the previous introduction and their specific company/project.\n4. Keep to 3-5 sentences. Be warm but direct — no filler like "I hope this finds you well".\n5. End with a soft call to action.\n6. Sign off EXACTLY as: "Best regards,\\nThe rebar.shop Sales Team"\n7. Do NOT include any sender name other than "The rebar.shop Sales Team".`;
      const data = await callAI(
        [{ role: "system", content: enrichedSystemPrompt }, { role: "user", content: prompt }],
        [{
          type: "function",
          function: {
            name: "draft_email_result",
            description: "Return a drafted email",
            parameters: {
              type: "object",
              properties: {
                subject: { type: "string" },
                body: { type: "string" },
                tone: { type: "string" },
              },
              required: ["subject", "body", "tone"],
              additionalProperties: false,
            },
          },
        }],
        { type: "function", function: { name: "draft_email_result" } }
      );

      const result = extractToolResult(data) || { subject: "", body: data.choices?.[0]?.message?.content || "", tone: "professional" };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── draft_email ──
    if (action === "draft_email") {
      const prompt = `Draft a professional email for this lead. The user wants: ${userMessage || "a general check-in email"}.\n\n${context}\n\nCRITICAL RULES:\n1. NEVER use placeholder text like [Sales Rep Name], [Your Name], [Company Name], or any bracketed tokens. NEVER.\n2. Address the recipient by their FIRST NAME ONLY (e.g., "Hi Sarah,").\n3. Keep the email concise (3-5 sentences). Be warm but direct.\n4. Sign off EXACTLY as: "Best regards,\\nThe rebar.shop Sales Team"\n5. Do NOT include any sender name other than "The rebar.shop Sales Team".`;
      const data = await callAI(
        [{ role: "system", content: enrichedSystemPrompt }, { role: "user", content: prompt }],
        [{
          type: "function",
          function: {
            name: "draft_email_result",
            description: "Return a drafted email with subject, body, and tone",
            parameters: {
              type: "object",
              properties: {
                subject: { type: "string" },
                body: { type: "string" },
                tone: { type: "string" },
              },
              required: ["subject", "body", "tone"],
              additionalProperties: false,
            },
          },
        }],
        { type: "function", function: { name: "draft_email_result" } }
      );

      const result = extractToolResult(data) || { subject: "", body: data.choices?.[0]?.message?.content || "", tone: "professional" };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── score_lead ──
    if (action === "score_lead") {
      const prompt = `Score this lead from 0-100 based on likelihood to close and deal quality:\n\n${context}\n\nConsider: deal size, stage progression, activity recency, priority, probability, and time in pipeline.`;
      const data = await callAI(
        [{ role: "system", content: enrichedSystemPrompt }, { role: "user", content: prompt }],
        [{
          type: "function",
          function: {
            name: "score_lead_result",
            description: "Return a lead score with reasoning",
            parameters: {
              type: "object",
              properties: {
                score: { type: "number", description: "Score from 0-100" },
                factors: { type: "array", items: { type: "string" }, description: "Key scoring factors" },
                recommendation: { type: "string", description: "What to do based on score" },
              },
              required: ["score", "factors", "recommendation"],
              additionalProperties: false,
            },
          },
        }],
        { type: "function", function: { name: "score_lead_result" } }
      );

      const result = extractToolResult(data) || { score: 50, factors: [], recommendation: "Unable to analyze" };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── set_reminder ──
    if (action === "set_reminder") {
      const prompt = `Suggest the best reminder/follow-up timing for this lead:\n\n${context}\n\nSuggest a specific date (YYYY-MM-DD), a brief reminder message, and priority level.`;
      const data = await callAI(
        [{ role: "system", content: enrichedSystemPrompt }, { role: "user", content: prompt }],
        [{
          type: "function",
          function: {
            name: "set_reminder_result",
            description: "Return a suggested reminder with date, message, and priority",
            parameters: {
              type: "object",
              properties: {
                suggested_date: { type: "string", description: "YYYY-MM-DD format" },
                message: { type: "string", description: "Reminder message" },
                priority: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["suggested_date", "message", "priority"],
              additionalProperties: false,
            },
          },
        }],
        { type: "function", function: { name: "set_reminder_result" } }
      );

      const result = extractToolResult(data) || { suggested_date: "", message: "Follow up on lead", priority: "medium" };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── recommend_stage ──
    if (action === "recommend_stage") {
      const prompt = `Analyze this lead and recommend whether it should be moved to a different pipeline stage:\n\n${context}\n\nAvailable stages: new, qualified, proposal, negotiation, won, lost. Suggest the best stage and explain why.`;
      const data = await callAI(
        [{ role: "system", content: enrichedSystemPrompt }, { role: "user", content: prompt }],
        [{
          type: "function",
          function: {
            name: "recommend_stage_result",
            description: "Return a stage recommendation",
            parameters: {
              type: "object",
              properties: {
                current: { type: "string" },
                recommended: { type: "string" },
                reason: { type: "string" },
                confidence: { type: "number", description: "0-100 confidence" },
              },
              required: ["current", "recommended", "reason", "confidence"],
              additionalProperties: false,
            },
          },
        }],
        { type: "function", function: { name: "recommend_stage_result" } }
      );

      const result = extractToolResult(data) || { current: lead.stage, recommended: lead.stage, reason: "Unable to analyze", confidence: 0 };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── generate_quote ──
    if (action === "generate_quote") {
      const prompt = `Based on this lead's context, generate a draft quotation with line items:\n\n${context}\n\nGenerate realistic rebar fabrication line items based on the project context. Include bar sizes, quantities, and pricing typical for Canadian rebar fabrication.`;
      const data = await callAI(
        [{ role: "system", content: enrichedSystemPrompt }, { role: "user", content: prompt }],
        [{
          type: "function",
          function: {
            name: "generate_quote_result",
            description: "Return quotation line items",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      description: { type: "string" },
                      quantity: { type: "number" },
                      unit: { type: "string" },
                      unit_price: { type: "number" },
                      total: { type: "number" },
                    },
                    required: ["description", "quantity", "unit", "unit_price", "total"],
                    additionalProperties: false,
                  },
                },
                notes: { type: "string" },
                validity_days: { type: "number" },
              },
              required: ["items", "notes", "validity_days"],
              additionalProperties: false,
            },
          },
        }],
        { type: "function", function: { name: "generate_quote_result" } }
      );

      const result = extractToolResult(data) || { items: [], notes: "Unable to generate", validity_days: 30 };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // ── draft_intro (cold introduction for AI prospects) ──
    if (action === "draft_intro") {
      const prompt = `Draft a cold introduction email for this prospect:\n\n${context}\n\nAdditional context from user: ${userMessage || ""}\n\nCRITICAL RULES:\n1. NEVER use placeholder text like [Sales Rep Name], [Your Name], [Company Name], or any bracketed tokens. NEVER.\n2. Address the recipient by their FIRST NAME ONLY (e.g., "Hi Sarah,").\n3. Open with a specific observation about their company or industry.\n4. Keep to 3-4 sentences max in the body. Be warm but direct — no filler like "I hope this finds you well".\n5. End with a soft call to action (e.g., "Would you be open to a brief conversation?").\n6. Sign off EXACTLY as: "Best regards,\\nThe rebar.shop Sales Team"\n7. Do NOT include any sender name other than "The rebar.shop Sales Team".`;
      const data = await callAI(
        [{ role: "system", content: enrichedSystemPrompt }, { role: "user", content: prompt }],
        [{
          type: "function",
          function: {
            name: "draft_email_result",
            description: "Return a drafted introduction email",
            parameters: {
              type: "object",
              properties: {
                subject: { type: "string" },
                body: { type: "string" },
                tone: { type: "string" },
              },
              required: ["subject", "body", "tone"],
              additionalProperties: false,
            },
          },
        }],
        { type: "function", function: { name: "draft_email_result" } }
      );

      const result = extractToolResult(data) || { subject: "", body: data.choices?.[0]?.message?.content || "", tone: "professional" };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── autopilot_scan ──
    if (action === "autopilot_scan") {
      const statsJson = JSON.stringify(pipelineStats || {}, null, 2);
      const scanPrompt = `You are analyzing the entire pipeline to identify leads that need attention. Stats:\n\n${statsJson}\n\nFor each lead that needs action, return a suggestion. Focus on:\n1. Stale leads (no update in 7+ days) → flag_stale\n2. Leads stuck too long in estimation stages → move_stage\n3. Hot leads without recent follow-up → send_followup\n4. Leads with no activity scheduled → set_reminder\n5. Leads that should be scored/re-scored → score_update\n\nReturn the top 10 most important suggestions.`;

      const data = await callAI(
        [{ role: "system", content: enrichedSystemPrompt }, { role: "user", content: scanPrompt }],
        [{
          type: "function",
          function: {
            name: "autopilot_suggestions",
            description: "Return AI autopilot suggestions for pipeline leads",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      lead_id: { type: "string", description: "UUID of the lead" },
                      action_type: { type: "string", enum: ["move_stage", "send_followup", "set_reminder", "flag_stale", "score_update"] },
                      priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
                      reasoning: { type: "string", description: "Why this action is suggested" },
                      suggested_data: { type: "object", description: "Additional data like target_stage, email_draft, score, etc." },
                    },
                    required: ["lead_id", "action_type", "priority", "reasoning"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["suggestions"],
              additionalProperties: false,
            },
          },
        }],
        { type: "function", function: { name: "autopilot_suggestions" } }
      );

      const result = extractToolResult(data) || { suggestions: [] };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── analyze (free-form) ──
    if (action === "analyze") {
      const prompt = `The user asks about this lead:\n\n${context}\n\nUser question: ${userMessage || "Give me a full analysis of this lead."}\n\nProvide a thorough, actionable answer. Use markdown formatting.`;
      const data = await callAI(
        [{ role: "system", content: enrichedSystemPrompt }, { role: "user", content: prompt }]
      );

      const content = data.choices?.[0]?.message?.content || "Unable to analyze this lead.";
      return new Response(JSON.stringify({ answer: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("pipeline-ai error:", e);
    const status = e?.status || 500;
    const message = e?.message || (e instanceof Error ? e.message : "Unknown error");
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
