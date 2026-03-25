import { handleRequest } from "../_shared/requestHandler.ts";
import { callAI } from "../_shared/aiRouter.ts";
import { corsHeaders } from "../_shared/auth.ts";

const SYSTEM_PROMPT = `You are a senior full-stack developer and debugging expert analyzing employee feedback/bug reports for a production ERP application built with:
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL, Edge Functions in Deno, Row Level Security, Storage)
- **State Management:** TanStack React Query + React hooks
- **Routing:** React Router v6

Your job: Analyze ALL provided evidence (title, description, screenshots, page context, reopen reasons, historical context) and CLASSIFY the issue, then respond accordingly.

## CLASSIFICATION RULES

1. **code_bug** (confidence: high) — You can clearly identify the broken component/file and know how to fix it. Generate a LOVABLE COMMAND patch.
2. **config_issue** (confidence: high) — It's a database/config/RLS problem, not a UI bug. Generate a LOVABLE COMMAND patch focused on config.
3. **operational** (any confidence) — This is NOT a code bug. It's a business process issue (e.g., "customer didn't pay", "wrong order was shipped"). Route to the right person.
4. **unclear** (confidence: low/medium) — You don't have enough info. Ask specific clarifying questions.

## TEAM DIRECTORY (for routing operational issues)
- **Radin** — Developer, code fixes
- **Vicky** — Office manager, accounting, invoicing, customer issues
- **Neel** — CEO, strategic decisions, approvals
- **Sattar** — Shop floor, production, machines, delivery
- **System** — Automated processes

## OUTPUT FORMAT

You MUST call the classify_and_fix function with your analysis. Never output raw text.`;

