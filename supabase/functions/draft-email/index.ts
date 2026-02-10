import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, corsHeaders } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth guard — enforce authentication + get user profile
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const titleLine = userTitle ? ` (${userTitle})` : "";

    // ─── Action: quick-replies ──────────────────────────────────────
    if (action === "quick-replies") {
      const { emailSubject, emailBody, senderName } = body;
      const systemPrompt = `You generate 3 short, contextually appropriate email reply suggestions. Each suggestion should be 5-15 words. Return ONLY a JSON array of 3 strings, nothing else. Example: ["Thanks, got it!", "Let me check and get back to you.", "Sounds good, let's proceed."]`;
      const userPrompt = `Email from ${senderName}:\nSubject: ${emailSubject}\n\n${emailBody}\n\nGenerate 3 short reply suggestions as a JSON array.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || "[]";
      // Extract JSON array from response
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      let replies: string[] = [];
      try {
        replies = JSON.parse(jsonMatch?.[0] || "[]");
      } catch {
        replies = ["Thanks, got it!", "Let me check on this.", "Sounds good!"];
      }

      return new Response(JSON.stringify({ replies: replies.slice(0, 3) }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: summarize-email ────────────────────────────────────
    if (action === "summarize-email") {
      const { emailSubject, emailBody, senderName } = body;
      const systemPrompt = `You summarize emails into 2-3 concise bullet points. Each bullet should be one sentence. Focus on action items and key information. Return ONLY the bullet points, each starting with "• ".`;
      const userPrompt = `Summarize this email:\n\nFrom: ${senderName}\nSubject: ${emailSubject}\n\n${emailBody}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 400,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ summary }), {
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
      };

      const instruction = toneInstructions[tone] || toneInstructions.formal;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            { role: "system", content: `${instruction} Return ONLY the rewritten text, nothing else.` },
            { role: "user", content: draftText },
          ],
          max_tokens: 800,
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI gateway error:", response.status, errorText);
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const data = await response.json();
      const adjusted = data.choices?.[0]?.message?.content || draftText;

      return new Response(JSON.stringify({ draft: adjusted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Action: draft (default — existing behavior) ────────────────
    const { emailSubject, emailBody, senderName, senderEmail } = body;

    const systemPrompt = `You are Cassie, an AI email assistant for a rebar/steel manufacturing company called Rebar.Shop (Ontario Rebars Ltd.). 
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
- Do NOT include any email signature block — the system will add it automatically`;

    const userPrompt = `Draft a reply to this email:

From: ${senderName} <${senderEmail}>
Subject: ${emailSubject}

Email content:
${emailBody}

Write only the reply text, no subject line or email headers.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const draft = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ draft }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("draft-email error:", error);
    return new Response(JSON.stringify({ error: error.message || "Failed to generate draft" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
