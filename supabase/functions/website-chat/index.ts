import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAIStream, AIError } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter: IP -> timestamps[]
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_CONVERSATION_MESSAGES = 10;

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

const SYSTEM_PROMPT = `You are the AI assistant for Rebar Shop — a rebar fabrication company based in Sydney, Australia.

Your job is to help website visitors learn about our services, products, and capabilities. Be friendly, professional, and concise.

## About Rebar Shop
- We are a rebar fabrication shop specializing in cutting, bending, and delivering reinforcing steel (rebar)
- We serve residential, commercial, and civil construction projects across Sydney and surrounding areas
- Website: www.rebar.shop
- We offer fast turnaround, competitive pricing, and reliable delivery

## Products & Services
- **Cut & Bend Rebar**: Custom fabrication to your bar bending schedules (BBS)
- **Straight Bar Supply**: Stock lengths of deformed bar (N12, N16, N20, N24, N28, N32, N36)
- **Mesh & Accessories**: SL mesh, bar chairs, tie wire, couplers
- **Scheduling & Estimating**: We can read your drawings and prepare bar lists
- **Delivery**: We deliver across Greater Sydney, Central Coast, Blue Mountains, and Wollongong regions

## Bar Sizes Available
- N12 (12mm), N16 (16mm), N20 (20mm), N24 (24mm), N28 (28mm), N32 (32mm), N36 (36mm)
- L-bar (ligature bar) also available

## How to Get a Quote
- Email your drawings or bar bending schedule to us
- Call us directly for urgent quotes
- Use the contact form on rebar.shop
- We typically respond within a few hours

## Guidelines
- Keep responses concise (2-4 sentences when possible)
- If asked about specific pricing, say we provide competitive quotes based on project requirements and encourage them to send their BBS or drawings for an accurate quote
- Always encourage visitors to call or email for quotes
- If asked about things outside rebar/construction, politely redirect to our services
- Use Australian English spelling
- Be warm and helpful — these are potential customers!
- If they ask about delivery times, say it depends on the job size but we pride ourselves on fast turnaround, often within 24-48 hours for standard orders`;

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

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmed = messages.slice(-MAX_CONVERSATION_MESSAGES);

    // Gemini 2.5 Flash: public chatbot, fast + stable
    const response = await callAIStream({
      provider: "gemini",
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...trimmed,
      ],
    });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("website-chat error:", e);
    const status = e instanceof AIError ? e.status : 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
