import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callAI } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-widget-key, x-visitor-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "send";

    if (action === "widget.js") return handleWidgetJs(url, supabase, supabaseUrl);
    if (action === "start") return handleStart(req, supabase);
    if (action === "send") return handleSend(req, supabase);
    if (action === "poll") return handlePoll(url, supabase);
    if (action === "heartbeat") return handleHeartbeat(req, supabase);

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    console.error("support-chat error:", err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── IP Geolocation ──
async function resolveGeo(ip: string): Promise<{ city: string; country: string } | null> {
  if (!ip || ip === "unknown" || ip === "127.0.0.1") return null;
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,countryCode`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.city ? { city: data.city, country: data.countryCode || data.country } : null;
  } catch { return null; }
}

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
}

// ── Widget JS ──
async function handleWidgetJs(url: URL, supabase: any, supabaseUrl: string) {
  const widgetKey = url.searchParams.get("key");
  if (!widgetKey) return new Response("Missing key", { status: 400, headers: corsHeaders });

  const { data: config } = await supabase
    .from("support_widget_configs").select("*")
    .eq("widget_key", widgetKey).eq("enabled", true).single();

  if (!config) return new Response("// Widget not found or disabled", {
    status: 404, headers: { ...corsHeaders, "Content-Type": "application/javascript" },
  });

  return new Response(generateWidgetJs(config, supabaseUrl), {
    headers: { ...corsHeaders, "Content-Type": "application/javascript", "Cache-Control": "public, max-age=300" },
  });
}

// ── Start Conversation ──
async function handleStart(req: Request, supabase: any) {
  const { widget_key, visitor_name, visitor_email, current_page } = await req.json();

  const { data: config } = await supabase
    .from("support_widget_configs").select("id, company_id")
    .eq("widget_key", widget_key).eq("enabled", true).single();

  if (!config) return new Response(JSON.stringify({ error: "Widget not found" }), {
    status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const ip = getClientIp(req);
  const geo = await resolveGeo(ip);
  const metadata: Record<string, any> = { current_page: current_page || null, last_seen_at: new Date().toISOString() };
  if (geo) { metadata.city = geo.city; metadata.country = geo.country; }

  const { data: convo, error } = await supabase
    .from("support_conversations").insert({
      company_id: config.company_id, widget_config_id: config.id,
      visitor_name: visitor_name?.slice(0, 100) || "Visitor",
      visitor_email: visitor_email?.slice(0, 255) || null,
      status: "open", metadata,
    }).select("id, visitor_token").single();
  if (error) throw error;

  // System message (hidden from widget display)
  try {
    await supabase.from("support_messages").insert({
      conversation_id: convo.id, sender_type: "system", content: "Conversation started", content_type: "system",
    });
  } catch (_e) { /* best effort */ }

  triggerProactiveGreeting(supabase, convo.id, config.company_id, config.id, metadata).catch((e: unknown) =>
    console.error("Proactive greeting error:", e)
  );
  notifySalesTeam(supabase, config.company_id, visitor_name || "Visitor", metadata).catch((e: unknown) =>
    console.error("Sales notification error:", e)
  );

  return new Response(JSON.stringify({ conversation_id: convo.id, visitor_token: convo.visitor_token }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Heartbeat ──
async function handleHeartbeat(req: Request, supabase: any) {
  const { conversation_id, visitor_token, current_page } = await req.json();
  if (!conversation_id || !visitor_token) return new Response(JSON.stringify({ error: "Missing fields" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const { data: convo } = await supabase
    .from("support_conversations").select("id, metadata")
    .eq("id", conversation_id).eq("visitor_token", visitor_token).single();
  if (!convo) return new Response(JSON.stringify({ error: "Invalid" }), {
    status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const existingMeta = (convo.metadata && typeof convo.metadata === "object") ? convo.metadata : {};
  await supabase.from("support_conversations").update({
    metadata: { ...existingMeta, current_page: current_page || existingMeta.current_page, last_seen_at: new Date().toISOString() },
  }).eq("id", conversation_id);

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// ── Send Message (visitor) ──
async function handleSend(req: Request, supabase: any) {
  const { conversation_id, content, visitor_token, current_page } = await req.json();
  if (!conversation_id || !content || !visitor_token) return new Response(JSON.stringify({ error: "Missing fields" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const { data: convo } = await supabase
    .from("support_conversations").select("id, status, company_id, widget_config_id, metadata")
    .eq("id", conversation_id).eq("visitor_token", visitor_token).single();
  if (!convo) return new Response(JSON.stringify({ error: "Invalid conversation" }), {
    status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const sanitizedContent = content.slice(0, 5000).trim();
  if (!sanitizedContent) return new Response(JSON.stringify({ error: "Empty message" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const { data: msg, error } = await supabase.from("support_messages").insert({
    conversation_id, sender_type: "visitor", content: sanitizedContent,
  }).select("id, created_at").single();
  if (error) throw error;

  const existingMeta = (convo.metadata && typeof convo.metadata === "object") ? convo.metadata : {};
  const updatedMeta = { ...existingMeta, current_page: current_page || existingMeta.current_page, last_seen_at: new Date().toISOString() };
  await supabase.from("support_conversations").update({ last_message_at: new Date().toISOString(), metadata: updatedMeta }).eq("id", conversation_id);

  triggerAiReply(supabase, convo, sanitizedContent, updatedMeta).catch((e: unknown) => console.error("AI reply error:", e));

  return new Response(JSON.stringify({ message_id: msg.id, created_at: msg.created_at }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Poll Messages (visitor) ──
async function handlePoll(url: URL, supabase: any) {
  const conversationId = url.searchParams.get("conversation_id");
  const visitorToken = url.searchParams.get("visitor_token");
  const after = url.searchParams.get("after") || "1970-01-01T00:00:00Z";
  if (!conversationId || !visitorToken) return new Response(JSON.stringify({ error: "Missing params" }), {
    status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const { data: convo } = await supabase
    .from("support_conversations").select("id")
    .eq("id", conversationId).eq("visitor_token", visitorToken).single();
  if (!convo) return new Response(JSON.stringify({ error: "Invalid" }), {
    status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  const { data: messages } = await supabase
    .from("support_messages").select("id, sender_type, content, content_type, created_at")
    .eq("conversation_id", conversationId).eq("is_internal_note", false)
    .gt("created_at", after).order("created_at", { ascending: true }).limit(50);

  return new Response(JSON.stringify({ messages: messages || [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Tool Definitions ──
const WIDGET_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "create_estimation_task",
      description: "Create an estimation task when a customer wants to submit drawings/blueprints for review.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "Customer name" },
          customer_email: { type: "string", description: "Customer email" },
          project_name: { type: "string", description: "Project name" },
        },
        required: ["customer_name", "customer_email"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "submit_barlist_for_quote",
      description: "Submit a barlist/BBS for automated quoting.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "Customer name" },
          customer_email: { type: "string", description: "Customer email" },
          project_name: { type: "string", description: "Project name" },
          bar_details: { type: "string", description: "Barlist/BBS details" },
        },
        required: ["customer_name", "customer_email", "bar_details"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_and_email_quote",
      description: "Generate a branded quotation and email it to the customer. Use when the customer wants a price quote for rebar products or services. Collect customer name, email, and item details first.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "Customer full name" },
          customer_email: { type: "string", description: "Customer email address" },
          project_name: { type: "string", description: "Project name or description" },
          items: {
            type: "array",
            description: "List of quoted items",
            items: {
              type: "object",
              properties: {
                description: { type: "string", description: "Item description (e.g. 10M rebar, 6m length)" },
                quantity: { type: "number", description: "Quantity" },
                unit: { type: "string", description: "Unit (e.g. pcs, tonnes, m)" },
                unit_price: { type: "number", description: "Price per unit in CAD" },
              },
              required: ["description", "quantity", "unit_price"],
            },
          },
          notes: { type: "string", description: "Additional notes or terms" },
        },
        required: ["customer_name", "customer_email", "items"],
      },
    },
  },
];

// ── Quote Email Helper ──
function generateQuoteHtml(quoteNumber: string, customerName: string, items: any[], notes?: string): string {
  const today = new Date();
  const validUntil = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const formatDate = (d: Date) => d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  let subtotal = 0;
  const itemRows = items.map((item: any, i: number) => {
    const amount = (item.quantity || 0) * (item.unit_price || 0);
    subtotal += amount;
    return `<tr style="border-bottom:1px solid #eee;">
      <td style="padding:10px;text-align:center;">${i + 1}</td>
      <td style="padding:10px;">${item.description || ""}</td>
      <td style="padding:10px;text-align:center;">${item.quantity || 0} ${item.unit || "pcs"}</td>
      <td style="padding:10px;text-align:right;">$${(item.unit_price || 0).toFixed(2)}</td>
      <td style="padding:10px;text-align:right;">$${amount.toFixed(2)}</td>
    </tr>`;
  }).join("");

  const hst = subtotal * 0.13;
  const total = subtotal + hst;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f5f5f5;">
<div style="max-width:700px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <div style="background:#1a1a2e;padding:24px 32px;color:#fff;">
    <table width="100%"><tr>
      <td><h1 style="margin:0;font-size:22px;color:#fff;">🔩 Rebar.Shop</h1><p style="margin:4px 0 0;font-size:12px;color:#ccc;">Premium Rebar Solutions</p></td>
      <td style="text-align:right;font-size:12px;color:#ccc;">130 Bridgeland Ave, Unit 23<br>Toronto, ON M6A 1Z4<br>📞 (647) 521-0090<br>✉️ sales@rebar.shop</td>
    </tr></table>
  </div>
  <div style="padding:24px 32px;">
    <h2 style="color:#1a1a2e;margin:0 0 16px;">Quotation ${quoteNumber}</h2>
    <table style="font-size:14px;margin-bottom:20px;"><tr>
      <td style="padding:4px 16px 4px 0;color:#666;">Customer:</td><td><strong>${customerName}</strong></td>
    </tr><tr>
      <td style="padding:4px 16px 4px 0;color:#666;">Date:</td><td>${formatDate(today)}</td>
    </tr><tr>
      <td style="padding:4px 16px 4px 0;color:#666;">Valid Until:</td><td>${formatDate(validUntil)}</td>
    </tr></table>
    <table width="100%" style="border-collapse:collapse;font-size:14px;">
      <thead><tr style="background:#f0f0f5;">
        <th style="padding:10px;text-align:center;width:40px;">#</th>
        <th style="padding:10px;text-align:left;">Description</th>
        <th style="padding:10px;text-align:center;">Qty</th>
        <th style="padding:10px;text-align:right;">Unit Price</th>
        <th style="padding:10px;text-align:right;">Amount</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <table width="100%" style="font-size:14px;margin-top:12px;">
      <tr><td></td><td style="text-align:right;padding:4px 10px;color:#666;">Subtotal:</td><td style="text-align:right;padding:4px 10px;width:100px;">$${subtotal.toFixed(2)}</td></tr>
      <tr><td></td><td style="text-align:right;padding:4px 10px;color:#666;">HST (13%):</td><td style="text-align:right;padding:4px 10px;">$${hst.toFixed(2)}</td></tr>
      <tr style="font-weight:bold;font-size:16px;"><td></td><td style="text-align:right;padding:8px 10px;border-top:2px solid #1a1a2e;">Total:</td><td style="text-align:right;padding:8px 10px;border-top:2px solid #1a1a2e;">$${total.toFixed(2)} CAD</td></tr>
    </table>
    ${notes ? `<div style="margin-top:20px;padding:12px;background:#f9f9f9;border-radius:6px;font-size:13px;color:#555;"><strong>Notes:</strong> ${notes}</div>` : ""}
    <div style="margin-top:24px;padding:16px;background:#eef6ff;border-radius:6px;font-size:13px;">
      <strong>Terms & Conditions:</strong><br>
      • Prices quoted in Canadian Dollars (CAD)<br>
      • Quote valid for 30 days from date of issue<br>
      • Delivery charges apply based on location<br>
      • Payment terms: Net 30 for approved accounts<br>
      • To accept this quote, reply to this email or call us at (647) 521-0090
    </div>
  </div>
  <div style="background:#f0f0f5;padding:16px 32px;text-align:center;font-size:11px;color:#888;">
    © ${today.getFullYear()} Rebar.Shop — rebar.shop — All rights reserved
  </div>
</div></body></html>`;
}

async function sendQuoteEmailDirect(supabase: any, customerEmail: string, quoteNumber: string, quoteHtml: string): Promise<void> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    console.error("Gmail credentials not configured for quote email");
    return;
  }

  // Get access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!tokenRes.ok) { console.error("Failed to get Gmail access token:", await tokenRes.text()); return; }
  const { access_token } = await tokenRes.json();

  // Build raw email
  const emailLines = [
    "From: Rebar.Shop Sales <sales@rebar.shop>",
    `To: ${customerEmail}`,
    `Subject: Your Quotation ${quoteNumber} from Rebar.Shop`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    quoteHtml,
  ];
  const raw = btoa(unescape(encodeURIComponent(emailLines.join("\r\n")))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!sendRes.ok) { console.error("Gmail send failed:", await sendRes.text()); }
  else { console.log("Quote email sent to", customerEmail); await sendRes.json(); }
}

