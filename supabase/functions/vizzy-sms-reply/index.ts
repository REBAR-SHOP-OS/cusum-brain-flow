/**
 * Vizzy SMS Auto-Reply — AI-powered SMS responses to inbound messages.
 * Triggered asynchronously by ringcentral-webhook on inbound SMS.
 * Uses Lovable AI (Gemini) for intelligent, concise replies.
 * 
 * OPTIMIZED: Operations parallelized into 3 stages for ~5-8s total latency.
 * Safety: rate-limited (5/day per number), skips CEO & own numbers,
 * 2-min dedupe per conversation thread.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/auth.ts";
import { analyzeSpam } from "../_shared/spamFilter.ts";

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
    const normalizedEntry = from_number?.replace(/\D/g, "") || "";
    const isCeoEntry = normalizedEntry === "4165870788" || normalizedEntry === "14165870788";
    console.log(`[sms-reply] INVOKED from=${from_number} isCeo=${isCeoEntry} text="${(message_text || "").slice(0, 60)}"`);

    if (!from_number || !message_text) {
      return new Response(JSON.stringify({ ok: false, error: "Missing from_number or message_text" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Instant safety checks (no DB) ──
    const normalized = from_number.replace(/\D/g, "");
    const isCeo = from_number === CEO_PHONE || normalized === "4165870788" || normalized === "14165870788";

    // Spam filter (skip for CEO)
    if (!isCeo) {
      const spamResult = analyzeSpam(message_text, from_number);
      if (spamResult.isSpam) {
        console.log(`[sms-reply] Spam detected from ${from_number} reasons=${spamResult.reasons.join(",")}`);
        return new Response(JSON.stringify({ ok: true, skipped: "spam", reasons: spamResult.reasons }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Skip short codes
    if (!isCeo && normalized.length < 7) {
      console.log("[sms-reply] Skipping short code:", from_number);
      return new Response(JSON.stringify({ ok: true, skipped: "short_code" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedupe: skip if replied within 2 minutes
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

    // ══ STAGE 1: Parallel safety + context queries ══
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dailyLimit = isCeo ? 50 : MAX_REPLIES_PER_DAY;

    const [rateLimitResult, ownTokensResult, contactResult, recentMsgsResult, tokenRowsResult] = await Promise.all([
      // Rate limit check
      supabase
        .from("communications")
        .select("id", { count: "exact", head: true })
        .eq("source", "vizzy-sms-reply")
        .eq("to_address", from_number)
        .gte("received_at", todayStart.toISOString()),
      // Own numbers check
      supabase
        .from("user_ringcentral_tokens")
        .select("rc_phone_number")
        .not("rc_phone_number", "is", null),
      // Contact context
      contact_id
        ? supabase.from("contacts").select("name, email, phone, company_name").eq("id", contact_id).maybeSingle()
        : Promise.resolve({ data: null }),
      // Conversation history
      supabase
        .from("communications")
        .select("body_preview, direction, received_at")
        .or(`from_address.eq.${from_number},to_address.eq.${from_number}`)
        .eq("company_id", company_id)
        .order("received_at", { ascending: false })
        .limit(5),
      // RC tokens (for sending later)
      supabase
        .from("user_ringcentral_tokens")
        .select("user_id, access_token, refresh_token, token_expires_at, rc_phone_number")
        .limit(5),
    ]);

    // Evaluate rate limit
    if ((rateLimitResult.count || 0) >= dailyLimit) {
      console.log("[sms-reply] Rate limit hit for", from_number);
      return new Response(JSON.stringify({ ok: true, skipped: "rate_limit" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Evaluate own numbers
    const ownNumbers = (ownTokensResult.data || []).map((t: any) => t.rc_phone_number?.replace(/\D/g, ""));
    if (!isCeo && ownNumbers.includes(normalized)) {
      console.log("[sms-reply] Skipping own company number");
      return new Response(JSON.stringify({ ok: true, skipped: "own_number" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context string
    let contextInfo = "";
    if (contactResult.data) {
      const contact = contactResult.data;
      contextInfo += `Known contact: ${contact.name || "Unknown"}`;
      if (contact.company_name) contextInfo += ` from ${contact.company_name}`;
      contextInfo += ". ";
    }
    if (recentMsgsResult.data?.length) {
      contextInfo += "Recent conversation: " + recentMsgsResult.data.map((m: any) =>
        `[${m.direction}] ${m.body_preview?.slice(0, 80)}`
      ).join(" | ");
    }

    // ══ STAGE 2: Parallel AI generation + RC token resolution ══
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[sms-reply] LOVABLE_API_KEY not configured");
      return new Response(JSON.stringify({ ok: false, error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ceoPrompt = `You are Vizzy, Sattar's personal AI assistant. He is texting you directly.

CRITICAL: Keep replies SHORT — under 160 characters when possible, max 300. This is SMS.

Respond naturally and conversationally like a trusted assistant:
- If he says "Hi" or "Hey" → reply warmly: "Hey Sattar! What do you need?"
- If he asks about the business → answer directly from what you know
- If he asks you to do something → confirm you'll handle it or explain what you can/can't do
- If he asks about orders, leads, calls → summarize what you know or say "Let me check — I'll update you"
- Never use sales language or treat him like a customer
- Never say "I'll have the team follow up" — HE IS the team leader
- Be direct, brief, helpful. Like texting a smart colleague.

You know: Rebar Shop, Toronto. Products: 10M-35M rebar, custom bending. Team: Neel (Sales), Saurabh (Ops).
${contextInfo ? `\nContext: ${contextInfo}` : ""}`;

    const salesPrompt = `You are Vizzy, the AI sales assistant for Rebar Shop — a rebar fabrication company in Toronto, Ontario.

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

    const systemPrompt = isCeo ? ceoPrompt : salesPrompt;

    // Resolve RC access token + phone number (parallel with AI call)
    async function resolveRcSender(): Promise<{ accessToken: string; smsSender: string } | null> {
      let accessToken: string | null = null;
      let cachedPhone = "";

      for (const row of (tokenRowsResult.data || [])) {
        if (!row.refresh_token) continue;

        // Use cached phone number if available
        if (row.rc_phone_number) cachedPhone = row.rc_phone_number;

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

      if (!accessToken) return null;

      // Use cached phone number — skip expensive RC API call
      if (cachedPhone) {
        return { accessToken, smsSender: cachedPhone };
      }

      // Fallback: fetch from RC API and cache it
      const phoneResp = await fetch(
        `${RC_SERVER}/restapi/v1.0/account/~/extension/~/phone-number`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      let smsSender = "";
      if (phoneResp.ok) {
        const phoneData = await phoneResp.json();
        const records = phoneData.records || [];
        const smsNum = records.find((r: any) => r.features?.includes("SmsSender"));
        smsSender = smsNum?.phoneNumber || records[0]?.phoneNumber || "";

        // Cache the phone number for future calls
        if (smsSender) {
          await supabase.from("user_ringcentral_tokens")
            .update({ rc_phone_number: smsSender })
            .is("rc_phone_number", null);
        }
      }

      return smsSender ? { accessToken, smsSender } : null;
    }

    // Run AI generation and RC resolution in parallel
    const [aiResp, rcSender] = await Promise.all([
      fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
      }),
      resolveRcSender(),
    ]);

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

    if (!rcSender) {
      console.error("[sms-reply] No valid RC token or SMS sender");
      return new Response(JSON.stringify({ ok: false, error: "No RC token available" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ══ STAGE 3: Send SMS + log (parallel) ══
    const smsResp = await fetch(`${RC_SERVER}/restapi/v1.0/account/~/extension/~/sms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${rcSender.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { phoneNumber: rcSender.smsSender },
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

    // Log + RFQ check in parallel (fire-and-forget style)
    const logPromise = supabase.from("communications").insert({
      source: "vizzy-sms-reply",
      source_id: `vizzy-reply-${Date.now()}`,
      thread_id: `sms-${normalized}`,
      from_address: rcSender.smsSender,
      to_address: from_number,
      subject: "SMS Auto-Reply",
      body_preview: replyText.slice(0, 300),
      received_at: new Date().toISOString(),
      direction: "outbound",
      status: "read",
      metadata: { type: "sms", auto_reply: true, ai_model: "gemini-2.5-flash" },
      company_id: company_id,
    });

    // RFQ notification
    const rfqKeywords = ["quote", "price", "pricing", "rfq", "estimate", "bid", "cost", "how much", "need rebar", "order"];
    const isRfq = rfqKeywords.some(kw => message_text.toLowerCase().includes(kw));

    const rfqPromise = isRfq
      ? supabase.from("profiles").select("user_id").eq("email", "sattar@rebar.shop").maybeSingle().then(({ data: ceoProfile }) => {
          if (ceoProfile?.user_id) {
            return supabase.from("notifications").insert({
              user_id: ceoProfile.user_id,
              title: `📩 Potential RFQ via SMS from ${contact_name || from_number}`,
              description: `"${message_text.slice(0, 200)}" — Vizzy auto-replied. Review and follow up?`,
              type: "rfq_approval",
              priority: "high",
              link_to: "/communications",
              metadata: { from_number, message_text: message_text.slice(0, 500), auto_reply: replyText.slice(0, 300) },
            });
          }
        })
      : Promise.resolve();

    await Promise.all([logPromise, rfqPromise]);

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
