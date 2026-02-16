import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { WPClient } from "../_shared/wpClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Rate Limiter ───
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_CONVERSATION_MESSAGES = 20;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateLimitMap.set(ip, recent);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) rateLimitMap.delete(ip);
    else rateLimitMap.set(ip, recent);
  }
}, 300_000);

// ─── System Prompt (page-aware) ───
function buildSystemPrompt(currentPage?: string): string {
  const pageContext = currentPage
    ? `\n\n## Current Visitor Context\nThe visitor is currently viewing: ${currentPage}\nUse this to provide contextual help. If they're on a product page, reference that product. If they're on the homepage, help them navigate.`
    : "";

  return `You are the intelligent AI sales assistant for **Rebar Shop** — a rebar fabrication company based in Sydney, Australia.

You have access to LIVE tools that let you search our product catalog, look up rebar specifications, check stock, create quote requests, add items to the visitor's cart, guide them to pages on the website, search our knowledge base, and provide delivery information. USE THESE TOOLS proactively whenever a customer asks about products, prices, sizes, wants a quote, or needs help navigating.

## About Rebar Shop
- Rebar fabrication shop specialising in cutting, bending, and delivering reinforcing steel
- We serve residential, commercial, and civil construction projects across Sydney and surrounding areas
- Website: www.rebar.shop
- Fast turnaround, competitive pricing, reliable delivery
- Operating hours: Monday–Friday 6:00 AM – 4:00 PM AEST
- Phone: (02) 8188 3312
- Email: sales@rebar.shop

## Products & Services
- **Cut & Bend Rebar**: Custom fabrication to bar bending schedules (BBS)
- **Straight Bar Supply**: Stock lengths of deformed bar (N12, N16, N20, N24, N28, N32, N36)
- **Mesh & Accessories**: SL mesh, bar chairs, tie wire, couplers
- **Scheduling & Estimating**: We read drawings and prepare bar lists
- **Delivery**: Greater Sydney, Central Coast, Blue Mountains, Wollongong, Newcastle

## Australian Rebar Standards (AS/NZS 4671)
- Common bar sizes: N12 (12mm, 0.888 kg/m), N16 (16mm, 1.58 kg/m), N20 (20mm, 2.47 kg/m), N24 (24mm, 3.55 kg/m), N28 (28mm, 4.83 kg/m), N32 (32mm, 6.31 kg/m), N36 (36mm, 7.99 kg/m)
- Grade: D500N (normal ductility), D500L (low ductility for mesh)
- Standard stock lengths: 6m, 9m, 12m
- Use lookup_rebar_specs tool for precise data

## Fabrication Capabilities
- Automated cutting & bending machines (up to N36)
- Shape codes per AS/NZS standards
- Custom fabrication from bar bending schedules (BBS)
- Same-day or next-day turnaround on standard orders

## How to Use Tools
- When a customer asks about a product → use search_products
- When they mention a bar size (e.g. N16, N20) → use lookup_rebar_specs to give precise specs
- When they ask about stock → use check_availability
- When they want a quote → collect their name, email, project details, and items, then use create_quote_request
- When they want to buy/add to cart → use add_to_cart with the product ID and quantity
- When they need help finding a page → use navigate_to with the relevant path
- When they ask technical, company, or standards questions → use search_knowledge_base
- When they ask about delivery areas or lead times → use get_delivery_info

## Cart & Navigation
- You can add products directly to the customer's cart using add_to_cart
- You can guide customers to any page on rebar.shop using navigate_to
- Always provide clickable links so customers can easily navigate or add items

## Quote Flow
1. Customer expresses interest in specific products/quantities
2. You look up specs and products using tools
3. You collect: customer name, email (required), phone (optional), project name, list of items
4. You call create_quote_request to submit it
5. Confirm the quote number and tell them the team will follow up

## DATA FIREWALL — STRICTLY ENFORCED
NEVER share: financial data, invoices, bills, bank balances, AR/AP, profit margins, employee salaries, internal meeting notes, strategic plans, lead pipeline data, or internal communications. If asked about pricing, always direct customers to get a formal quote — do not guess or reveal internal cost structures.

## Guidelines
- Keep responses concise (2-4 sentences when possible)
- Use Australian English spelling
- Be warm, professional, and proactive
- For pricing, encourage getting a formal quote — don't guess prices
- If asked about things outside rebar/construction, politely redirect
- ALWAYS use tools when relevant — don't guess about products or specs
- Reference the visitor's current page when it's relevant to their question
- If the visitor asks to speak with a real person or human agent, respond warmly: "Let me connect you with one of our team members — they'll be with you shortly! Our sales team has been notified." Continue to help while they wait.${pageContext}`;
}

