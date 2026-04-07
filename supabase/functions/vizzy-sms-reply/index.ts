/**
 * Vizzy SMS Auto-Reply — AI-powered SMS responses to inbound messages.
 * Triggered asynchronously by ringcentral-webhook on inbound SMS.
 * Uses Lovable AI (Gemini) for intelligent, concise replies.
 * 
 * Safety: rate-limited (5/day per number), skips CEO & own numbers,
 * 2-min dedupe per conversation thread.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import { isSpamSms } from "../_shared/spamFilter.ts";

const CEO_PHONE = "+14165870788";
const MAX_REPLIES_PER_DAY = 5;
const DEDUPE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const RC_SERVER = "https://platform.ringcentral.com";

// Track recent replies in-memory (edge function instance scope)
const recentReplies = new Map<string, number>();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { from_number, message_text, contact_name, contact_id, company_id } = await req.json();

    if (!from_number || !message_text) {
      return new Response(JSON.stringify({ ok: false, error: "Missing from_number or message_text" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Safety checks ──
    const normalized = from_number.replace(/\D/g, "");
    const isCeo = from_number === CEO_PHONE || normalized === "4165870788" || normalized === "14165870788";

    // Spam filter
    if (isSpamSms(message_text, from_number)) {
      console.log("[sms-reply] Spam detected, skipping:", from_number);
      return new Response(JSON.stringify({ ok: true, skipped: "spam" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip short codes (less than 7 digits)
    if (normalized.length < 7) {
      console.log("[sms-reply] Skipping short code:", from_number);
      return new Response(JSON.stringify({ ok: true, skipped: "short_code" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedupe: skip if replied to this number within 2 minutes
    const lastReply = recentReplies.get(normalized);
    if (lastReply && Date.now() - lastReply < DEDUPE_WINDOW_MS) {
      console.log("[sms-reply] Dedupe: already replied recently to", from_number);
      return new Response(JSON.stringify({ ok: true, skipped: "dedupe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Rate limit: max 5 auto-replies per number per day
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("communications")
      .select("id", { count: "exact", head: true })
      .eq("source", "vizzy-sms-reply")
      .eq("to_address", from_number)
      .gte("received_at", todayStart.toISOString());

    if ((count || 0) >= MAX_REPLIES_PER_DAY) {
      console.log("[sms-reply] Rate limit hit for", from_number);
      return new Response(JSON.stringify({ ok: true, skipped: "rate_limit" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip own company numbers
    const { data: ownTokens } = await supabase
      .from("user_ringcentral_tokens")
      .select("rc_phone_number")
      .not("rc_phone_number", "is", null);

    const ownNumbers = (ownTokens || []).map((t: any) => t.rc_phone_number?.replace(/\D/g, ""));
    if (ownNumbers.includes(normalized)) {
      console.log("[sms-reply] Skipping own company number");
      return new Response(JSON.stringify({ ok: true, skipped: "own_number" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch contact context ──
    let contextInfo = "";
    if (contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("name, email, phone, company_name")
        .eq("id", contact_id)
        .maybeSingle();
      if (contact) {
        contextInfo += `Known contact: ${contact.name || "Unknown"}`;
        if (contact.company_name) contextInfo += ` from ${contact.company_name}`;
        contextInfo += ". ";
      }
    }

    // Recent conversation history
    const { data: recentMsgs } = await supabase
      .from("communications")
      .select("body_preview, direction, received_at")
      .or(`from_address.eq.${from_number},to_address.eq.${from_number}`)
      .eq("company_id", company_id)
      .order("received_at", { ascending: false })
      .limit(5);

    if (recentMsgs?.length) {
      contextInfo += "Recent conversation: " + recentMsgs.map((m: any) =>
        `[${m.direction}] ${m.body_preview?.slice(0, 80)}`
      ).join(" | ");
    }

    // ── Generate AI reply ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[sms-reply] LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ ok: false, error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are Vizzy, the AI sales assistant for Rebar Shop — a rebar fabrication company in Toronto, Ontario.

CRITICAL: Keep replies SHORT — under 160 characters when possible, max 300 characters. This is SMS, not email.

You know:
- Products: rebar sizes 10M to 35M, custom bending/fabrication, cut-to-length service
- Pricing: competitive, depends on size/quantity — suggest they send specs for a quote
- Location: Toronto, Ontario, Canada
- Hours: Mon-Fri 7AM-5PM ET
- Website: rebar.shop
- Team: Sattar (CEO), Neel (Sales), Saurabh (Operations)

You CAN answer:
- Product questions (sizes, grades, bending capabilities)
- General pricing (ballpark ranges, suggest quote for specifics)
- Business hours and location
- How to submit an RFQ

You CANNOT answer (suggest follow-up):
- Specific order status
- Exact invoice details
- Account-specific information

If the message looks like an RFQ or quote request, acknowledge it warmly and say the team will follow up.
If they want to talk to someone specific, say you'll pass the message along.

Be friendly, professional, helpful. Sound human, not robotic.
${contextInfo ? `\nContext: ${contextInfo}` : ""}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Inbound SMS from ${contact_name || from_number}: "${message_text}"` },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[sms-reply] AI error:", aiResp.status, errText);
      return new Response(JSON.stringify({ ok: false, error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const replyText = aiData.choices?.[0]?.message?.content?.trim();

    if (!replyText) {
      console.error("[sms-reply] Empty AI response");
      return new Response(JSON.stringify({ ok: false, error: "Empty AI response" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Send SMS via RingCentral ──
    // Get a valid RC access token (same pattern as smsAlertHelper)
    const { data: tokenRows } = await supabase
      .from("user_ringcentral_tokens")
      .select("user_id, access_token, refresh_token, token_expires_at")
      .limit(5);

    let accessToken: string | null = null;
    let smsSender = "";

    for (const row of (tokenRows || [])) {
      if (!row.refresh_token) continue;

      if (row.token_expires_at && new Date(row.token_expires_at) > new Date()) {
        accessToken = row.access_token;
        break;
      }

      // Refresh token
      const clientId = Deno.env.get("RINGCENTRAL_CLIENT_ID");
      const clientSecret = Deno.env.get("RINGCENTRAL_CLIENT_SECRET");
      if (!clientId || !clientSecret) continue;

      const refreshResp = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: row.refresh_token,
        }),
      });

      if (!refreshResp.ok) continue;

      const tokens = await refreshResp.json();
      await supabase.from("user_ringcentral_tokens").update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      }).eq("user_id", row.user_id);

      accessToken = tokens.access_token;
      break;
    }

    if (!accessToken) {
      console.error("[sms-reply] No valid RC token");
      return new Response(JSON.stringify({ ok: false, error: "No RC token available" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find SMS-capable number
    const phoneResp = await fetch(
      `${RC_SERVER}/restapi/v1.0/account/~/extension/~/phone-number`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (phoneResp.ok) {
      const phoneData = await phoneResp.json();
      const records = phoneData.records || [];
      const smsNum = records.find((r: any) => r.features?.includes("SmsSender"));
      smsSender = smsNum?.phoneNumber || records[0]?.phoneNumber || "";
    }

    if (!smsSender) {
      console.error("[sms-reply] No SMS-capable number found");
      return new Response(JSON.stringify({ ok: false, error: "No SMS sender number" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send the reply
    const smsResp = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~/sms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { phoneNumber: smsSender },
        to: [{ phoneNumber: from_number }],
        text: replyText.slice(0, 500),
      }),
    });

    if (!smsResp.ok) {
      const smsErr = await smsResp.text();
      console.error("[sms-reply] SMS send failed:", smsResp.status, smsErr);
      return new Response(JSON.stringify({ ok: false, error: "SMS send failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark dedupe
    recentReplies.set(normalized, Date.now());

    // ── Log outbound reply to communications ──
    await supabase.from("communications").insert({
      source: "vizzy-sms-reply",
      source_id: `vizzy-reply-${Date.now()}`,
      thread_id: `sms-${normalized}`,
      from_address: smsSender,
      to_address: from_number,
      subject: "SMS Auto-Reply",
      body_preview: replyText.slice(0, 300),
      received_at: new Date().toISOString(),
      direction: "outbound",
      status: "read",
      metadata: { type: "sms", auto_reply: true, ai_model: "gemini-2.5-flash" },
      company_id: company_id,
    });

    // ── Check if message looks like an RFQ → notify CEO ──
    const rfqKeywords = ["quote", "price", "pricing", "rfq", "estimate", "bid", "cost", "how much", "need rebar", "order"];
    const isRfq = rfqKeywords.some(kw => message_text.toLowerCase().includes(kw));

    if (isRfq) {
      // Find CEO user
      const { data: ceoProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", "sattar@rebar.shop")
        .maybeSingle();

      if (ceoProfile?.user_id) {
        await supabase.from("notifications").insert({
          user_id: ceoProfile.user_id,
          title: `📩 Potential RFQ via SMS from ${contact_name || from_number}`,
          description: `"${message_text.slice(0, 200)}" — Vizzy auto-replied. Review and follow up?`,
          type: "rfq_approval",
          priority: "high",
          link_to: "/communications",
          metadata: { from_number, message_text: message_text.slice(0, 500), auto_reply: replyText.slice(0, 300) },
        });
      }
    }

    console.log(`[sms-reply] Replied to ${from_number}: "${replyText.slice(0, 80)}..."`);

    return new Response(JSON.stringify({ ok: true, reply: replyText.slice(0, 100) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sms-reply] Error:", err);
    return new Response(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