async function createQuoteFollowUpTask(supabase: any, companyId: string, quoteNumber: string, customerName: string, customerEmail: string, quoteId?: string): Promise<void> {
  const SAURABH_PROFILE_ID = "f919e8fa-4981-42f9-88c9-e1e425687522";
  const SAURABH_USER_ID = "1a618127-a569-4134-b4cc-42da73a70399";

  try {
    await supabase.from("tasks").insert({
      title: `Follow-up: Quote ${quoteNumber} for ${customerName}`,
      description: `Quotation ${quoteNumber} has been emailed to ${customerEmail}. Follow up to close the deal.`,
      status: "open", priority: "high", assigned_to: SAURABH_PROFILE_ID,
      agent_type: "sales", source: "website_chat", source_ref: quoteId || null, company_id: companyId,
    });
  } catch (_e) { console.error("Failed to create follow-up task:", _e); }

  try {
    await supabase.from("notifications").insert({
      user_id: SAURABH_USER_ID, type: "todo",
      title: `New Quote Sent: ${quoteNumber}`,
      description: `Quotation ${quoteNumber} emailed to ${customerName} (${customerEmail}). Please follow up.`,
      link_to: "/tasks", agent_name: "JARVIS", status: "unread", priority: "high",
    });
  } catch (_e) { console.error("Failed to create notification:", _e); }
}