// ─── Tool Definitions ───
const tools = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search the WooCommerce product catalog by keyword. Returns product names, prices, and IDs.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keyword (e.g. 'N16', 'mesh', 'tie wire')" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product_details",
      description: "Get full details of a specific WooCommerce product by its ID.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "WooCommerce product ID" },
        },
        required: ["product_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_rebar_specs",
      description: "Look up rebar bar specifications (diameter, mass per metre, area) from the ERP database. Can search by bar code like N12, N16, N20 etc.",
      parameters: {
        type: "object",
        properties: {
          bar_code: { type: "string", description: "Bar code to look up, e.g. 'N16', 'N20', 'N32'. Use '%' for wildcard." },
        },
        required: ["bar_code"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check stock availability for a specific bar code from the ERP floor stock.",
      parameters: {
        type: "object",
        properties: {
          bar_code: { type: "string", description: "Bar code to check, e.g. 'N16', 'N20'" },
        },
        required: ["bar_code"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_quote_request",
      description: "Create a quote request in the ERP system. The sales team will follow up with a formal quote.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "Customer's full name" },
          customer_email: { type: "string", description: "Customer's email address" },
          customer_phone: { type: "string", description: "Customer's phone number (optional)" },
          project_name: { type: "string", description: "Project name or address" },
          items: {
            type: "array",
            description: "List of requested items",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                bar_code: { type: "string" },
                quantity: { type: "string" },
                unit: { type: "string", description: "e.g. metres, tonnes, pieces" },
                notes: { type: "string" },
              },
              required: ["description"],
              additionalProperties: false,
            },
          },
          notes: { type: "string", description: "Additional notes or requirements" },
        },
        required: ["customer_name", "customer_email", "items"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_to_cart",
      description: "Generate a WooCommerce add-to-cart URL for a product. Returns a direct link the customer can click to add the item to their cart.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "WooCommerce product ID to add to cart" },
          quantity: { type: "number", description: "Number of items to add (default 1)" },
        },
        required: ["product_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate_to",
      description: "Generate a link to a specific page on rebar.shop. Use this to guide customers to product pages, categories, contact, or any other page.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Page path or description, e.g. '/shop', '/product/n16-deformed-bar', '/contact', '/product-category/mesh'" },
          label: { type: "string", description: "Display label for the link, e.g. 'View our mesh products'" },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Search the company knowledge base for technical info, standards, company processes, and public documentation. Use this for questions about rebar standards, fabrication processes, company policies, or technical specifications.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term (e.g. 'bend chart', 'AS4671', 'lap splice', 'mesh specifications')" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_delivery_info",
      description: "Get delivery coverage areas, lead times, and minimum order information for Rebar Shop.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
];

// ─── Tool Execution ───
async function executeTool(
  name: string,
  args: Record<string, any>,
  supabase: any,
  wp: WPClient | null,
): Promise<string> {
  try {
    switch (name) {
      case "search_products": {
        if (!wp) return JSON.stringify({ error: "Product catalog temporarily unavailable" });
        const query = String(args.query || "").slice(0, 100);
        const products = await wp.listProducts({ search: query, per_page: "8", status: "publish" });
        const simplified = (products || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          regular_price: p.regular_price,
          sale_price: p.sale_price,
          stock_status: p.stock_status,
          short_description: (p.short_description || "").replace(/<[^>]*>/g, "").slice(0, 150),
          permalink: p.permalink,
        }));
        return JSON.stringify({ products: simplified, count: simplified.length });
      }

      case "get_product_details": {
        if (!wp) return JSON.stringify({ error: "Product catalog temporarily unavailable" });
        const id = String(args.product_id || "");
        if (!id || !/^\d+$/.test(id)) return JSON.stringify({ error: "Invalid product ID" });
        const p = await wp.getProduct(id);
        return JSON.stringify({
          id: p.id,
          name: p.name,
          price: p.price,
          regular_price: p.regular_price,
          description: (p.description || "").replace(/<[^>]*>/g, "").slice(0, 500),
          short_description: (p.short_description || "").replace(/<[^>]*>/g, "").slice(0, 300),
          stock_status: p.stock_status,
          stock_quantity: p.stock_quantity,
          categories: (p.categories || []).map((c: any) => c.name),
          permalink: p.permalink,
          weight: p.weight,
          dimensions: p.dimensions,
        });
      }

      case "lookup_rebar_specs": {
        const barCode = String(args.bar_code || "").toUpperCase().slice(0, 10);
        const { data, error } = await supabase
          .from("rebar_sizes")
          .select("bar_code, diameter_mm, mass_kg_per_m, area_mm2, standard")
          .ilike("bar_code", barCode.includes("%") ? barCode : `%${barCode}%`)
          .limit(10);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify({ specs: data || [], count: (data || []).length });
      }

      case "check_availability": {
        const barCode = String(args.bar_code || "").toUpperCase().slice(0, 10);
        const { data, error } = await supabase
          .from("floor_stock")
          .select("bar_code, length_mm, qty_on_hand, qty_reserved")
          .ilike("bar_code", `%${barCode}%`)
          .gt("qty_on_hand", 0)
          .limit(20);
        if (error) return JSON.stringify({ error: error.message });
        const summary = (data || []).map((row: any) => ({
          bar_code: row.bar_code,
          length_mm: row.length_mm,
          available: row.qty_on_hand - (row.qty_reserved || 0),
          total_on_hand: row.qty_on_hand,
        }));
        return JSON.stringify({ stock: summary, count: summary.length });
      }

      case "create_quote_request": {
        const customerName = String(args.customer_name || "").slice(0, 200);
        const customerEmail = String(args.customer_email || "").slice(0, 200);
        const customerPhone = String(args.customer_phone || "").slice(0, 50);
        const projectName = String(args.project_name || "").slice(0, 300);
        const items = Array.isArray(args.items) ? args.items.slice(0, 20) : [];
        const notes = String(args.notes || "").slice(0, 1000);

        if (!customerName || !customerEmail) {
          return JSON.stringify({ error: "Customer name and email are required" });
        }

        const { data: seqData } = await supabase.rpc("nextval_quote_request_seq");
        const year = new Date().getFullYear();
        let seqNum = 1;
        
        if (seqData != null) {
          seqNum = Number(seqData);
        } else {
          const { count } = await supabase
            .from("quote_requests")
            .select("id", { count: "exact", head: true });
          seqNum = (count || 0) + 1;
        }
        const quoteNumber = `QR-${year}-${String(seqNum).padStart(4, "0")}`;

        const { data, error } = await supabase.from("quote_requests").insert({
          quote_number: quoteNumber,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone || null,
          project_name: projectName || null,
          items,
          notes: notes || null,
          status: "new",
          source: "website_chat",
        }).select("id, quote_number").single();

        if (error) return JSON.stringify({ error: "Failed to create quote request: " + error.message });
        return JSON.stringify({
          success: true,
          quote_number: data.quote_number,
          message: `Quote request ${data.quote_number} created successfully. Our team will review and send a formal quote.`,
        });
      }

      case "add_to_cart": {
        const productId = String(args.product_id || "");
        const quantity = Math.max(1, Math.min(100, Number(args.quantity) || 1));
        if (!productId || !/^\d+$/.test(productId)) {
          return JSON.stringify({ error: "Invalid product ID" });
        }

        // Validate product exists via WP
        let productName = `Product #${productId}`;
        if (wp) {
          try {
            const p = await wp.getProduct(productId);
            productName = p.name || productName;
          } catch {
            // Product might still work, proceed with URL
          }
        }

        const cartUrl = `https://rebar.shop/?add-to-cart=${productId}&quantity=${quantity}`;
        return JSON.stringify({
          success: true,
          cart_url: cartUrl,
          product_name: productName,
          quantity,
          message: `Click here to add ${quantity}x ${productName} to your cart: ${cartUrl}`,
        });
      }

      case "navigate_to": {
        const path = String(args.path || "/shop").slice(0, 500);
        const label = String(args.label || "Visit page").slice(0, 200);
        const fullUrl = path.startsWith("http") ? path : `https://rebar.shop${path.startsWith("/") ? "" : "/"}${path}`;
        return JSON.stringify({
          success: true,
          url: fullUrl,
          label,
          message: `${label}: ${fullUrl}`,
        });
      }

      case "search_knowledge_base": {
        const query = String(args.query || "").slice(0, 200);
        if (!query) return JSON.stringify({ error: "Search query required" });
        const allowedCategories = ["webpage", "company-playbook", "document", "research"];
        const { data, error } = await supabase
          .from("knowledge")
          .select("title, content, category")
          .in("category", allowedCategories)
          .ilike("content", `%${query}%`)
          .order("created_at", { ascending: false })
          .limit(5);
        if (error) return JSON.stringify({ error: error.message });
        const results = (data || []).map((k: any) => ({
          title: k.title,
          category: k.category,
          content: (k.content || "").slice(0, 500),
        }));
        return JSON.stringify({ articles: results, count: results.length });
      }

      case "get_delivery_info": {
        return JSON.stringify({
          coverage_areas: [
            { area: "Greater Sydney", lead_time: "Next day delivery" },
            { area: "Central Coast", lead_time: "1-2 business days" },
            { area: "Blue Mountains", lead_time: "1-2 business days" },
            { area: "Wollongong / Illawarra", lead_time: "1-2 business days" },
            { area: "Newcastle / Hunter", lead_time: "2-3 business days" },
          ],
          minimum_order: "No strict minimum, but delivery fees may apply for small orders",
          delivery_hours: "Monday–Friday 6:00 AM – 4:00 PM",
          notes: "Same-day delivery available for urgent orders placed before 10 AM (Sydney metro only). Contact sales@rebar.shop or call (02) 8188 3312 for special arrangements.",
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e: any) {
    console.error(`Tool ${name} error:`, e.message);
    return JSON.stringify({ error: `Tool error: ${e.message}` });
  }
}

// ─── SSE Stream Parser for Tool Calls ───
async function bufferStreamForToolCalls(response: Response): Promise<{
  content: string;
  toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>;
  finishReason: string | null;
}> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCallsMap: Record<number, { id: string; function: { name: string; arguments: string } }> = {};
  let finishReason: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") continue;

      try {
        const parsed = JSON.parse(json);
        const choice = parsed.choices?.[0];
        if (!choice) continue;

        if (choice.finish_reason) finishReason = choice.finish_reason;

        const delta = choice.delta;
        if (delta?.content) content += delta.content;

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const i = tc.index ?? 0;
            if (!toolCallsMap[i]) {
              toolCallsMap[i] = { id: tc.id || `call_${i}`, function: { name: "", arguments: "" } };
            }
            if (tc.function?.name) toolCallsMap[i].function.name += tc.function.name;
            if (tc.function?.arguments) toolCallsMap[i].function.arguments += tc.function.arguments;
          }
        }
      } catch { /* partial JSON, skip */ }
    }
  }

  return {
    content,
    toolCalls: Object.values(toolCallsMap),
    finishReason,
  };
}

