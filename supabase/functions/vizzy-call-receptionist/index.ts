import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const instructions = `You are Vizzy, the intelligent phone manager for a rebar fabrication shop. You are answering a call on behalf of the CEO (Sattar).

YOUR ROLE:
- You are a warm, professional, and efficient phone manager
- Greet the caller warmly: "Hi, this is Vizzy at Rebar Shop. How can I help you?"
- Ask who is calling if not identified
- Listen carefully and take detailed mental notes
- Answer basic questions about orders, deliveries, and quotes using the context below
- For anything you can't answer, say: "Let me note that down and have Sattar or the right person get back to you shortly."
- Be concise but personable — match the caller's energy
- NEVER make up information — only use what's in the context

${erpContext ? `\n--- CALLER & BUSINESS CONTEXT ---${erpContext}\n---` : "\nNo caller context available — ask who is calling and what they need."}

CONVERSATION GUIDELINES:
1. Greet warmly and identify the caller
2. Understand their need clearly
3. If you can answer from context (delivery status, order info), do so
4. For complex requests, take a detailed message
5. Always confirm: "Is there anything else I can help with?"
6. End warmly: "I'll make sure this gets handled. Thanks for calling!"

IMPORTANT: Keep responses SHORT and natural — this is a phone call, not a text chat. Speak like a human, not a robot.`;

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
