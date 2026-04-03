import { handleRequest } from "../_shared/requestHandler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Rebar product catalog for tool responses
const PRODUCT_CATALOG = [
  { id: "10M", name: "10M Rebar", diameter: "11.3mm", weight: "0.785 kg/m", grades: ["400W", "500W"], priceRange: "$0.85-1.10/kg" },
  { id: "15M", name: "15M Rebar", diameter: "16.0mm", weight: "1.570 kg/m", grades: ["400W", "500W"], priceRange: "$0.80-1.05/kg" },
  { id: "20M", name: "20M Rebar", diameter: "19.5mm", weight: "2.355 kg/m", grades: ["400W", "500W"], priceRange: "$0.78-1.00/kg" },
  { id: "25M", name: "25M Rebar", diameter: "25.2mm", weight: "3.925 kg/m", grades: ["400W", "500W"], priceRange: "$0.75-0.95/kg" },
  { id: "30M", name: "30M Rebar", diameter: "29.9mm", weight: "5.495 kg/m", grades: ["400W", "500W"], priceRange: "$0.73-0.92/kg" },
  { id: "35M", name: "35M Rebar", diameter: "35.7mm", weight: "7.850 kg/m", grades: ["400W", "500W"], priceRange: "$0.70-0.90/kg" },
];

const BENDING_TYPES = [
  { id: "straight", name: "Straight Cut", surcharge: 0 },
  { id: "L-shape", name: "L-Shape Bend", surcharge: 0.05 },
  { id: "U-shape", name: "U-Shape / Stirrup", surcharge: 0.08 },
  { id: "custom", name: "Custom Shape", surcharge: 0.12 },
];

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_product_recommendations",
      description: "Get rebar product recommendations based on project needs. Returns product cards with specs and pricing.",
      parameters: {
        type: "object",
        properties: {
          project_type: { type: "string", description: "Type of project (residential, commercial, industrial, infrastructure)" },
          size_preference: { type: "string", description: "Preferred bar size if mentioned (10M, 15M, 20M, 25M, 30M, 35M)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "estimate_quote",
      description: "Calculate a ballpark price estimate for a rebar order. Use when the user provides bar size, quantity, and optionally bending type.",
      parameters: {
        type: "object",
        properties: {
          bar_size: { type: "string", description: "Bar size code (10M, 15M, 20M, 25M, 30M, 35M)" },
          quantity_tonnes: { type: "number", description: "Quantity in tonnes" },
          quantity_pieces: { type: "number", description: "Number of pieces if specified instead of tonnes" },
          length_m: { type: "number", description: "Length per piece in meters (default 6m)" },
          bending_type: { type: "string", enum: ["straight", "L-shape", "U-shape", "custom"], description: "Type of bending required" },
        },
        required: ["bar_size"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "capture_lead",
      description: "Save a visitor's contact info as a sales lead. Use when the visitor provides their name, email, or asks to be contacted.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Visitor's name" },
          email: { type: "string", description: "Visitor's email" },
          phone: { type: "string", description: "Visitor's phone number" },
          company_name: { type: "string", description: "Visitor's company name" },
          project_description: { type: "string", description: "Brief description of their project or needs" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "request_human_handoff",
      description: "Flag the conversation for human salesperson follow-up. Use when the visitor explicitly asks to talk to a person or when the deal is complex.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why human handoff is needed" },
          urgency: { type: "string", enum: ["low", "medium", "high"], description: "Urgency level" },
        },
        required: ["reason"],
      },
    },
  },
];

function executeGetProductRecommendations(args: any) {
  let products = PRODUCT_CATALOG;
  if (args.size_preference) {
    const pref = products.find(p => p.id === args.size_preference);
    if (pref) products = [pref, ...products.filter(p => p.id !== args.size_preference).slice(0, 2)];
  }
  return { products: products.slice(0, 4), note: "Prices are ballpark estimates. Request a formal quote for exact pricing." };
}