// ── Execute Widget Tools ──
async function executeWidgetTool(supabase: any, toolName: string, args: any, companyId: string): Promise<string> {
  const SAURABH_PROFILE_ID = "f919e8fa-4981-42f9-88c9-e1e425687522";
  try {
    if (toolName === "create_estimation_task") {
      const qn = "QR-EST-" + Date.now().toString(36).toUpperCase();
      const { data: qr, error: qrErr } = await supabase.from("quote_requests").insert({
        quote_number: qn, customer_name: args.customer_name, customer_email: args.customer_email,
        project_name: args.project_name || "Estimation Request", status: "estimation_pending",
        source: "website_chat", company_id: companyId,
        notes: "Customer wants to submit drawings for estimation via website chat.",
      }).select("id, quote_number").single();
      if (qrErr) throw qrErr;

      try { await supabase.from("tasks").insert({
        title: "Estimation: " + args.customer_name + " - " + (args.project_name || "New Project"),
        description: "Customer wants to submit drawings.\nEmail: " + args.customer_email + "\nQuote: " + qn,
        status: "open", priority: "high", assigned_to: SAURABH_PROFILE_ID,
        agent_type: "estimation", source: "website_chat", source_ref: qr.id, company_id: companyId,
      }); } catch (_e) { /* best effort */ }

      try {
        const { data: saurabh } = await supabase.from("profiles").select("user_id").eq("id", SAURABH_PROFILE_ID).single();
        if (saurabh?.user_id) {
          await supabase.from("notifications").insert({
            user_id: saurabh.user_id, type: "todo", title: "New Estimation: " + args.customer_name,
            description: "Customer " + args.customer_name + " wants to submit drawings. Email: " + args.customer_email,
            link_to: "/pipeline", agent_name: "JARVIS", status: "unread", priority: "high",
          });
        }
      } catch (_e) { /* best effort */ }

      return JSON.stringify({ success: true, quote_number: qn, message: "Estimation task created. Customer should email drawings to sales@rebar.shop." });
    }

    if (toolName === "submit_barlist_for_quote") {
      const qn = "QR-BL-" + Date.now().toString(36).toUpperCase();
      const { data: qr, error: qrErr } = await supabase.from("quote_requests").insert({
        quote_number: qn, customer_name: args.customer_name, customer_email: args.customer_email,
        project_name: args.project_name || "Barlist Quote", status: "new",
        source: "website_chat", company_id: companyId,
        notes: "Barlist from chat:\n" + args.bar_details,
        items: [{ type: "barlist_raw", details: args.bar_details }],
      }).select("id, quote_number").single();
      if (qrErr) throw qrErr;

      // Create follow-up task and notify
      createQuoteFollowUpTask(supabase, companyId, qn, args.customer_name, args.customer_email, qr?.id).catch(e => console.error("Follow-up error:", e));

      return JSON.stringify({ success: true, quote_number: qn, message: "Barlist received. A follow-up task has been created and our team will prepare your quotation and email it to you shortly." });
    }

    if (toolName === "generate_and_email_quote") {
      const qn = "QR-" + Date.now().toString(36).toUpperCase();
      
      // Save quote request in DB
      const { data: qr, error: qrErr } = await supabase.from("quote_requests").insert({
        quote_number: qn, customer_name: args.customer_name, customer_email: args.customer_email,
        project_name: args.project_name || "Quote Request", status: "sent",
        source: "website_chat", company_id: companyId,
        notes: args.notes || null,
        items: args.items || [],
      }).select("id, quote_number").single();
      if (qrErr) throw qrErr;

      // Generate HTML quote
      const quoteHtml = generateQuoteHtml(qn, args.customer_name, args.items || [], args.notes);

      // Send email directly via Gmail API
      await sendQuoteEmailDirect(supabase, args.customer_email, qn, quoteHtml);

      // Create follow-up task and notification
      createQuoteFollowUpTask(supabase, companyId, qn, args.customer_name, args.customer_email, qr?.id).catch(e => console.error("Follow-up error:", e));

      return JSON.stringify({ success: true, quote_number: qn, message: `Quotation ${qn} has been emailed to ${args.customer_email}. A follow-up task has been created for our sales team.` });
    }

    return JSON.stringify({ error: "Unknown tool: " + toolName });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Tool execution failed";
    console.error("Tool " + toolName + " error:", err);
    return JSON.stringify({ error: msg });
  }
}