// ─── Main Handler ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("cf-connecting-ip") || "unknown";
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: "Too many requests. Please wait a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, current_page } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle [INIT] message — auto-greeting on panel open
    const lastMsg = messages[messages.length - 1];
    const isInit = lastMsg?.role === "user" && lastMsg?.content?.trim() === "[INIT]";
    
    let trimmed = messages.slice(-MAX_CONVERSATION_MESSAGES);
    if (isInit) {
      // Replace [INIT] with a greeting prompt
      trimmed = [{
        role: "user",
        content: `I just opened the chat widget. I'm currently viewing: ${current_page || "the homepage"}. Please greet me with a warm, contextual welcome message based on the page I'm viewing. Be specific — if I'm on a product page, mention that product. Keep it to 2-3 sentences. Don't be generic.`,
      }];
    }

    const systemPrompt = buildSystemPrompt(current_page);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let wp: WPClient | null = null;
    try { wp = new WPClient(); } catch { /* WP not configured */ }

    // ─── First AI Call (with tools) ───
    const firstResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...trimmed],
        tools,
        stream: true,
      }),
    });

    if (!firstResponse.ok) {
      const status = firstResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Service is busy. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", status, await firstResponse.text());
      return new Response(JSON.stringify({ error: "Chat service temporarily unavailable" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstResult = await bufferStreamForToolCalls(firstResponse);

    // ─── No tool calls → stream directly ───
    if (firstResult.toolCalls.length === 0) {
      const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: systemPrompt }, ...trimmed],
          stream: true,
        }),
      });

      return new Response(streamResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // ─── Execute tool calls in parallel ───
    console.log(`Executing ${firstResult.toolCalls.length} tool call(s)...`);
    const toolResults = await Promise.all(
      firstResult.toolCalls.map(async (tc) => {
        let args: Record<string, any> = {};
        try { args = JSON.parse(tc.function.arguments); } catch { /* empty args */ }
        console.log(`Tool: ${tc.function.name}`, args);
        const result = await executeTool(tc.function.name, args, supabase, wp);
        return { tool_call_id: tc.id, role: "tool" as const, content: result };
      }),
    );

    // ─── Second AI Call with tool results ───
    const followUpMessages = [
      { role: "system", content: systemPrompt },
      ...trimmed,
      {
        role: "assistant",
        content: firstResult.content || null,
        tool_calls: firstResult.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      },
      ...toolResults,
    ];

    const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: followUpMessages,
        stream: true,
      }),
    });

    if (!finalResponse.ok) {
      console.error("Final AI call error:", finalResponse.status);
      const fallback = `data: ${JSON.stringify({ choices: [{ delta: { content: firstResult.content || "I found some information for you but had trouble formatting the response. Please try again." } }] })}\n\ndata: [DONE]\n\n`;
      return new Response(fallback, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    return new Response(finalResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("website-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
