import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/aiRouter.ts";
import { salesPrompts } from "../_shared/agents/sales.ts";
import { accountingPrompts } from "../_shared/agents/accounting.ts";
import { operationsPrompts } from "../_shared/agents/operations.ts";
import { supportPrompts } from "../_shared/agents/support.ts";
import { marketingPrompts } from "../_shared/agents/marketing.ts";
import { growthPrompts } from "../_shared/agents/growth.ts";
import { specialistsPrompts } from "../_shared/agents/specialists.ts";
import { empirePrompts } from "../_shared/agents/empire.ts";
import { purchasingPrompts } from "../_shared/agents/purchasing.ts";

import { corsHeaders } from "../_shared/auth.ts";
import { handleRequest } from "../_shared/requestHandler.ts";

// Merge all prompts (excluding social/pixel)
const ALL_PROMPTS: Record<string, string> = {
  ...salesPrompts,
  ...accountingPrompts,
  ...operationsPrompts,
  ...supportPrompts,
  ...growthPrompts,
  ...specialistsPrompts,
  ...empirePrompts,
  ...purchasingPrompts,
  // marketing prompts minus social — only include non-social keys
  ...Object.fromEntries(
    Object.entries(marketingPrompts).filter(([k]) => !["social"].includes(k))
  ),
};

// Agent → prompt file mapping for Lovable patch commands
const AGENT_FILE_MAP: Record<string, string> = {
  sales: "agents/sales.ts",
  commander: "agents/sales.ts",
  accounting: "agents/accounting.ts",
  collections: "agents/accounting.ts",
  shopfloor: "agents/operations.ts",
  delivery: "agents/operations.ts",
  support: "agents/support.ts",
  email: "agents/support.ts",
  estimation: "agents/specialists.ts",
  legal: "agents/specialists.ts",
  data: "agents/specialists.ts",
  empire: "agents/empire.ts",
  growth: "agents/growth.ts",
  eisenhower: "agents/growth.ts",
  bizdev: "agents/growth.ts",
  webbuilder: "agents/growth.ts",
  assistant: "agents/growth.ts",
  copywriting: "agents/marketing.ts",
  talent: "agents/marketing.ts",
  seo: "agents/marketing.ts",
  purchasing: "agents/purchasing.ts",
};

// EXCLUDED from audit
const EXCLUDED_AGENTS = ["social", "pixel"];