// ── AI Auto-Reply ──
async function triggerAiReply(supabase: any, convo: any, _visitorMessage: string, metadata?: any) {
  const { data: widgetConfig } = await supabase
    .from("support_widget_configs").select("ai_enabled, ai_system_prompt, company_id")
    .eq("id", convo.widget_config_id).single();
  if (!widgetConfig?.ai_enabled) return;

  const { data: articles } = await supabase
    .from("kb_articles").select("title, content, excerpt")
    .eq("company_id", widgetConfig.company_id).eq("is_published", true).limit(20);

  const { data: knowledgeEntries } = await supabase
    .from("knowledge").select("title, content, category")
    .eq("company_id", widgetConfig.company_id)
    .in("category", ["webpage", "company-playbook", "document", "research"])
    .order("updated_at", { ascending: false }).limit(10);

  const kbContext = (articles || []).map((a: any) => "## " + a.title + "\n" + (a.excerpt || "") + "\n" + a.content).join("\n\n---\n\n");
  const knowledgeContext = (knowledgeEntries || []).map((k: any) => "## " + k.title + " [" + k.category + "]\n" + ((k.content || "").slice(0, 500))).join("\n\n---\n\n");

  const { data: history } = await supabase
    .from("support_messages").select("sender_type, content")
    .eq("conversation_id", convo.id).eq("is_internal_note", false)
    .neq("content_type", "system").order("created_at", { ascending: true }).limit(20);

  const currentPage = metadata?.current_page;
  const pageContext = currentPage ? "\n\n[Visitor is currently viewing: " + currentPage + "]" : "";

  const systemPrompt = (widgetConfig.ai_system_prompt || "You are a helpful support assistant.") +
    "\n\n## CRITICAL SECURITY RULES (ABSOLUTE - NO EXCEPTIONS)" +
    "\n- NEVER share: accounting data, invoices, AR/AP, bank balances, profit margins, revenue figures" +
    "\n- NEVER share: pipeline data, CRM data, lead info, sales figures, conversion rates" +
    "\n- NEVER share: employee salaries, internal notes, operational data, meeting notes" +
    "\n- NEVER share: database structure, API keys, system internals, strategic plans" +
    "\n- ONLY discuss: products, services, delivery, rebar sizes, quotes, and general company info" +
    "\n- If asked about ANY internal data: respond with 'I can only help with our products and services. How can I assist you?'" +
    "\n\nIMPORTANT: If the visitor asks to speak with a real person, respond warmly and let them know a team member will be with them shortly." +
    "\n\nCRITICAL - CONTACT INFO: Do NOT ask for contact details upfront. Help them first. When they want a quote or order, then ask for name and email." +
    "\n\n## QUOTING INSTRUCTIONS:" +
    "\nWhen a customer requests a price quote:" +
    "\n1. Help them identify the products they need (rebar sizes, lengths, quantities)" +
    "\n2. Ask for their name and email address" +
    "\n3. Use the generate_and_email_quote tool to create and email a branded quotation" +
    "\n4. The tool will automatically email the quote and create a follow-up task for the sales team" +
    "\n5. Confirm to the customer that the quotation has been sent to their email" +
    "\n\n## Knowledge Base:\n" + (kbContext || "No articles.") +
    "\n\n## Company Knowledge:\n" + (knowledgeContext || "No entries.") +
    pageContext;

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...(history || []).map((m: any) => ({
      role: m.sender_type === "visitor" ? "user" : "assistant",
      content: m.content,
    })),
  ];

  let reply: string | undefined;
  try {
    let result = await callAI({
      provider: "gemini", model: "gemini-2.5-flash", messages, tools: WIDGET_TOOLS,
      fallback: { provider: "gemini", model: "gemini-2.5-flash" },
    });

    let iterations = 0;
    while (result.toolCalls && result.toolCalls.length > 0 && iterations < 3) {
      iterations++;
      messages.push({ role: "assistant", content: result.content || "", tool_calls: result.toolCalls });

      for (const tc of result.toolCalls) {
        const fnName = tc.function?.name;
        let fnArgs: any = {};
        try { fnArgs = JSON.parse(tc.function?.arguments || "{}"); } catch { /* ignore */ }
        const toolResult = await executeWidgetTool(supabase, fnName, fnArgs, widgetConfig.company_id);
        messages.push({ role: "tool", tool_call_id: tc.id, content: toolResult });
      }

      result = await callAI({
        provider: "gemini", model: "gemini-2.5-flash", messages, tools: WIDGET_TOOLS,
        fallback: { provider: "gemini", model: "gemini-2.5-flash" },
      });
    }
    reply = result.content;
  } catch (aiErr) {
    console.error("AI reply error:", aiErr);
    return;
  }

  if (!reply) return;
  try {
    await supabase.from("support_messages").insert({
      conversation_id: convo.id, sender_type: "bot", content: reply.slice(0, 5000),
    });
  } catch (_e) { /* best effort */ }
}

