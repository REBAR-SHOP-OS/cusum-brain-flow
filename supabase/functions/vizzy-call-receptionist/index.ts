import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/auth.ts";

/**
 * vizzy-call-receptionist — Generates a context-rich receptionist prompt
 * for OpenAI Realtime when Vizzy auto-answers a call.
 *
 * Input: { callerNumber: string }
 * Output: { instructions: string, contactName?: string, context: object }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { callerNumber } = await req.json();
    const svc = createClient(supabaseUrl, serviceKey);

    // Normalize phone for matching
    const normalized = (callerNumber || "").replace(/^\+1/, "").replace(/\D/g, "");

    // Try to match caller to a contact
    let contactName: string | null = null;
    let customerName: string | null = null;
    let contactContext: Record<string, any> = {};

    if (normalized.length >= 7) {
      const { data: contact } = await svc
        .from("contacts")
        .select("id, name, email, company_name, customer_id")
        .or(`phone.eq.${callerNumber},phone.eq.+1${normalized},phone.eq.${normalized}`)
        .limit(1)
        .maybeSingle();

      if (contact) {
        contactName = contact.name;
        customerName = contact.company_name;
        contactContext.contact_id = contact.id;
        contactContext.customer_id = contact.customer_id;

        // Fetch recent orders/leads for this customer
        if (contact.customer_id) {
          const [{ data: leads }, { data: deliveries }] = await Promise.all([
            svc
              .from("leads")
              .select("id, title, stage, expected_value")
              .eq("customer_id", contact.customer_id)
              .not("stage", "in", '("won","lost","cancelled")')
              .order("created_at", { ascending: false })
              .limit(5),
            svc
              .from("deliveries")
              .select("delivery_number, status, scheduled_date")
              .eq("customer_id", contact.customer_id)
              .in("status", ["scheduled", "in-transit", "pending"])
              .order("scheduled_date", { ascending: true })
              .limit(5),
          ]);

          contactContext.active_leads = leads || [];
          contactContext.pending_deliveries = deliveries || [];
        }
      }
    }

    // Build the context snippet for the prompt
    let erpContext = "";
    if (contactName) {
      erpContext += `\nCALLER IDENTIFIED: ${contactName}`;
      if (customerName) erpContext += ` from ${customerName}`;

      if (contactContext.active_leads?.length > 0) {
        erpContext += `\n\nACTIVE QUOTES/LEADS for this customer:`;
        for (const lead of contactContext.active_leads) {
          erpContext += `\n- ${lead.title} (${lead.stage}, est. $${lead.expected_value || 0})`;
        }
      }

      if (contactContext.pending_deliveries?.length > 0) {
        erpContext += `\n\nPENDING DELIVERIES:`;
        for (const del of contactContext.pending_deliveries) {
          erpContext += `\n- ${del.delivery_number}: ${del.status} (scheduled ${del.scheduled_date || "TBD"})`;
        }
      }
    }

    const instructions = `You are Vizzy, the phone manager for a rebar fabrication shop. You are answering a call on behalf of the boss, Sattar.

YOUR ROLE:
- You are a warm, professional gatekeeper — like a real office manager
- Sattar is busy in the shop or in a meeting right now
- Your job is to take a message, NOT to answer business questions

${contactName ? `\n[INTERNAL — DO NOT SHARE]: Caller identified as ${contactName}${customerName ? ` from ${customerName}` : ""}. Use this ONLY to greet them by name if appropriate. Do NOT reveal any business details.\n` : ""}

SCRIPT:
1. Answer: "Hi, this is Vizzy at Rebar Shop. Sattar is in the shop right now — how can I help you?"
2. If caller is identified, greet by name: "Hi ${contactName || "[name]"}, how are you?"
3. Listen to what they need
4. Respond with: "OK, I'll make sure Sattar gets that message and he'll get back to you shortly."
5. Confirm their name and callback number if not already known
6. End warmly: "Thanks for calling, have a great day!"

CONFIDENTIALITY RULES — STRICTLY ENFORCED:
- NEVER discuss order details, pricing, quotes, dollar amounts, or delivery dates
- NEVER confirm or deny any business information
- If asked about an order, delivery, or quote, say: "I don't have that info in front of me, but I'll have Sattar call you back about that."
- If pressed, repeat: "Sattar will be the best person to help you with that — I'll make sure he calls you back."
- Do NOT reveal that you have access to any business systems or data
- Do NOT mention AI, ERP, or any technology

TONE:
- Sound like a real person, not a robot
- Keep responses SHORT — this is a phone call
- Match the caller's energy — friendly but professional
- Use natural fillers: "Sure thing", "Got it", "No problem"`;

    return new Response(
      JSON.stringify({
        instructions,
        contactName: contactName || undefined,
        customerName: customerName || undefined,
        context: contactContext,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("vizzy-call-receptionist error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