function executeEstimateQuote(args: any) {
  const product = PRODUCT_CATALOG.find(p => p.id === args.bar_size);
  if (!product) return { error: "Unknown bar size. Available: 10M, 15M, 20M, 25M, 30M, 35M" };

  const weightPerM = parseFloat(product.weight);
  const lengthM = args.length_m || 6;
  let totalKg: number;

  if (args.quantity_tonnes) {
    totalKg = args.quantity_tonnes * 1000;
  } else if (args.quantity_pieces) {
    totalKg = args.quantity_pieces * weightPerM * lengthM;
  } else {
    totalKg = 1000; // default 1 tonne
  }

  const basePricePerKg = 0.85;
  const bending = BENDING_TYPES.find(b => b.id === (args.bending_type || "straight")) || BENDING_TYPES[0];
  const pricePerKg = basePricePerKg * (1 + bending.surcharge);

  // Volume discount
  const tonnes = totalKg / 1000;
  const discount = tonnes >= 20 ? 0.08 : tonnes >= 10 ? 0.05 : tonnes >= 5 ? 0.03 : 0;
  const finalPricePerKg = pricePerKg * (1 - discount);
  const totalEstimate = totalKg * finalPricePerKg;

  return {
    bar_size: args.bar_size,
    total_weight_kg: Math.round(totalKg),
    total_weight_tonnes: +(totalKg / 1000).toFixed(2),
    bending: bending.name,
    price_per_kg: +finalPricePerKg.toFixed(2),
    volume_discount: `${(discount * 100).toFixed(0)}%`,
    estimated_total: `$${totalEstimate.toFixed(0)} - $${(totalEstimate * 1.2).toFixed(0)} CAD`,
    note: "This is a ballpark estimate. Final pricing depends on steel market rates, exact specifications, and delivery requirements. Request a formal quote for exact pricing.",
  };
}

async function executeCaptureLeadFn(args: any) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const sb = createClient(supabaseUrl, serviceKey);

    // Find the default company (first company) to associate the lead
    const { data: companies } = await sb.from("companies").select("id").limit(1).single();
    const companyId = companies?.id;

    if (companyId) {
      await sb.from("sales_contacts").insert({
        company_id: companyId,
        name: args.name || "Website Visitor",
        email: args.email || null,
        phone: args.phone || null,
        company_name: args.company_name || null,
        notes: args.project_description || "Lead captured from website sales concierge",
        source: "website-sales-concierge",
      });
    }
    return { success: true, message: "Contact info saved. Our team will reach out shortly!" };
  } catch (e) {
    console.error("Lead capture error:", e);
    return { success: true, message: "We've noted your details. Our team will be in touch!" };
  }
}

function executeHumanHandoff(args: any) {
  return {
    handoff_requested: true,
    message: `Your request has been flagged for our sales team (${args.urgency || "medium"} priority). A representative will reach out to you shortly.`,
    next_steps: "In the meantime, feel free to continue chatting with me or leave your contact info so we can reach you.",
  };
}

const SYSTEM_PROMPT = `You are the AI Sales Concierge for REBAR SHOP — a Canadian rebar fabrication company specializing in cut & bent reinforcing steel.

## Your Personality
- Warm, confident, knowledgeable — like a top-performing salesperson
- You're helpful but goal-oriented: your job is to convert visitors into quote requests
- Use a professional but approachable tone
- Keep responses concise and action-oriented

## What You Know
- Full rebar product line: 10M through 35M bars
- Custom bending services: stirrups, L-shapes, U-shapes, custom shapes
- Delivery across Greater Toronto Area and Southern Ontario  
- Competitive pricing with volume discounts
- Quick turnaround times (usually 2-5 business days)

## Your Tools
You have access to tools for:
1. **Product recommendations** — show product cards with specs
2. **Quote estimation** — give ballpark pricing  
3. **Lead capture** — save contact info for follow-up
4. **Human handoff** — connect them with a real salesperson

## Rules
- ALWAYS use tools when appropriate — show product cards, give estimates
- After giving an estimate, ALWAYS suggest getting a formal quote (capture lead)
- If someone seems like a serious buyer (mentions specific project, quantities), proactively offer to capture their info
- When someone says they want to talk to a person, use the handoff tool
- Never make up exact prices — use the estimation tool
- Respond in the same language the user writes in
- If [INIT] message, give a warm 1-2 sentence greeting mentioning you can help with quotes, products, and custom fabrication`;