// ── Proactive AI Greeting ──
async function triggerProactiveGreeting(supabase: any, conversationId: string, companyId: string, widgetConfigId: string, metadata: any) {
  const { data: widgetConfig } = await supabase
    .from("support_widget_configs").select("ai_enabled, ai_system_prompt")
    .eq("id", widgetConfigId).single();
  if (!widgetConfig?.ai_enabled) return;

  const currentPage = metadata?.current_page || "";
  const city = metadata?.city || "";

  const greetingPrompt = "You are JARVIS, the friendly support assistant for Rebar Shop (rebar.shop)." +
    " A new visitor just opened the chat widget." +
    (currentPage ? " They are currently viewing: " + currentPage : "") +
    (city ? " They appear to be from " + city + "." : "") +
    "\n\nGenerate a warm, contextual welcome message (2-3 sentences max). Be specific based on their page context." +
    "\nONLY discuss products, services, and quotes. NEVER share internal company data, financials, or employee info.";

  let reply: string | undefined;
  try {
    const result = await callAI({
      provider: "gemini", model: "gemini-2.5-flash",
      messages: [{ role: "user", content: greetingPrompt }],
      fallback: { provider: "gemini", model: "gemini-2.5-flash" },
    });
    reply = result.content;
  } catch { return; }
  if (!reply) return;

  try {
    await supabase.from("support_messages").insert({
      conversation_id: conversationId, sender_type: "bot", content: reply.slice(0, 2000),
    });
  } catch (_e) { /* best effort */ }
}

