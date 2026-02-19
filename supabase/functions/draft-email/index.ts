import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, corsHeaders } from "../_shared/auth.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let rateLimitId: string;
    let userName = "Team Member";
    let userTitle = "";

    try {
      const auth = await requireAuth(req);
      rateLimitId = auth.userId;

      const svcClient2 = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data: profile } = await svcClient2
        .from("profiles")
        .select("full_name, title")
        .eq("user_id", rateLimitId)
        .maybeSingle();
      if (profile?.full_name) userName = profile.full_name;
      if (profile?.title) userTitle = profile.title;
    } catch (res) {
      if (res instanceof Response) return res;
      throw res;
    }

    const svcClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: allowed } = await svcClient.rpc("check_rate_limit", {
      _user_id: rateLimitId,
      _function_name: "draft-email",
      _max_requests: 20,
      _window_seconds: 60,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action || "draft";
    const titleLine = userTitle ? ` (${userTitle})` : "";

    // Helper: all draft-email calls use GPT-4o-mini (customer-facing writing, fast)
    async function aiCall(systemPrompt: string, userPrompt: string, opts?: { maxTokens?: number; temperature?: number }) {
      const result = await callAI({
        provider: "gpt",
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        maxTokens: opts?.maxTokens || 800,
        temperature: opts?.temperature ?? 0.4,
      });
      return result.content;
    }

    // ─── Action: quick-replies ──────────────────────────────────────
    if (action === "quick-replies") {
      const { emailSubject, emailBody, senderName } = body;
      const raw = await aiCall(
        `You generate 3 short, contextually appropriate email reply suggestions. Each suggestion should be 5-15 words. Return ONLY a JSON array of 3 strings, nothing else. Example: ["Thanks, got it!", "Let me check and get back to you.", "Sounds good, let's proceed."]`,
        `Email from ${senderName}:\nSubject: ${emailSubject}\n\n${emailBody}\n\nGenerate 3 short reply suggestions as a JSON array.`,
        { maxTokens: 300, temperature: 0.7 }
      );
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      let replies: string[] = [];
      try { replies = JSON.parse(jsonMatch?.[0] || "[]"); } catch { replies = ["Thanks, got it!", "Let me check on this.", "Sounds good!"]; }
      return new Response(JSON.stringify({ replies: replies.slice(0, 3) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: summarize-email ────────────────────────────────────
    if (action === "summarize-email") {
      const { emailSubject, emailBody, senderName } = body;
      const summary = await aiCall(
        `You summarize emails into 2-3 concise bullet points. Each bullet should be one sentence. Focus on action items and key information. Return ONLY the bullet points, each starting with "• ".`,
        `Summarize this email:\n\nFrom: ${senderName}\nSubject: ${emailSubject}\n\n${emailBody}`,
        { maxTokens: 400, temperature: 0.3 }
      );
      return new Response(JSON.stringify({ summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: polish ───────────────────────────────────────────
    if (action === "polish") {
      const { draftText } = body;
      const polished = await aiCall(
        "You are an email editor. Polish the following email draft: fix grammar, tighten phrasing, improve clarity. Do NOT change the meaning, tone, or intent. Return ONLY the polished text.",
        draftText,
        { temperature: 0.3 }
      );
      return new Response(JSON.stringify({ draft: polished || draftText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: prompt-to-draft ────────────────────────────────────
    if (action === "prompt-to-draft") {
      const { prompt, recipientName, emailSubject } = body;
      const draft = await aiCall(
        `You are Cassie, an AI email assistant for ${userName}${titleLine} at Rebar.Shop (Ontario Rebars Ltd.). Write a complete email body from a short prompt. Be professional and concise. Sign off with "Best regards,\\n${userName}". Return ONLY the email body text.`,
        `Write an email${recipientName ? ` to ${recipientName}` : ""}${emailSubject ? ` about: ${emailSubject}` : ""}.\n\nWhat I want to say: ${prompt}`
      );
      return new Response(JSON.stringify({ draft }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: adjust-tone ────────────────────────────────────────
    if (action === "adjust-tone") {
      const { draftText, tone } = body;
      const toneInstructions: Record<string, string> = {
        formal: "Rewrite the following email draft in a formal, professional tone. Keep the same meaning and information.",
        casual: "Rewrite the following email draft in a casual, friendly tone. Keep the same meaning and information.",
        shorter: "Rewrite the following email draft to be more concise. Cut unnecessary words while keeping all key information.",
        longer: "Expand the following email draft with more detail and context. Add appropriate professional pleasantries.",
        friendly: "Rewrite the following email draft in a warm, friendly tone. Keep the same meaning but make it personable and approachable.",
        urgent: "Rewrite the following email draft with an urgent, action-oriented tone. Emphasize deadlines and importance. Keep the same meaning.",
      };
      const instruction = toneInstructions[tone] || toneInstructions.formal;
      const adjusted = await aiCall(`${instruction} Return ONLY the rewritten text, nothing else.`, draftText);
      return new Response(JSON.stringify({ draft: adjusted || draftText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: draft (default) ────────────────────────────────────
    const { emailSubject, emailBody, senderName, senderEmail } = body;
    const draft = await aiCall(
      `You are Cassie, an AI email assistant for a rebar/steel manufacturing company called Rebar.Shop (Ontario Rebars Ltd.). 
You draft professional, concise email replies on behalf of ${userName}${titleLine}.

Guidelines:
- Keep replies short and professional
- Match the tone of the original email
- Be direct and helpful
- Sign off with "Best regards,\\n${userName}"
- Don't add unnecessary pleasantries
- If it's a support/technical email, acknowledge the information and state next steps
- If it's a sales/marketing email, politely decline or express interest based on context
- If it's a notification/automated email, suggest a brief acknowledgment or skip reply
- Do NOT include any email signature block — the system will add it automatically`,
      `Draft a reply to this email:\n\nFrom: ${senderName} <${senderEmail}>\nSubject: ${emailSubject}\n\nEmail content:\n${emailBody}\n\nWrite only the reply text, no subject line or email headers.`
    );

    return new Response(JSON.stringify({ draft }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("draft-email error:", error);
    const status = error instanceof AIError ? error.status : 500;
    return new Response(JSON.stringify({ error: error.message || "Failed to generate draft" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
