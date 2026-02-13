import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth, corsHeaders } from "../_shared/auth.ts";

// ... keep existing code (systemPrompt, buildLeadContext, callAI, extractToolResult)

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth guard
    try { await requireAuth(req); } catch (res) { if (res instanceof Response) return res; throw res; }

    const body = await req.json();
    const { lead, activities, action, userMessage, pipelineStats, auditType } = body;

    // ── pipeline_audit (no lead context needed) ──
    // Odoo has been decommissioned — pipeline data now comes from ERP database only
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
      const prompt = `Draft a brief, professional follow-up email for this lead:\n\n${context}\n\nWrite a short, warm follow-up email (3-5 sentences) from the rebar.shop sales team. Be professional but not overly formal. Reference the specific project if possible.`;
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
      const prompt = `Draft a professional email for this lead. The user wants: ${userMessage || "a general check-in email"}.\n\n${context}\n\nWrite the email from the rebar.shop sales team.`;
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