// ── Notify Sales Team ──
async function notifySalesTeam(supabase: any, companyId: string, visitorName: string, metadata: any) {
  const { data: profiles } = await supabase.from("profiles").select("user_id").eq("company_id", companyId);
  if (!profiles || profiles.length === 0) return;

  const city = metadata?.city || "Unknown location";
  const page = metadata?.current_page || "homepage";
  const pageName = page.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "") || "/";

  const notifications = profiles.map((p: any) => ({
    user_id: p.user_id, type: "notification", title: "New Website Visitor",
    description: visitorName + " from " + city + " viewing " + pageName,
    link_to: "/support-inbox", agent_name: "Support", status: "unread", priority: "high",
    metadata: { conversation_type: "support_visitor" },
  }));

  try { await supabase.from("notifications").insert(notifications); } catch (_e) { /* best effort */ }
}

// ── Widget JS Generator ──
function generateWidgetJs(config: any, supabaseUrl: string): string {
  const chatUrl = supabaseUrl + "/functions/v1/support-chat";
  const cfgJson = JSON.stringify({
    brandName: config.brand_name, brandColor: config.brand_color,
    welcomeMessage: config.welcome_message, widgetKey: config.widget_key, chatUrl,
  });

  return `(function(){
if(window.__support_widget_loaded) return;
window.__support_widget_loaded = true;
var cfg = ${cfgJson};
var state = { open:false, convoId:null, visitorToken:null, messages:[], lastTs:null, polling:null, heartbeat:null, currentPage:window.location.href };
function getCurrentPage(){ return window.location.href; }
setInterval(function(){ state.currentPage = getCurrentPage(); }, 2000);
window.addEventListener('popstate', function(){ state.currentPage = getCurrentPage(); });

var style = document.createElement('style');
style.textContent = '#sw-bubble{position:fixed;bottom:20px;right:20px;z-index:99999;width:56px;height:56px;border-radius:50%;background:'+cfg.brandColor+';color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.2);transition:transform 0.2s}#sw-bubble:hover{transform:scale(1.1)}#sw-bubble svg{width:24px;height:24px;fill:currentColor}#sw-panel{position:fixed;bottom:84px;right:20px;z-index:99999;width:360px;max-height:500px;background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.15);display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif}#sw-panel.open{display:flex;animation:sw-slide-in 0.2s ease-out}@keyframes sw-slide-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}#sw-header{padding:14px 16px;background:'+cfg.brandColor+';color:#fff;display:flex;align-items:center;justify-content:space-between}#sw-header h3{margin:0;font-size:15px;font-weight:600}#sw-header button{background:none;border:none;color:#fff;cursor:pointer;font-size:20px;line-height:1}#sw-messages{flex:1;overflow-y:auto;padding:12px;max-height:320px;min-height:200px}.sw-msg{margin-bottom:8px;max-width:85%;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.4;word-wrap:break-word}.sw-msg.visitor{margin-left:auto;background:'+cfg.brandColor+';color:#fff;border-bottom-right-radius:4px}.sw-msg.agent,.sw-msg.bot{background:#f0f0f0;color:#333;border-bottom-left-radius:4px}#sw-input-area{padding:10px;border-top:1px solid #eee;display:flex;gap:6px}#sw-input{flex:1;border:1px solid #ddd;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;resize:none;font-family:inherit}#sw-input:focus{border-color:'+cfg.brandColor+'}#sw-send{background:'+cfg.brandColor+';color:#fff;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:13px;font-weight:500}#sw-send:disabled{opacity:0.5;cursor:not-allowed}@media(max-width:420px){#sw-panel{width:calc(100vw - 24px);right:12px;bottom:80px}}';
document.head.appendChild(style);

var bubble = document.createElement('button');
bubble.id = 'sw-bubble';
bubble.setAttribute('aria-label','Open chat');
bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
document.body.appendChild(bubble);

var panel = document.createElement('div');
panel.id = 'sw-panel';
panel.innerHTML = '<div id="sw-header"><h3>'+esc(cfg.brandName)+'</h3><button onclick="document.getElementById(\\'sw-panel\\').classList.remove(\\'open\\')">&times;</button></div><div id="sw-messages"></div><div id="sw-input-area"><textarea id="sw-input" rows="1" placeholder="Type a message..."></textarea><button id="sw-send" disabled>Send</button></div>';
document.body.appendChild(panel);

var started = false;
bubble.onclick = async function(){
  var wasOpen = panel.classList.contains('open');
  panel.classList.toggle('open');
  if(!wasOpen && !started){
    started = true;
    try {
      var r = await fetch(cfg.chatUrl+'?action=start', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({widget_key:cfg.widgetKey, visitor_name:'Visitor', visitor_email:null, current_page:state.currentPage}) });
      var d = await r.json();
      if(d.conversation_id) {
        state.convoId = d.conversation_id;
        state.visitorToken = d.visitor_token;
        startPolling();
        startHeartbeat();
      }
    } catch(e){ started=false; }
  }
};

document.getElementById('sw-send').onclick = sendMsg;
document.getElementById('sw-input').oninput = function(){ document.getElementById('sw-send').disabled = !this.value.trim(); };
document.getElementById('sw-input').onkeydown = function(e){ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();} };

async function sendMsg(){
  var inp = document.getElementById('sw-input');
  var txt = inp.value.trim();
  if(!txt||!state.convoId) return;
  inp.value=''; document.getElementById('sw-send').disabled=true;
  addMsg('visitor', txt);
  try {
    await fetch(cfg.chatUrl+'?action=send', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({conversation_id:state.convoId, visitor_token:state.visitorToken, content:txt, current_page:state.currentPage}) });
  } catch(e){}
}

function addMsg(type, text){
  var el = document.createElement('div');
  el.className = 'sw-msg ' + type;
  el.textContent = text;
  var container = document.getElementById('sw-messages');
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function startPolling(){
  state.polling = setInterval(async function(){
    try {
      var url = cfg.chatUrl+'?action=poll&conversation_id='+state.convoId+'&visitor_token='+state.visitorToken;
      if(state.lastTs) url += '&after='+encodeURIComponent(state.lastTs);
      var r = await fetch(url);
      var d = await r.json();
      if(d.messages && d.messages.length){
        d.messages.forEach(function(m){
          if(m.sender_type !== 'visitor' && m.sender_type !== 'system' && m.content_type !== 'system'){
            addMsg(m.sender_type, m.content);
          }
          state.lastTs = m.created_at;
        });
      }
    } catch(e){}
  }, 3000);
}

function startHeartbeat(){
  state.heartbeat = setInterval(async function(){
    if(!state.convoId) return;
    try {
      await fetch(cfg.chatUrl+'?action=heartbeat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({conversation_id:state.convoId, visitor_token:state.visitorToken, current_page:getCurrentPage()}) });
    } catch(e){}
  }, 30000);
}

function esc(s){ var d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
})();`;
}
