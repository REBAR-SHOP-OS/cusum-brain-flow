import { handleRequest } from "../_shared/requestHandler.ts";

/**
 * vizzy-call-receptionist — Generates a context-rich receptionist prompt
 * for OpenAI Realtime when Vizzy auto-answers a call.
 */
Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { body, serviceClient: svc } = ctx;
    const { callerNumber } = body;

    // Normalize phone for matching
    const normalized = (callerNumber || "").replace(/^\+1/, "").replace(/\D/g, "");

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

    return {
      instructions,
      contactName: contactName || undefined,
      customerName: customerName || undefined,
      context: contactContext,
    };
  }, { functionName: "vizzy-call-receptionist", requireCompany: false, wrapResult: false })
);
