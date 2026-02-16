import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-widget-key, x-visitor-token",
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

    if (action === "widget.js") {
      return handleWidgetJs(url, supabase, supabaseUrl);
    }
    if (action === "start") {
      return handleStart(req, supabase);
    }
    if (action === "send") {
      return handleSend(req, supabase);
    }
    if (action === "poll") {
      return handlePoll(url, supabase);
    }
    if (action === "heartbeat") {
      return handleHeartbeat(req, supabase);
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("support-chat error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── IP Geolocation (called once on start) ──
async function resolveGeo(ip: string): Promise<{ city: string; country: string } | null> {
  if (!ip || ip === "unknown" || ip === "127.0.0.1") return null;
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,countryCode`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.city ? { city: data.city, country: data.countryCode || data.country } : null;
  } catch {
    return null;
  }
}

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") || "unknown";
}

// ── Widget JS ──
async function handleWidgetJs(url: URL, supabase: any, supabaseUrl: string) {
  const widgetKey = url.searchParams.get("key");
  if (!widgetKey) {
    return new Response("Missing key", { status: 400, headers: corsHeaders });
  }

  const { data: config } = await supabase
    .from("support_widget_configs")
    .select("*")
    .eq("widget_key", widgetKey)
    .eq("enabled", true)
    .single();

  if (!config) {
    return new Response("// Widget not found or disabled", {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/javascript" },
    });
  }

  const widgetJs = generateWidgetJs(config, supabaseUrl);
  return new Response(widgetJs, {
    headers: { ...corsHeaders, "Content-Type": "application/javascript", "Cache-Control": "public, max-age=300" },
  });
}

// ── Start Conversation ──
async function handleStart(req: Request, supabase: any) {
  const { widget_key, visitor_name, visitor_email, current_page } = await req.json();

  const { data: config } = await supabase
    .from("support_widget_configs")
    .select("id, company_id")
    .eq("widget_key", widget_key)
    .eq("enabled", true)
    .single();

  if (!config) {
    return new Response(JSON.stringify({ error: "Widget not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Resolve geolocation from IP
  const ip = getClientIp(req);
  const geo = await resolveGeo(ip);

  const metadata: Record<string, any> = {
    current_page: current_page || null,
    last_seen_at: new Date().toISOString(),
  };
  if (geo) {
    metadata.city = geo.city;
    metadata.country = geo.country;
  }

  const { data: convo, error } = await supabase
    .from("support_conversations")
    .insert({
      company_id: config.company_id,
      widget_config_id: config.id,
      visitor_name: visitor_name?.slice(0, 100) || "Visitor",
      visitor_email: visitor_email?.slice(0, 255) || null,
      status: "open",
      metadata,
    })
    .select("id, visitor_token")
    .single();

  if (error) throw error;

  await supabase.from("support_messages").insert({
    conversation_id: convo.id,
    sender_type: "system",
    content: "Conversation started",
    content_type: "system",
  });

  // Fire-and-forget: proactive AI greeting
  triggerProactiveGreeting(supabase, convo.id, config.company_id, config.id, metadata).catch((e) =>
    console.error("Proactive greeting error:", e)
  );

  // Fire-and-forget: notify all team members
  notifySalesTeam(supabase, config.company_id, visitor_name || "Visitor", metadata).catch((e) =>
    console.error("Sales notification error:", e)
  );

  return new Response(JSON.stringify({ conversation_id: convo.id, visitor_token: convo.visitor_token }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Heartbeat (presence + page tracking) ──
async function handleHeartbeat(req: Request, supabase: any) {
  const { conversation_id, visitor_token, current_page } = await req.json();

  if (!conversation_id || !visitor_token) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify visitor owns this conversation
  const { data: convo } = await supabase
    .from("support_conversations")
    .select("id, metadata")
    .eq("id", conversation_id)
    .eq("visitor_token", visitor_token)
    .single();

  if (!convo) {
    return new Response(JSON.stringify({ error: "Invalid" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const existingMeta = (convo.metadata && typeof convo.metadata === "object") ? convo.metadata : {};
  const updatedMeta = {
    ...existingMeta,
    current_page: current_page || existingMeta.current_page,
    last_seen_at: new Date().toISOString(),
  };

  await supabase
    .from("support_conversations")
    .update({ metadata: updatedMeta })
    .eq("id", conversation_id);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Send Message (visitor) ──
async function handleSend(req: Request, supabase: any) {
  const { conversation_id, content, visitor_token, current_page } = await req.json();

  if (!conversation_id || !content || !visitor_token) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: convo } = await supabase
    .from("support_conversations")
    .select("id, status, company_id, widget_config_id, metadata")
    .eq("id", conversation_id)
    .eq("visitor_token", visitor_token)
    .single();

  if (!convo) {
    return new Response(JSON.stringify({ error: "Invalid conversation" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sanitizedContent = content.slice(0, 5000).trim();
  if (!sanitizedContent) {
    return new Response(JSON.stringify({ error: "Empty message" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: msg, error } = await supabase
    .from("support_messages")
    .insert({
      conversation_id,
      sender_type: "visitor",
      content: sanitizedContent,
    })
    .select("id, created_at")
    .single();

  if (error) throw error;

  // Update last_message_at + metadata (page + presence)
  const existingMeta = (convo.metadata && typeof convo.metadata === "object") ? convo.metadata : {};
  const updatedMeta = {
    ...existingMeta,
    current_page: current_page || existingMeta.current_page,
    last_seen_at: new Date().toISOString(),
  };

  await supabase
    .from("support_conversations")
    .update({ last_message_at: new Date().toISOString(), metadata: updatedMeta })
    .eq("id", conversation_id);

  // Fire-and-forget AI auto-reply
  triggerAiReply(supabase, convo, sanitizedContent, updatedMeta).catch((e) =>
    console.error("AI reply error:", e)
  );

  return new Response(JSON.stringify({ message_id: msg.id, created_at: msg.created_at }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Poll Messages (visitor) ──
async function handlePoll(url: URL, supabase: any) {
  const conversationId = url.searchParams.get("conversation_id");
  const visitorToken = url.searchParams.get("visitor_token");
  const after = url.searchParams.get("after") || "1970-01-01T00:00:00Z";

  if (!conversationId || !visitorToken) {
    return new Response(JSON.stringify({ error: "Missing params" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: convo } = await supabase
    .from("support_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("visitor_token", visitorToken)
    .single();

  if (!convo) {
    return new Response(JSON.stringify({ error: "Invalid" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, sender_type, content, content_type, created_at")
    .eq("conversation_id", conversationId)
    .eq("is_internal_note", false)
    .gt("created_at", after)
    .order("created_at", { ascending: true })
    .limit(50);

  return new Response(JSON.stringify({ messages: messages || [] }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── AI Auto-Reply ──
async function triggerAiReply(supabase: any, convo: any, visitorMessage: string, metadata?: any) {
  const { data: widgetConfig } = await supabase
    .from("support_widget_configs")
    .select("ai_enabled, ai_system_prompt, company_id")
    .eq("id", convo.widget_config_id)
    .single();

  if (!widgetConfig?.ai_enabled) return;

  // Fetch KB articles
  const { data: articles } = await supabase
    .from("kb_articles")
    .select("title, content, excerpt")
    .eq("company_id", widgetConfig.company_id)
    .eq("is_published", true)
    .limit(20);

  // Fetch knowledge base (public-safe categories only)
  const allowedKbCategories = ["webpage", "company-playbook", "document", "research"];
  const { data: knowledgeEntries } = await supabase
    .from("knowledge")
    .select("title, content, category")
    .eq("company_id", widgetConfig.company_id)
    .in("category", allowedKbCategories)
    .order("updated_at", { ascending: false })
    .limit(10);

  const kbContext = (articles || [])
    .map((a: any) => `## ${a.title}\n${a.excerpt || ""}\n${a.content}`)
    .join("\n\n---\n\n");

  const knowledgeContext = (knowledgeEntries || [])
    .map((k: any) => `## ${k.title} [${k.category}]\n${(k.content || "").slice(0, 500)}`)
    .join("\n\n---\n\n");

  const { data: history } = await supabase
    .from("support_messages")
    .select("sender_type, content")
    .eq("conversation_id", convo.id)
    .eq("is_internal_note", false)
    .neq("content_type", "system")
    .order("created_at", { ascending: true })
    .limit(20);

  // Build page context
  const currentPage = metadata?.current_page;
  const pageContext = currentPage ? `\n\n[Visitor is currently viewing: ${currentPage}]` : "";

  const messages = [
    {
      role: "system",
      content: `${widgetConfig.ai_system_prompt || "You are a helpful support assistant."}\n\nDATA FIREWALL: NEVER share financial data, invoices, bills, bank balances, AR/AP, profit margins, employee salaries, internal meeting notes, or strategic plans.\n\nIMPORTANT: If the visitor asks to speak with a real person or a human agent, respond warmly: "Let me connect you with one of our team members — they'll be with you shortly! Our sales team has been notified." The team can jump in at any time.\n\nCRITICAL - CONTACT INFO COLLECTION:\n- Do NOT ask for the visitor's name or contact details upfront. Help them first with their questions about rebar, pricing, stock, and delivery.\n- When the visitor expresses intent to get a quote, place an order, or arrange delivery, THEN naturally ask for their name and email so the team can follow up.\n- Keep it conversational -- e.g. "Happy to put that quote together! Could I grab your name and the best email to send it to?"\n- Never pressure for contact info. Build trust first by being helpful.\n\n## Knowledge Base Articles:\n${kbContext || "No articles available."}\n\n## Company Knowledge:\n${knowledgeContext || "No entries."}${pageContext}`,
    },
    ...(history || []).map((m: any) => ({
      role: m.sender_type === "visitor" ? "user" : "assistant",
      content: m.content,
    })),
  ];

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.error("LOVABLE_API_KEY not set, skipping AI reply");
    return;
  }

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
      stream: false,
    }),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("AI gateway error:", aiResponse.status, errText);
    return;
  }

  const aiData = await aiResponse.json();
  const reply = aiData.choices?.[0]?.message?.content;

  if (!reply) return;

  await supabase.from("support_messages").insert({
    conversation_id: convo.id,
    sender_type: "bot",
    content: reply.slice(0, 5000),
  });
}