Deno.serve((req) =>
  handleRequest(req, async (ctx) => {
    const { userId, serviceClient: supabase, companyId } = ctx;

    // Rate limit: 3 per 30 minutes
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _user_id: userId,
      _function_name: "vizzy-agent-audit",
      _max_requests: 3,
      _window_seconds: 1800,
    });
    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: "Rate limited. Try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = profile?.company_id;
    if (!companyId) {
      return new Response(JSON.stringify({ error: "No company found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch recent chat messages (last 7 days), grouped by agent, excluding Pixel
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: chatMessages } = await supabase
      .from("chat_messages")
      .select("role, content, agent_type, created_at, session_id")
      .gte("created_at", sevenDaysAgo)
      .not("agent_type", "is", null)
      .order("created_at", { ascending: true })
      .limit(500);

    // Group by agent, exclude social/pixel
    const agentConversations: Record<string, { messages: any[]; sessionCount: number }> = {};
    const sessionsByAgent: Record<string, Set<string>> = {};

    for (const msg of (chatMessages || [])) {
      const agentType = (msg.agent_type || "").toLowerCase();
      if (EXCLUDED_AGENTS.includes(agentType)) continue;

      if (!agentConversations[agentType]) {
        agentConversations[agentType] = { messages: [], sessionCount: 0 };
        sessionsByAgent[agentType] = new Set();
      }
      agentConversations[agentType].messages.push(msg);
      sessionsByAgent[agentType].add(msg.session_id);
    }

    for (const agent of Object.keys(agentConversations)) {
      agentConversations[agent].sessionCount = sessionsByAgent[agent]?.size || 0;
    }

    // 2. Fetch agent-created tasks (quality check)
    const { data: agentTasks } = await supabase
      .from("human_tasks")
      .select("title, description, status, priority, category, source_agent, created_at")
      .eq("company_id", companyId)
      .gte("created_at", sevenDaysAgo)
      .not("source_agent", "is", null)
      .limit(100);

    // 3. Fetch agent action log
    const { data: actionLog } = await supabase
      .from("agent_action_log")
      .select("action_type, agent_id, entity_type, created_at, result")
      .eq("company_id", companyId)
      .gte("created_at", sevenDaysAgo)
      .limit(200);

    // Build evidence block with PROMPT SOURCE + CONVERSATION LOGS
    let evidence = `═══ AGENT ACTIVITY & PROMPT SOURCE (Last 7 Days) ═══\n`;
    
    // Include ALL known agents (even inactive ones) so Vizzy can audit prompts
    const allAgentKeys = new Set([
      ...Object.keys(agentConversations),
      ...Object.keys(ALL_PROMPTS),
    ]);

    for (const agent of allAgentKeys) {
      if (EXCLUDED_AGENTS.includes(agent)) continue;
      const file = AGENT_FILE_MAP[agent] || "unknown";
      const convData = agentConversations[agent];
      const promptText = ALL_PROMPTS[agent] || null;

      evidence += `\n--- ${agent.toUpperCase()} (file: ${file}, sessions: ${convData?.sessionCount || 0}, messages: ${convData?.messages.length || 0}) ---\n`;

      // Include actual prompt source (first 2000 chars)
      if (promptText) {
        evidence += `\nCURRENT PROMPT SOURCE (first 2000 chars):\n${promptText.slice(0, 2000)}\n`;
      } else {
        evidence += `\nCURRENT PROMPT SOURCE: [not found]\n`;
      }

      // Include recent conversation samples
      if (convData?.messages.length) {
        evidence += `\nRECENT CONVERSATIONS (last 10):\n`;
        const sample = convData.messages.slice(-10);
        for (const m of sample) {
          evidence += `[${m.role}] ${(m.content || "").slice(0, 300)}\n`;
        }
      } else {
        evidence += `\nRECENT CONVERSATIONS: NONE (inactive)\n`;
      }
    }

    if (agentTasks?.length) {
      evidence += `\n═══ AGENT-CREATED TASKS (${agentTasks.length}) ═══\n`;
      for (const t of agentTasks.slice(0, 30)) {
        evidence += `- [${t.source_agent}] ${t.title} (${t.status}, ${t.priority}) — ${t.category || "uncategorized"}\n`;
      }
    }

    if (actionLog?.length) {
      evidence += `\n═══ AGENT ACTIONS LOG (${actionLog.length}) ═══\n`;
      for (const a of actionLog.slice(0, 30)) {
        evidence += `- ${a.action_type} on ${a.entity_type || "unknown"}\n`;
      }
    }

    // Agent file map for the prompt
    const fileMapStr = Object.entries(AGENT_FILE_MAP)
      .map(([agent, file]) => `${agent} → supabase/functions/_shared/${file}`)
      .join("\n");

    // 4. AI Audit
    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-pro",
      agentName: "vizzy",
      messages: [
        {
          role: "system",
          content: `You are Vizzy's Intelligence Trainer — you audit AI agent performance and generate actionable improvement patches.

TASK: You have FULL READ ACCESS to every agent's prompt source code AND their recent conversation logs. Analyze both — find mismatches between what the prompt instructs and how the agent actually behaves. EXCLUDE social/Pixel entirely.

For EACH agent (active or inactive), produce:

## [AGENT NAME] — Score: X/10
**Strengths:** What the agent does well (be specific with examples from the logs)
**Weaknesses:** Specific issues found (hallucinations, missed opportunities, poor tool usage, role boundary violations)
**Compliance:** Did the agent stay within its role? Did it attempt tasks outside its domain?
**Proactiveness:** Did it create tasks/notifications when it should have? Did it miss obvious follow-up opportunities?
**Task Quality:** If the agent created tasks, were they clear, actionable, and properly prioritized?
**Prompt Health Check:** Does the prompt have clear boundaries, anti-hallucination rules, proper tool instructions, escape hatches for edge cases? Flag any missing guardrails.

### SALES AGENT SPECIAL REPORT (only for sales/commander/blitz):
- Quote accuracy assessment
- Follow-up suggestion quality
- Pipeline coaching effectiveness
- Specific coaching notes for Radin (CEO) on how to improve sales outcomes
- Did the agent use call notes and transcripts effectively for coaching?

### RECOMMENDED FIX (if a prompt-level issue is found):
Generate a structured Lovable command:

\`\`\`
LOVABLE COMMAND:
Fix the [Agent Name] agent prompt in \`supabase/functions/_shared/[file]\`.

PROBLEM: [specific issue found in the conversation logs]
FIX: [exact text to add, remove, or change in the prompt — be surgical and specific]
FILE: supabase/functions/_shared/[file]
DO NOT TOUCH: All other agent files, UI components, edge functions
\`\`\`

AGENT FILE MAP:
${fileMapStr}

RULES:
- Be brutally honest — sugarcoating helps no one
- Score fairly: 7+ means solid, 5-6 needs work, below 5 is concerning
- If an agent has NO activity, note it as "INACTIVE — no sessions in 7 days"
- Sales agent gets the deepest scrutiny — it directly impacts revenue
- Generate Lovable commands ONLY for real issues, not cosmetic preferences
- Each Lovable command must be copy-pasteable into Lovable chat and produce a working fix
- Since you have the ACTUAL prompt source, reference specific sections/lines when suggesting fixes — be surgical
- For inactive agents with no conversations, still audit the prompt source for quality and completeness
- EXCLUDE social/Pixel agent entirely — do not mention it`,
        },
        {
          role: "user",
          content: evidence,
        },
      ],
      temperature: 0.3,
      maxTokens: 8000,
    });

    const auditReport = result.content || "";

    // Save audit to vizzy_memory
    await supabase.from("vizzy_memory").insert({
      user_id: user.id,
      category: "agent_audit",
      content: auditReport,
      metadata: {
        date: new Date().toISOString().split("T")[0],
        agents_audited: Object.keys(agentConversations),
        excluded: EXCLUDED_AGENTS,
      },
      company_id: companyId,
    });

    // Clean old audits (keep last 10)
    const { data: oldAudits } = await supabase
      .from("vizzy_memory")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("category", "agent_audit")
      .order("created_at", { ascending: false });

    if (oldAudits && oldAudits.length > 10) {
      const idsToDelete = oldAudits.slice(10).map((a: any) => a.id);
      await supabase.from("vizzy_memory").delete().in("id", idsToDelete);
    }

    return new Response(
      JSON.stringify({
        audit: auditReport,
        agents_audited: Object.keys(agentConversations),
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("vizzy-agent-audit error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

