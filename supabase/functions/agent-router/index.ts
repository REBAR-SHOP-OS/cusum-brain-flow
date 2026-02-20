/**
 * LLM-Based Agent Router (Phase 2)
 * Classifies user intent when keyword matching is ambiguous.
 * Uses GPT-4o-mini for speed (~200ms, ~100 tokens).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AGENT_DESCRIPTIONS: Record<string, string> = {
  sales: "Sales pipeline, leads, deals, proposals, follow-ups, CRM, closing deals, revenue, commissions",
  support: "Customer support tickets, complaints, help desk, issue resolution, SLA, satisfaction",
  accounting: "Invoices, payments, billing, AR/AP, QuickBooks, tax, expenses, P&L, payroll, salaries",
  legal: "Contracts, compliance, regulations, liens, disputes, litigation, permits, insurance, OHSA, ESA",
  estimating: "Estimates, quotes, bids, pricing, takeoffs, rebar barlists, tonnage, RFQs, blueprints",
  shopfloor: "Shop floor production, cutting, bending, fabrication, machines, work orders, inventory",
  delivery: "Deliveries, dispatch, shipping, trucks, drivers, routes, logistics, tracking, packing slips",
  email: "Email inbox, compose, reply, forward, drafts, Gmail, threads, attachments",
  social: "Social media posts, Facebook, Instagram, LinkedIn, content scheduling, engagement",
  eisenhower: "Priority matrix, urgent/important tasks, delegation, time management",
  data: "Data analytics, reports, dashboards, charts, KPIs, trends, performance metrics",
  bizdev: "Business development, partnerships, market expansion, strategy, competitor analysis",
  webbuilder: "Website building, landing pages, SEO audit, UX/UI design, page speed",
  assistant: "Calendar, scheduling, meetings, reminders, tasks, daily agenda, organize",
  copywriting: "Copywriting, blog posts, articles, headlines, taglines, brochures, press releases",
  talent: "Hiring, recruitment, job postings, interviews, resumes, HR, onboarding, staffing",
  seo: "SEO, search engine optimization, keywords, rankings, backlinks, organic traffic, meta tags",
  growth: "Personal development, coaching, motivation, goals, productivity, habits, mindset",
  empire: "Multi-platform management, ERP diagnostics, Odoo, WordPress, cross-platform fixes",
  commander: "Department oversight, team KPIs, escalations, department-level performance",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, currentMatch, currentConfidence } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "message required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gptKey = Deno.env.get("GPT_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!gptKey && !geminiKey) {
      return new Response(
        JSON.stringify({ agents: [currentMatch || "assistant"], confidence: currentConfidence || 0, method: "keyword_fallback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentList = Object.entries(AGENT_DESCRIPTIONS)
      .map(([id, desc]) => `- ${id}: ${desc}`)
      .join("\n");

    const classificationPrompt = `You are an intent classifier for a business ERP system. Given a user message, identify the best-matching agent(s).

Available agents:
${agentList}

Rules:
1. Return 1 agent for simple requests, up to 3 for compound requests.
2. Order agents by relevance (most relevant first).
3. If the request is general conversation or unclear, use "assistant".
4. Be decisive — pick the most specific agent, not a generic one.

User message: "${message}"

Respond with ONLY a JSON object: {"agents":["agent_id"],"confidence":0.0-1.0,"reasoning":"one sentence"}`;

    // Try GPT first, fall back to Gemini on 429 or failure
    let response: Response | null = null;
    let usedProvider = "gpt";

    if (gptKey) {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${gptKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: classificationPrompt }],
          max_tokens: 150, temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      });
    }

    if (!response?.ok && geminiKey) {
      console.warn("GPT unavailable (status:", response?.status, "), falling back to Gemini");
      usedProvider = "gemini";
      response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${geminiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [{ role: "user", content: classificationPrompt }],
          max_tokens: 300, temperature: 0.1,
        }),
      });
    }

    if (!response?.ok) {
      console.error("All LLM providers failed:", response?.status);
      return new Response(
        JSON.stringify({ agents: [currentMatch || "assistant"], confidence: currentConfidence || 0, method: "keyword_fallback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "{}";
    console.log("LLM raw response (" + usedProvider + "):", content);
    // Strip markdown code fences if present (Gemini wraps JSON in ```json...```)
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      content = fenceMatch[1].trim();
    } else {
      // If no closing fence (truncated), try to extract JSON after ```json
      const partialFence = content.match(/```(?:json)?\s*([\s\S]*)/i);
      if (partialFence) content = partialFence[1].trim();
    }
    // Try to find the first valid JSON object
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) content = jsonMatch[0];
    content = content.trim();
    
    let parsed: { agents?: string[]; confidence?: number; reasoning?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      console.warn("Failed to parse LLM response:", content);
      parsed = { agents: [currentMatch || "assistant"], confidence: 0 };
    }

    // Validate agent IDs
    const validAgents = (parsed.agents || []).filter(a => a in AGENT_DESCRIPTIONS);
    if (validAgents.length === 0) {
      validAgents.push("assistant");
    }

    return new Response(
      JSON.stringify({
        agents: validAgents,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || "",
        method: "llm",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("agent-router error:", e);
    return new Response(
      JSON.stringify({ agents: ["assistant"], confidence: 0, method: "error_fallback" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