Deno.serve((req) =>
  handleRequest(req, async ({ serviceClient, body }) => {
    const {
      title, description, screenshot_url, page_path,
      reopen_reason, original_task_id,
      clarification_answer, original_memory_id,
      user_id, company_id,
    } = body;

    if (!title && !description && !clarification_answer) {
      return new Response(JSON.stringify({ error: "Title, description, or clarification required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch historical context ──
    let historyContext = "";

    const { data: recentTasks } = await serviceClient
      .from("human_tasks")
      .select("title, description, category, status, created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    if (recentTasks?.length) {
      historyContext += "\n## Recent Human Tasks (pattern recognition)\n";
      recentTasks.forEach((t: any) => {
        historyContext += `- [${t.status}] ${t.title} (${t.category || "general"}) — ${t.created_at}\n`;
      });
    }

    const { data: prevMemory } = await serviceClient
      .from("vizzy_memory")
      .select("category, content, metadata, created_at")
      .in("category", ["feedback_fix", "feedback_clarification", "feedback_escalation"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (prevMemory?.length) {
      historyContext += "\n## Previous Feedback Analysis History\n";
      prevMemory.forEach((m: any) => {
        const meta = m.metadata || {};
        historyContext += `- [${m.category}] ${meta.source_title || "untitled"} — ${m.created_at}\n`;
      });
    }

    // ── Build evidence ──
    let evidence = `## Employee Feedback Report\n**Title:** ${title || "No title"}\n`;
    if (description) evidence += `**Description:** ${description}\n`;
    if (page_path) evidence += `**Page:** ${page_path}\n`;
    if (reopen_reason) evidence += `\n## Reopen Reason (issue persists)\n${reopen_reason}\n`;

    if (clarification_answer && original_memory_id) {
      const { data: originalMemory } = await serviceClient
        .from("vizzy_memory")
        .select("content, metadata")
        .eq("id", original_memory_id)
        .single();

      if (originalMemory) {
        const origMeta = (originalMemory as any).metadata || {};
        evidence = `## Original Feedback Report\n**Title:** ${origMeta.source_title || title || "No title"}\n`;
        if (origMeta.source_description) evidence += `**Description:** ${origMeta.source_description}\n`;
        if (origMeta.page_path) evidence += `**Page:** ${origMeta.page_path}\n`;
        evidence += `\n## CEO's Clarification\n${clarification_answer}\n`;
        if (origMeta.questions) {
          evidence += `\n## Original AI Questions\n${(origMeta.questions as string[]).map((q: string, i: number) => `${i + 1}. ${q}`).join("\n")}\n`;
        }
      }
    }

    if (historyContext) evidence += `\n${historyContext}`;

    // Handle screenshot
    const imageBlocks: Array<{ type: string; image_url?: { url: string } }> = [];
    if (screenshot_url) {
      evidence += `**Screenshot:** ${screenshot_url}\n`;
      try {
        const imgResp = await fetch(screenshot_url);
        if (imgResp.ok) {
          const arrayBuffer = await imgResp.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          const contentType = imgResp.headers.get("content-type") || "image/png";
          imageBlocks.push({
            type: "image_url",
            image_url: { url: `data:${contentType};base64,${base64}` },
          });
        }
      } catch (imgErr) {
        console.warn("Failed to fetch screenshot:", screenshot_url, imgErr);
      }
    }

    const userContent = imageBlocks.length > 0
      ? [{ type: "text", text: evidence }, ...imageBlocks]
      : evidence;

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-pro",
      agentName: "feedback-analyzer",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      maxTokens: 3000,
      tools: [{
        type: "function",
        function: {
          name: "classify_and_fix",
          description: "Classify the feedback and provide appropriate response based on confidence level.",
          parameters: {
            type: "object",
            properties: {
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              type: { type: "string", enum: ["code_bug", "config_issue", "operational", "unclear"] },
              patch: { type: "string", description: "Full LOVABLE COMMAND block if confidence is high and type is code_bug or config_issue. Empty string otherwise." },
              questions: { type: "array", items: { type: "string" }, description: "2-3 specific clarifying questions if confidence is low/medium or type is unclear. Empty array otherwise." },
              recommended_person: { type: "string", description: "Who should handle this if it's operational (Radin, Vicky, Neel, Sattar). Empty string for code bugs." },
              recommended_department: { type: "string", description: "Department: development, accounting, production, management. Empty string if not applicable." },
              reasoning: { type: "string", description: "Brief explanation of why this classification was chosen." },
            },
            required: ["confidence", "type", "reasoning"],
          },
        },
      }],
      toolChoice: { type: "function", function: { name: "classify_and_fix" } },
      fallback: { provider: "gemini", model: "gemini-2.5-flash" },
    });

    let classification: any;
    if (result.toolCalls?.length > 0) {
      const tc = result.toolCalls[0];
      const args = typeof tc.function?.arguments === "string"
        ? JSON.parse(tc.function.arguments)
        : tc.function?.arguments || {};
      classification = args;
    } else {
      try {
        classification = JSON.parse(result.content);
      } catch {
        classification = {
          confidence: "high",
          type: "code_bug",
          patch: result.content,
          questions: [],
          recommended_person: "",
          recommended_department: "",
          reasoning: "Fallback: AI returned unstructured response",
        };
      }
    }

    const {
      confidence = "medium",
      type: issueType = "unclear",
      patch = "",
      questions = [],
      recommended_person = "",
      recommended_department = "",
      reasoning = "",
    } = classification;

    const baseMeta = {
      source_title: title,
      source_description: description?.slice(0, 500),
      screenshot_url,
      page_path,
      reopen_reason: reopen_reason || null,
      original_task_id: original_task_id || null,
      original_memory_id: original_memory_id || null,
      confidence,
      issue_type: issueType,
      reasoning,
      generated_at: new Date().toISOString(),
    };

    let savedCategory: string;
    let savedContent: string;

    if ((confidence === "high" || (confidence === "medium" && issueType === "config_issue")) &&
        (issueType === "code_bug" || issueType === "config_issue")) {
      savedCategory = "feedback_fix";
      savedContent = patch || result.content;

      if (original_memory_id) {
        await serviceClient.from("vizzy_memory").delete().eq("id", original_memory_id);
      }
    } else if (issueType === "operational") {
      savedCategory = "feedback_escalation";
      savedContent = reasoning;

      if (recommended_person) {
        const { data: profiles } = await serviceClient
          .from("profiles")
          .select("id, full_name")
          .ilike("full_name", `${recommended_person}%`)
          .limit(1);

        if (profiles?.length) {
          await serviceClient.from("tasks").insert({
            title: `📋 Escalated: ${title || description?.slice(0, 60)}`,
            description: `Reason: ${reasoning}\n\nOriginal feedback: ${description || title}`,
            assigned_to: profiles[0].id,
            status: "open",
            priority: "high",
            source: "system",
            company_id,
          });
        }
      }
    } else {
      savedCategory = "feedback_clarification";
      savedContent = reasoning;
    }

    // Resolve user_id
    let resolvedUserId = user_id;
    if (!resolvedUserId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const anonClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: { user: authUser } } = await anonClient.auth.getUser();
        resolvedUserId = authUser?.id;
      }
    }

    if (!resolvedUserId) {
      const { data: fallbackProfile } = await serviceClient
        .from("profiles")
        .select("user_id")
        .eq("company_id", company_id)
        .limit(1)
        .single();
      resolvedUserId = fallbackProfile?.user_id;
    }

    await serviceClient.from("vizzy_memory").insert({
      category: savedCategory,
      content: savedContent,
      user_id: resolvedUserId,
      company_id,
      metadata: {
        ...baseMeta,
        applied: false,
        questions: questions || [],
        recommended_person: recommended_person || null,
        recommended_department: recommended_department || null,
      },
    });

    if (original_task_id) {
      await serviceClient.from("tasks")
        .update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", original_task_id);
    }

    return {
      success: true,
      category: savedCategory,
      confidence,
      type: issueType,
      reasoning,
      questions: questions || [],
      recommended_person: recommended_person || null,
    };
  }, { functionName: "analyze-feedback-fix", requireCompany: false, wrapResult: false })
);