async function handleChat(messages: any[], currentPage?: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const systemMessages = [{ role: "system", content: SYSTEM_PROMPT }];
  if (currentPage) {
    systemMessages.push({ role: "system", content: `The visitor is currently on: ${currentPage}` });
  }

  let allMessages = [...systemMessages, ...messages];
  
  // Allow up to 3 rounds of tool calling
  for (let round = 0; round < 3; round++) {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: allMessages,
        tools: TOOLS,
        stream: false,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      if (status === 429) throw new Error("Rate limit exceeded");
      if (status === 402) throw new Error("Credits exhausted");
      throw new Error(`AI gateway error: ${status} — ${text}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    
    if (!choice?.message?.tool_calls?.length) {
      // No tool calls — return the final text response
      return { reply: choice?.message?.content || "How can I help you today?", toolResults: [] };
    }

    // Process tool calls
    const toolResults: any[] = [];
    allMessages.push(choice.message);

    for (const tc of choice.message.tool_calls) {
      const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
      let result: any;

      switch (tc.function.name) {
        case "get_product_recommendations":
          result = executeGetProductRecommendations(args);
          toolResults.push({ type: "products", data: result });
          break;
        case "estimate_quote":
          result = executeEstimateQuote(args);
          toolResults.push({ type: "quote", data: result });
          break;
        case "capture_lead":
          result = await executeCaptureLeadFn(args);
          toolResults.push({ type: "lead_captured", data: result });
          break;
        case "request_human_handoff":
          result = executeHumanHandoff(args);
          toolResults.push({ type: "handoff", data: result });
          break;
        default:
          result = { error: "Unknown tool" };
      }

      allMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }

    // Continue loop — let the model generate a response that references tool results
  }

  return { reply: "I'd love to help! Could you tell me more about your project?", toolResults: [] };
}

// Streaming version for chat
async function handleChatStream(messages: any[], currentPage?: string) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const systemMessages = [{ role: "system", content: SYSTEM_PROMPT }];
  if (currentPage) {
    systemMessages.push({ role: "system", content: `The visitor is currently on: ${currentPage}` });
  }

  // First do a non-streaming call to handle tool calls
  let allMessages = [...systemMessages, ...messages];
  const toolResults: any[] = [];

  for (let round = 0; round < 3; round++) {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: allMessages,
        tools: TOOLS,
        stream: false,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      await response.text();
      if (status === 429) throw new Error("Rate limit exceeded");
      if (status === 402) throw new Error("Credits exhausted");
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice?.message?.tool_calls?.length) {
      // Return as streaming format
      const content = choice?.message?.content || "How can I help you today?";
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Send tool results first if any
          if (toolResults.length) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ toolResults })}\n\n`));
          }
          // Send content as SSE
          const words = content.split(/(\s+)/);
          let i = 0;
          const chunk_size = 3;
          function pushChunk() {
            if (i >= words.length) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
            const slice = words.slice(i, i + chunk_size).join("");
            i += chunk_size;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: slice } }] })}\n\n`));
            setTimeout(pushChunk, 20);
          }
          pushChunk();
        },
      });
      return stream;
    }

    // Process tool calls
    allMessages.push(choice.message);
    for (const tc of choice.message.tool_calls) {
      const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
      let result: any;
      switch (tc.function.name) {
        case "get_product_recommendations":
          result = executeGetProductRecommendations(args);
          toolResults.push({ type: "products", data: result });
          break;
        case "estimate_quote":
          result = executeEstimateQuote(args);
          toolResults.push({ type: "quote", data: result });
          break;
        case "capture_lead":
          result = await executeCaptureLeadFn(args);
          toolResults.push({ type: "lead_captured", data: result });
          break;
        case "request_human_handoff":
          result = executeHumanHandoff(args);
          toolResults.push({ type: "handoff", data: result });
          break;
        default:
          result = { error: "Unknown tool" };
      }
      allMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
    }
  }

  // Fallback
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "How can I help you with your rebar needs?" } }] })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, current_page, mode } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "quick-quote") {
      // Non-streaming for quick quote wizard
      const result = await handleChat(messages, current_page);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: streaming mode
    const stream = await handleChatStream(messages, current_page);
    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Rate limit") ? 429 : msg.includes("Credits") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