// ── Proactive AI Greeting ──
async function triggerProactiveGreeting(supabase: any, conversationId: string, companyId: string, widgetConfigId: string, metadata: any) {
  const { data: widgetConfig } = await supabase
    .from("support_widget_configs")
    .select("ai_enabled, ai_system_prompt")
    .eq("id", widgetConfigId)
    .single();

  if (!widgetConfig?.ai_enabled) return;

  const currentPage = metadata?.current_page || "";
  const city = metadata?.city || "";

  const greetingPrompt = `You are a friendly support assistant. A new visitor just opened the chat widget.${currentPage ? ` They are currently viewing: ${currentPage}` : ""}${city ? ` They appear to be from ${city}.` : ""}

Generate a warm, contextual welcome message (2-3 sentences max). If they're on a product page, reference that product and offer to help with pricing or a quote. If they're on the homepage, welcome them and ask how you can help. Be natural and conversational, not robotic. Do NOT use generic greetings like "How can I help you today?" — be specific based on their page context.

If the visitor asks to speak to a real person at any point, let them know a team member will be with them shortly and that the sales team has been notified.`;

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return;

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: greetingPrompt }],
      stream: false,
    }),
  });

  if (!aiResponse.ok) return;

  const aiData = await aiResponse.json();
  const reply = aiData.choices?.[0]?.message?.content;
  if (!reply) return;

  await supabase.from("support_messages").insert({
    conversation_id: conversationId,
    sender_type: "bot",
    content: reply.slice(0, 2000),
  });
}

