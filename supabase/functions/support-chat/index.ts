import { handleRequest } from "../_shared/requestHandler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callAI } from "../_shared/aiRouter.ts";
import { corsHeaders } from "../_shared/auth.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient: supabase, req: rawReq }) => {
    const url = new URL(rawReq.url);
    const action = url.searchParams.get("action") || "send";

    if (action === "widget.js") return handleWidgetJs(url, supabase, Deno.env.get("SUPABASE_URL")!);
    if (action === "start") return handleStart(rawReq, supabase);
    if (action === "send") return handleSend(rawReq, supabase);
    if (action === "upload") return handleUpload(rawReq, supabase);
    if (action === "poll") return handlePoll(url, supabase);
    if (action === "heartbeat") return handleHeartbeat(rawReq, supabase);

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }, { functionName: "support-chat", authMode: "none", requireCompany: false, parseBody: false, wrapResult: false })
);

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

// ── Upload Image (visitor) ──
async function handleUpload(req: Request, supabase: any) {
  const { conversation_id, visitor_token, image_data, file_name } = await req.json();
  if (!conversation_id || !visitor_token || !image_data) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: convo } = await supabase
    .from("support_conversations").select("id")
    .eq("id", conversation_id).eq("visitor_token", visitor_token).single();
  if (!convo) return new Response(JSON.stringify({ error: "Invalid" }), {
    status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    // Decode base64 image
    const base64 = image_data.includes(",") ? image_data.split(",")[1] : image_data;
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const ext = (file_name || "image.png").split(".").pop() || "png";
    const path = `${conversation_id}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("support-attachments").upload(path, bytes, { contentType: `image/${ext}` });
    if (upErr) throw upErr;

    const { data: urlData } = supabase.storage.from("support-attachments").getPublicUrl(path);
    const imageUrl = urlData.publicUrl;

    const { data: msg, error } = await supabase.from("support_messages").insert({
      conversation_id, sender_type: "visitor", content: imageUrl, content_type: "image",
    }).select("id, created_at").single();
    if (error) throw error;

    await supabase.from("support_conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation_id);

    return new Response(JSON.stringify({ message_id: msg.id, image_url: imageUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    console.error("Upload error:", err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
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
      agentName: "support",
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
        agentName: "support",
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
      agentName: "support",
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
function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const source = normalized.length === 3
    ? normalized.split("").map((value) => value + value).join("")
    : normalized.padEnd(6, "0").slice(0, 6);

  const r = Number.parseInt(source.slice(0, 2), 16);
  const g = Number.parseInt(source.slice(2, 4), 16);
  const b = Number.parseInt(source.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function generateWidgetJs(config: any, supabaseUrl: string): string {
  const chatUrl = supabaseUrl + "/functions/v1/support-chat";
  const brandColor = typeof config.brand_color === "string" ? config.brand_color : "#635bff";
  const brandSoft = hexToRgba(brandColor, 0.12);
  const brandBorder = hexToRgba(brandColor, 0.2);
  const brandShadow = hexToRgba(brandColor, 0.34);
  const brandGlow = hexToRgba(brandColor, 0.18);
  const cfgJson = JSON.stringify({
    brandName: config.brand_name,
    brandColor,
    welcomeMessage: config.welcome_message,
    widgetKey: config.widget_key,
    chatUrl,
  });

  return `(function(){
if(window.__support_widget_loaded) return;
window.__support_widget_loaded = true;
var cfg = ${cfgJson};
var state = { open:false, convoId:null, visitorToken:null, lastTs:null, polling:null, heartbeat:null, currentPage:window.location.href, unread:0, started:false, loading:false, typingEl:null };
var QUICK_PROMPTS = ['Get a quote', 'Product pricing', 'Delivery info'];
function getCurrentPage(){ return window.location.href; }
function esc(s){ var d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
function formatTime(ts){ var d = ts ? new Date(ts) : new Date(); return d.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }); }
function scrollMessages(){ messages.scrollTop = messages.scrollHeight; }
function setBubbleIcon(open){
  bubble.innerHTML = (open
    ? '<span class="sw-bubble-ring"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span id="sw-badge"></span>'
    : '<span class="sw-bubble-ring"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg><span id="sw-badge"></span>');
  badge = document.getElementById('sw-badge');
  updateBadge();
}
function updateBadge(){
  if(!badge) return;
  if(state.unread > 0 && !state.open){
    badge.textContent = state.unread > 9 ? '9+' : String(state.unread);
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }
}
function showWelcomeCard(){
  if(document.getElementById('sw-welcome')) return;
  var welcome = document.createElement('div');
  welcome.id = 'sw-welcome';
  welcome.className = 'sw-welcome-card';
  welcome.innerHTML =
    '<div class="sw-welcome-badge">AI chat concierge</div>' +
    '<h4>' + esc(cfg.brandName || 'Support') + '</h4>' +
    '<p>' + esc(cfg.welcomeMessage || 'Ask about pricing, delivery, products, or your next project.') + '</p>' +
    '<div class="sw-chip-row">' +
      QUICK_PROMPTS.map(function(prompt){ return '<button class="sw-chip" data-prompt="' + esc(prompt) + '">' + esc(prompt) + '</button>'; }).join('') +
    '</div>';
  messages.appendChild(welcome);
}
function hideWelcomeCard(){
  var welcome = document.getElementById('sw-welcome');
  if(welcome) welcome.remove();
}
function setComposerState(disabled){
  input.disabled = disabled;
  sendBtn.disabled = disabled || !input.value.trim();
  attachBtn.disabled = disabled;
}
function removeTyping(){
  if(state.typingEl && state.typingEl.parentNode) state.typingEl.parentNode.removeChild(state.typingEl);
  state.typingEl = null;
}
function showTyping(){
  removeTyping();
  hideWelcomeCard();
  var row = document.createElement('div');
  row.className = 'sw-row assistant';
  row.innerHTML =
    '<div class="sw-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg></div>' +
    '<div class="sw-bubble-wrap">' +
      '<div class="sw-bubble assistant typing"><span></span><span></span><span></span></div>' +
      '<div class="sw-meta">Support is typing...</div>' +
    '</div>';
  messages.appendChild(row);
  state.typingEl = row;
  scrollMessages();
}
function appendMessage(type, text, imageUrl, createdAt){
  hideWelcomeCard();
  var row = document.createElement('div');
  var assistant = type !== 'visitor';
  row.className = 'sw-row ' + (assistant ? 'assistant' : 'visitor');
  var html = assistant
    ? '<div class="sw-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg></div>'
    : '';
  html += '<div class="sw-bubble-wrap"><div class="sw-bubble ' + (assistant ? 'assistant' : 'visitor') + '"></div><div class="sw-meta">' + (assistant ? 'Support concierge' : 'You') + ' · ' + formatTime(createdAt) + '</div></div>';
  row.innerHTML = html;
  var bubble = row.querySelector('.sw-bubble');
  if(imageUrl){
    var img = document.createElement('img');
    img.src = imageUrl;
    img.className = 'sw-image';
    img.alt = 'Shared image';
    img.onclick = function(){ window.open(imageUrl, '_blank'); };
    bubble.appendChild(img);
    var link = document.createElement('a');
    link.className = 'sw-image-link';
    link.href = imageUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Open image';
    bubble.appendChild(link);
  } else {
    bubble.textContent = text || '';
  }
  messages.appendChild(row);
  scrollMessages();
}
async function startConversation(){
  if(state.started || state.loading) return;
  state.loading = true;
  setComposerState(true);
  try {
    var r = await fetch(cfg.chatUrl + '?action=start', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ widget_key:cfg.widgetKey, visitor_name:'Visitor', visitor_email:null, current_page:state.currentPage })
    });
    var d = await r.json();
    if(d.conversation_id){
      state.started = true;
      state.convoId = d.conversation_id;
      state.visitorToken = d.visitor_token;
      await pollMessages();
      startPolling();
      startHeartbeat();
    }
  } catch(_e) {
    appendMessage('bot', 'We could not start the conversation right now. Please try again in a moment.', null, new Date().toISOString());
  } finally {
    state.loading = false;
    setComposerState(false);
  }
}
async function sendMsg(){
  var txt = input.value.trim();
  if(!txt || !state.convoId || state.loading) return;
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  appendMessage('visitor', txt, null, new Date().toISOString());
  showTyping();
  try {
    await fetch(cfg.chatUrl + '?action=send', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ conversation_id:state.convoId, visitor_token:state.visitorToken, content:txt, current_page:state.currentPage })
    });
  } catch(_e) {
    removeTyping();
    appendMessage('bot', 'Connection error. Please try again.', null, new Date().toISOString());
  }
}
async function uploadImage(file){
  if(!file || !state.convoId || state.loading) return;
  if(!file.type.startsWith('image/')){ window.alert('Only images are supported'); return; }
  if(file.size > 5 * 1024 * 1024){ window.alert('Image must be under 5MB'); return; }
  var reader = new FileReader();
  reader.onload = async function(){
    appendMessage('visitor', null, reader.result, new Date().toISOString());
    showTyping();
    try {
      await fetch(cfg.chatUrl + '?action=upload', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ conversation_id:state.convoId, visitor_token:state.visitorToken, image_data:reader.result, file_name:file.name })
      });
    } catch(_e) {
      removeTyping();
      appendMessage('bot', 'Image upload failed. Please try again.', null, new Date().toISOString());
    }
  };
  reader.readAsDataURL(file);
}
async function pollMessages(){
  if(!state.convoId) return;
  try {
    var url = cfg.chatUrl + '?action=poll&conversation_id=' + encodeURIComponent(state.convoId) + '&visitor_token=' + encodeURIComponent(state.visitorToken);
    if(state.lastTs) url += '&after=' + encodeURIComponent(state.lastTs);
    var r = await fetch(url);
    var d = await r.json();
    if(d.messages && d.messages.length){
      d.messages.forEach(function(m){
        if(m.sender_type !== 'visitor' && m.sender_type !== 'system' && m.content_type !== 'system'){
          removeTyping();
          appendMessage(m.sender_type, m.content_type === 'image' ? null : m.content, m.content_type === 'image' ? m.content : null, m.created_at);
          if(!state.open){ state.unread += 1; updateBadge(); }
        }
        state.lastTs = m.created_at;
      });
    }
  } catch(_e){}
}
function startPolling(){
  if(state.polling) clearInterval(state.polling);
  state.polling = setInterval(function(){ pollMessages(); }, 2500);
}
function startHeartbeat(){
  if(state.heartbeat) clearInterval(state.heartbeat);
  state.heartbeat = setInterval(async function(){
    if(!state.convoId) return;
    try {
      await fetch(cfg.chatUrl + '?action=heartbeat', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ conversation_id:state.convoId, visitor_token:state.visitorToken, current_page:getCurrentPage() })
      });
    } catch(_e){}
  }, 30000);
}
setInterval(function(){ state.currentPage = getCurrentPage(); }, 2000);
window.addEventListener('popstate', function(){ state.currentPage = getCurrentPage(); });

