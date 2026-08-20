import { handleRequest } from "../_shared/requestHandler.ts";
import { corsHeaders } from "../_shared/auth.ts";

const AGENT_DESCRIPTIONS: Record<string, string> = {
  sales: "Sales pipeline, leads, deals, proposals, follow-ups, CRM, closing deals, revenue, commissions",
  support: "Customer support tickets, complaints, help desk, issue resolution, SLA, satisfaction",
  accounting: "Invoices, payments, billing, AR/AP, QuickBooks, tax, expenses, P&L, payroll, salaries",
  legal: "Contracts, compliance, regulations, liens, disputes, litigation, permits, insurance, OHSA, ESA",
  estimating: "Estimates, quotes, bids, pricing, takeoffs, rebar barlists, tonnage, RFQs, blueprints",
  rebuild: "System rebuild, architecture, multi-tenant RLS, company_id scoping, Supabase edge functions, migrations, debugging, integrations, refactor safety",
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
};

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { message, currentMatch, currentConfidence } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return { agents: [currentMatch || "assistant"], confidence: currentConfidence || 0, method: "keyword_fallback" };
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: classificationPrompt }],
        max_tokens: 150,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error("AI classification failed:", response.status);
      return { agents: [currentMatch || "assistant"], confidence: currentConfidence || 0, method: "keyword_fallback" };
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "{}";

    // Strip markdown code fences if present
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenceMatch) {
      content = fenceMatch[1].trim();
    } else {
      const partialFence = content.match(/```(?:json)?\s*([\s\S]*)/i);
      if (partialFence) content = partialFence[1].trim();
    }
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

    const validAgents = (parsed.agents || []).filter(a => a in AGENT_DESCRIPTIONS);
    if (validAgents.length === 0) validAgents.push("assistant");

    return {
      agents: validAgents,
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || "",
      method: "llm",
    };
  }, { functionName: "agent-router", requireCompany: false, wrapResult: false })
);