// ── Notify Sales Team ──
async function notifySalesTeam(supabase: any, companyId: string, visitorName: string, metadata: any) {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("company_id", companyId);

  if (!profiles || profiles.length === 0) return;

  const city = metadata?.city || "Unknown location";
  const page = metadata?.current_page || "homepage";
  const pageName = page.replace(/^https?:\/\/[^/]+/, "").replace(/\/$/, "") || "/";

  const notifications = profiles.map((p: any) => ({
    user_id: p.user_id,
    type: "notification",
    title: "🟢 New Website Visitor",
    description: `${visitorName} from ${city} viewing ${pageName}`,
    link_to: "/support-inbox",
    agent_name: "Support",
    status: "unread",
    priority: "high",
    metadata: { conversation_type: "support_visitor" },
  }));

  await supabase.from("notifications").insert(notifications);
}

// ── Widget JS Generator ──
function generateWidgetJs(config: any, supabaseUrl: string): string {
  const chatUrl = `${supabaseUrl}/functions/v1/support-chat`;
  return `
(function(){
  if(window.__support_widget_loaded) return;
  window.__support_widget_loaded = true;

  var cfg = ${JSON.stringify({
    brandName: config.brand_name,
    brandColor: config.brand_color,
    welcomeMessage: config.welcome_message,
    widgetKey: config.widget_key,
    chatUrl,
  })};

  var state = { open: false, convoId: null, visitorToken: null, messages: [], lastTs: null, polling: null, heartbeat: null, currentPage: window.location.href };

  // Track page changes
  function getCurrentPage() { return window.location.href; }
  setInterval(function(){ state.currentPage = getCurrentPage(); }, 2000);
  window.addEventListener('popstate', function(){ state.currentPage = getCurrentPage(); });

  // Create styles
  var style = document.createElement('style');
  style.textContent = \`
    #sw-bubble { position:fixed; bottom:20px; right:20px; z-index:99999; width:56px; height:56px; border-radius:50%; background:\${cfg.brandColor}; color:#fff; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 16px rgba(0,0,0,0.2); transition:transform 0.2s; }
    #sw-bubble:hover { transform:scale(1.1); }
    #sw-bubble svg { width:24px; height:24px; fill:currentColor; }
    #sw-panel { position:fixed; bottom:84px; right:20px; z-index:99999; width:360px; max-height:500px; background:#fff; border-radius:16px; box-shadow:0 8px 32px rgba(0,0,0,0.15); display:none; flex-direction:column; overflow:hidden; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
    #sw-panel.open { display:flex; animation:sw-slide-in 0.2s ease-out; }
    @keyframes sw-slide-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    #sw-header { padding:14px 16px; background:\${cfg.brandColor}; color:#fff; display:flex; align-items:center; justify-content:space-between; }
    #sw-header h3 { margin:0; font-size:15px; font-weight:600; }
    #sw-header button { background:none; border:none; color:#fff; cursor:pointer; font-size:20px; line-height:1; }
    #sw-messages { flex:1; overflow-y:auto; padding:12px; max-height:320px; min-height:200px; }
    .sw-msg { margin-bottom:8px; max-width:85%; padding:8px 12px; border-radius:12px; font-size:13px; line-height:1.4; word-wrap:break-word; }
    .sw-msg.visitor { margin-left:auto; background:\${cfg.brandColor}; color:#fff; border-bottom-right-radius:4px; }
    .sw-msg.agent,.sw-msg.bot,.sw-msg.system { background:#f0f0f0; color:#333; border-bottom-left-radius:4px; }
    #sw-input-area { padding:10px; border-top:1px solid #eee; display:flex; gap:6px; }
    #sw-input { flex:1; border:1px solid #ddd; border-radius:8px; padding:8px 12px; font-size:13px; outline:none; resize:none; font-family:inherit; }
    #sw-input:focus { border-color:\${cfg.brandColor}; }
    #sw-send { background:\${cfg.brandColor}; color:#fff; border:none; border-radius:8px; padding:8px 14px; cursor:pointer; font-size:13px; font-weight:500; }
    #sw-send:disabled { opacity:0.5; cursor:not-allowed; }
    
    @media(max-width:420px){ #sw-panel{ width:calc(100vw - 24px); right:12px; bottom:80px; } }
  \`;
  document.head.appendChild(style);

  // Create bubble
  var bubble = document.createElement('button');
  bubble.id = 'sw-bubble';
  bubble.setAttribute('aria-label','Open chat');
  bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';
  document.body.appendChild(bubble);

  // Create panel
  var panel = document.createElement('div');
  panel.id = 'sw-panel';
  panel.innerHTML = '<div id="sw-header"><h3>'+esc(cfg.brandName)+'</h3><button onclick="document.getElementById(\\'sw-panel\\').classList.remove(\\'open\\')">&times;</button></div>'
    + '<div id="sw-messages"></div>'
    + '<div id="sw-input-area"><textarea id="sw-input" rows="1" placeholder="Type a message..."></textarea><button id="sw-send" disabled>Send</button></div>';
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
            if(m.sender_type !== 'visitor'){
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
})();
`;
}