var style = document.createElement('style');
style.textContent = \`
#sw-bubble,#sw-panel,#sw-panel *{box-sizing:border-box;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
#sw-bubble{position:fixed;right:22px;bottom:22px;z-index:99999;width:64px;height:64px;border:none;border-radius:999px;cursor:pointer;color:#fff;background:linear-gradient(135deg, ${brandColor} 0%, ${brandColor} 100%);box-shadow:0 18px 42px ${brandShadow};display:flex;align-items:center;justify-content:center;transition:transform .2s ease,box-shadow .2s ease}
#sw-bubble:hover{transform:scale(1.06);box-shadow:0 22px 54px ${brandShadow}}
#sw-bubble svg{position:relative;z-index:2;width:26px;height:26px;stroke:currentColor}
.sw-bubble-ring{position:absolute;inset:5px;border-radius:999px;border:1px solid rgba(255,255,255,.24)}
#sw-badge{position:absolute;top:-2px;right:-2px;z-index:3;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;display:none;align-items:center;justify-content:center;box-shadow:0 10px 20px rgba(239,68,68,.32)}
#sw-badge.show{display:flex}
#sw-panel{position:fixed;right:22px;bottom:98px;z-index:99999;width:388px;max-height:min(680px,calc(100vh - 128px));display:none;flex-direction:column;border-radius:30px;overflow:hidden;background:#ffffff;border:1px solid rgba(15,23,42,.08);box-shadow:0 32px 90px rgba(15,23,42,.28)}
#sw-panel.open{display:flex;animation:sw-slide-up .22s ease-out}
@keyframes sw-slide-up{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}
#sw-header{position:relative;padding:18px 18px 16px;background:linear-gradient(135deg, ${brandColor} 0%, #0ea5e9 100%);color:#fff}
#sw-header:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at top right, rgba(255,255,255,.22), transparent 34%)}
#sw-header-row{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
#sw-header-main{display:flex;gap:12px;min-width:0}
.sw-header-avatar{width:44px;height:44px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.16);backdrop-filter:blur(6px)}
.sw-header-avatar svg{width:20px;height:20px;stroke:currentColor}
.sw-header-copy{min-width:0}
.sw-header-copy h3{margin:0;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}
.sw-live-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:999px;background:rgba(255,255,255,.14);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.sw-live-pill:before{content:'';width:7px;height:7px;border-radius:999px;background:#34d399;box-shadow:0 0 0 4px rgba(52,211,153,.18)}
.sw-header-copy p{margin:6px 0 0;font-size:12px;line-height:1.55;color:rgba(255,255,255,.88)}
.sw-header-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.sw-header-tag{padding:6px 10px;border-radius:999px;background:rgba(255,255,255,.12);font-size:11px;font-weight:600}
#sw-close{position:relative;z-index:2;width:34px;height:34px;border:none;border-radius:999px;background:rgba(255,255,255,.12);color:#fff;cursor:pointer;font-size:20px;line-height:1;transition:background .2s ease}
#sw-close:hover{background:rgba(255,255,255,.2)}
#sw-messages{flex:1;overflow-y:auto;padding:16px;background:radial-gradient(circle at top, ${brandSoft}, transparent 22%),linear-gradient(180deg,#fbfdff 0%,#f8fafc 100%)}
#sw-messages::-webkit-scrollbar{width:6px}
#sw-messages::-webkit-scrollbar-thumb{background:rgba(148,163,184,.35);border-radius:999px}
.sw-welcome-card{padding:18px;border-radius:24px;background:rgba(255,255,255,.86);border:1px solid rgba(15,23,42,.08);box-shadow:0 18px 36px rgba(15,23,42,.08)}
.sw-welcome-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:${brandSoft};border:1px solid ${brandBorder};color:${brandColor};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.sw-welcome-card h4{margin:12px 0 6px;font-size:18px;font-weight:700;color:#0f172a}
.sw-welcome-card p{margin:0;color:#475569;font-size:13px;line-height:1.65}
.sw-chip-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.sw-chip{border:1px solid ${brandBorder};background:${brandSoft};color:${brandColor};padding:8px 12px;border-radius:999px;font-size:12px;font-weight:600;cursor:pointer;transition:transform .16s ease,background .16s ease}
.sw-chip:hover{transform:translateY(-1px);background:${hexToRgba(brandColor, 0.18)}}
.sw-row{display:flex;gap:10px;max-width:88%;margin-top:14px}
.sw-row.visitor{margin-left:auto;justify-content:flex-end}
.sw-row.assistant{margin-right:auto}
.sw-avatar{width:34px;height:34px;flex-shrink:0;border-radius:12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg, ${brandColor} 0%, #0ea5e9 100%);color:#fff;box-shadow:0 10px 24px ${brandGlow}}
.sw-avatar svg{width:16px;height:16px;stroke:currentColor}
.sw-bubble-wrap{min-width:0}
.sw-bubble{padding:12px 14px;border-radius:22px;font-size:13px;line-height:1.6;word-wrap:break-word;overflow-wrap:anywhere}
.sw-bubble.visitor{background:linear-gradient(135deg, ${brandColor} 0%, #0ea5e9 100%);color:#fff;border-bottom-right-radius:8px;box-shadow:0 16px 30px ${brandGlow}}
.sw-bubble.assistant{background:rgba(255,255,255,.92);color:#0f172a;border:1px solid rgba(15,23,42,.08);border-bottom-left-radius:8px;box-shadow:0 10px 24px rgba(15,23,42,.05)}
.sw-meta{margin-top:6px;padding:0 4px;font-size:10px;color:#64748b}
.sw-row.visitor .sw-meta{text-align:right}
.sw-image{display:block;max-width:220px;max-height:240px;border-radius:16px;object-fit:cover;cursor:pointer}
.sw-image-link{display:inline-flex;margin-top:8px;font-size:11px;font-weight:600;color:${brandColor};text-decoration:none}
.sw-image-link:hover{text-decoration:underline}
.typing{display:inline-flex;align-items:center;gap:5px}
.typing span{width:7px;height:7px;border-radius:999px;background:#94a3b8;animation:sw-wave 1.3s ease-in-out infinite}
.typing span:nth-child(2){animation-delay:.15s}
.typing span:nth-child(3){animation-delay:.3s}
@keyframes sw-wave{0%,60%,100%{transform:translateY(0);opacity:.45}30%{transform:translateY(-5px);opacity:1}}
#sw-composer{padding:14px;border-top:1px solid rgba(15,23,42,.08);background:#fff}
#sw-composer-card{padding:12px;border-radius:26px;border:1px solid rgba(15,23,42,.08);background:#ffffff;box-shadow:0 12px 28px rgba(15,23,42,.05)}
#sw-input-row{display:flex;align-items:flex-end;gap:10px}
.sw-attach-btn{width:42px;height:42px;flex-shrink:0;border-radius:18px;border:1px solid rgba(15,23,42,.1);background:#fff;color:#475569;cursor:pointer;font-size:16px;transition:background .16s ease,color .16s ease}
.sw-attach-btn:hover{background:#f8fafc;color:#0f172a}
#sw-input{flex:1;min-height:58px;max-height:120px;border:none;outline:none;resize:none;background:transparent;color:#0f172a;font-size:13px;line-height:1.55;padding:6px 2px}
#sw-input::placeholder{color:#94a3b8}
#sw-send{height:42px;padding:0 16px;flex-shrink:0;border:none;border-radius:18px;background:linear-gradient(135deg, ${brandColor} 0%, #0ea5e9 100%);color:#fff;font-size:12px;font-weight:700;letter-spacing:.02em;cursor:pointer;box-shadow:0 14px 28px ${brandGlow};transition:transform .16s ease,opacity .16s ease}
#sw-send:hover:not(:disabled){transform:translateY(-1px)}
#sw-send:disabled,.sw-attach-btn:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
#sw-composer-meta{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:10px;padding:0 2px;font-size:11px;color:#64748b}
.sw-meta-badge{display:inline-flex;align-items:center;gap:6px;color:${brandColor};font-weight:600}
@media(max-width:480px){
  #sw-bubble{right:16px;bottom:16px}
  #sw-panel{right:12px;left:12px;width:auto;bottom:92px;max-height:calc(100vh - 112px)}
}
\`;
document.head.appendChild(style);

var bubble = document.createElement('button');
bubble.id = 'sw-bubble';
bubble.setAttribute('aria-label', 'Open support chat');
document.body.appendChild(bubble);
var badge;
setBubbleIcon(false);

var panel = document.createElement('div');
panel.id = 'sw-panel';
panel.innerHTML =
  '<div id="sw-header">' +
    '<div id="sw-header-row">' +
      '<div id="sw-header-main">' +
        '<div class="sw-header-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg></div>' +
        '<div class="sw-header-copy">' +
          '<h3>Support concierge <span class="sw-live-pill">Live</span></h3>' +
          '<p>Modern website support for quotes, products, delivery, and project guidance.</p>' +
          '<div class="sw-header-tags"><span class="sw-header-tag">AI-assisted</span><span class="sw-header-tag">Fast replies</span></div>' +
        '</div>' +
      '</div>' +
      '<button id="sw-close" type="button">&times;</button>' +
    '</div>' +
  '</div>' +
  '<div id="sw-messages"></div>' +
  '<div id="sw-composer">' +
    '<div id="sw-composer-card">' +
      '<div id="sw-input-row">' +
        '<button id="sw-attach" class="sw-attach-btn" type="button" title="Attach image">📎</button>' +
        '<input type="file" id="sw-file" accept="image/*" style="display:none">' +
        '<textarea id="sw-input" rows="2" placeholder="Tell us what you need help with..."></textarea>' +
        '<button id="sw-send" type="button" disabled>Send</button>' +
      '</div>' +
      '<div id="sw-composer-meta"><span>Ask about pricing, delivery, products, or custom fabrication.</span><span class="sw-meta-badge">AI-guided support</span></div>' +
    '</div>' +
  '</div>';
document.body.appendChild(panel);

var messages = document.getElementById('sw-messages');
var input = document.getElementById('sw-input');
var sendBtn = document.getElementById('sw-send');
var attachBtn = document.getElementById('sw-attach');
var fileInput = document.getElementById('sw-file');
showWelcomeCard();

messages.addEventListener('click', function(event){
  var chip = event.target.closest('.sw-chip');
  if(!chip || state.loading) return;
  var prompt = chip.getAttribute('data-prompt');
  if(prompt){
    input.value = prompt;
    sendBtn.disabled = false;
    sendMsg();
  }
});
input.addEventListener('input', function(){
  sendBtn.disabled = state.loading || !input.value.trim();
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});
input.addEventListener('keydown', function(event){
  if(event.key === 'Enter' && !event.shiftKey){
    event.preventDefault();
    sendMsg();
  }
});
sendBtn.addEventListener('click', sendMsg);
attachBtn.addEventListener('click', function(){ fileInput.click(); });
fileInput.addEventListener('change', function(){
  var file = fileInput.files && fileInput.files[0];
  if(file) uploadImage(file);
  fileInput.value = '';
});
document.getElementById('sw-close').addEventListener('click', function(){
  state.open = false;
  panel.classList.remove('open');
  setBubbleIcon(false);
});
bubble.addEventListener('click', async function(){
  state.open = !state.open;
  panel.classList.toggle('open', state.open);
  setBubbleIcon(state.open);
  if(state.open){
    state.unread = 0;
    updateBadge();
    input.focus();
    await startConversation();
  }
});
})();`;
}
