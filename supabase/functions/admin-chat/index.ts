import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFullVizzyContext } from "../_shared/vizzyFullContext.ts";
import { buildPageContext } from "../_shared/pageMap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ═══ JARVIS TOOLS ═══

const WRITE_TOOLS = new Set([
  "update_machine_status",
  "update_delivery_status",
  "update_lead_status",
  "update_cut_plan_status",
  "create_event",
]);

const JARVIS_TOOLS = [
  // Memory tools
  {
    type: "function",
    function: {
      name: "save_memory",
      description: "Save something to persistent memory so you can recall it in future sessions.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["business", "personal", "reminder", "insight"], description: "Category of the memory" },
          content: { type: "string", description: "The content to remember" },
          expires_at: { type: "string", description: "Optional ISO date when this memory should expire" },
        },
        required: ["category", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_memory",
      description: "Delete a memory by its ID when the user asks to forget something.",
      parameters: {
        type: "object",
        properties: {
          memory_id: { type: "string", description: "UUID of the memory to delete" },
        },
        required: ["memory_id"],
        additionalProperties: false,
      },
    },
  },
  // Read tools
  {
    type: "function",
    function: {
      name: "list_machines",
      description: "Query machines with optional status filter. Returns structured JSON with id, name, status, type.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["idle", "running", "blocked", "down"], description: "Filter by status" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_deliveries",
      description: "Query deliveries with optional status and date filters.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status" },
          date: { type: "string", description: "Filter by scheduled_date (YYYY-MM-DD)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_orders",
      description: "Query work orders with optional status filter.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_leads",
      description: "Query leads with optional status or minimum score filter.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status" },
          min_score: { type: "number", description: "Minimum lead_score" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_stock_levels",
      description: "Query inventory stock levels, optionally filtered by bar_code.",
      parameters: {
        type: "object",
        properties: {
          bar_code: { type: "string", description: "Filter by specific bar code" },
        },
        additionalProperties: false,
      },
    },
  },
  // Write tools (require confirmation)
  {
    type: "function",
    function: {
      name: "update_machine_status",
      description: "Update the status of a machine. Requires user confirmation. Use list_machines first to get the ID.",
      parameters: {
        type: "object",
        properties: {
          machine_id: { type: "string", description: "UUID of the machine" },
          status: { type: "string", enum: ["idle", "running", "blocked", "down"], description: "New status" },
        },
        required: ["machine_id", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_delivery_status",
      description: "Update the status of a delivery. Requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          delivery_id: { type: "string", description: "UUID of the delivery" },
          status: { type: "string", description: "New status" },
        },
        required: ["delivery_id", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead_status",
      description: "Update the status of a lead. Requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "UUID of the lead" },
          status: { type: "string", description: "New status" },
        },
        required: ["lead_id", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_cut_plan_status",
      description: "Update the status of a cut plan. Requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          cut_plan_id: { type: "string", description: "UUID of the cut plan" },
          status: { type: "string", enum: ["draft", "queued", "running", "completed", "canceled"], description: "New status" },
        },
        required: ["cut_plan_id", "status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event",
      description: "Log an activity event. Requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", description: "Type of entity (e.g. machine, delivery, order)" },
          entity_id: { type: "string", description: "UUID of the entity" },
          event_type: { type: "string", description: "Type of event" },
          description: { type: "string", description: "Description of the event" },
        },
        required: ["entity_type", "event_type", "description"],
        additionalProperties: false,
      },
    },
  },
];

// ═══ READ TOOL EXECUTION ═══

async function executeReadTool(supabase: any, toolName: string, args: any): Promise<string> {
  switch (toolName) {
    case "list_machines": {
      let q = supabase.from("machines").select("id, name, status, type, current_operator_id").limit(50);
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data || []);
    }
    case "list_deliveries": {
      let q = supabase.from("deliveries").select("id, delivery_number, status, scheduled_date, driver_name, vehicle, notes").limit(50);
      if (args.status) q = q.eq("status", args.status);
      if (args.date) q = q.eq("scheduled_date", args.date);
      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data || []);
    }
    case "list_orders": {
      let q = supabase.from("work_orders").select("id, status, created_at, updated_at").limit(50);
      if (args.status) q = q.eq("status", args.status);
      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data || []);
    }
    case "list_leads": {
      let q = supabase.from("leads").select("id, contact_name, company_name, status, expected_revenue, lead_score, stage").limit(50);
      if (args.status) q = q.eq("status", args.status);
      if (args.min_score) q = q.gte("lead_score", args.min_score);
      q = q.order("lead_score", { ascending: false });
      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data || []);
    }
    case "get_stock_levels": {
      let q = supabase.from("inventory_lots").select("id, bar_code, qty_on_hand, location").gt("qty_on_hand", 0).limit(50);
      if (args.bar_code) q = q.eq("bar_code", args.bar_code);
      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data || []);
    }
    default:
      return JSON.stringify({ error: `Unknown read tool: ${toolName}` });
  }
}

// ═══ WRITE TOOL EXECUTION (only called after confirmation) ═══

async function executeWriteTool(supabase: any, userId: string, companyId: string, toolName: string, args: any): Promise<any> {
  switch (toolName) {
    case "update_machine_status": {
      const { data, error } = await supabase.from("machines").update({ status: args.status }).eq("id", args.machine_id).select().single();
      if (error) throw error;
      return { success: true, message: `Machine status changed to ${args.status}`, data };
    }
    case "update_delivery_status": {
      const { data, error } = await supabase.from("deliveries").update({ status: args.status }).eq("id", args.delivery_id).select().single();
      if (error) throw error;
      return { success: true, message: `Delivery status updated to ${args.status}`, data };
    }
    case "update_lead_status": {
      const { data, error } = await supabase.from("leads").update({ status: args.status }).eq("id", args.lead_id).select().single();
      if (error) throw error;
      return { success: true, message: `Lead status updated to ${args.status}`, data };
    }
    case "update_cut_plan_status": {
      const { data, error } = await supabase.from("cut_plans").update({ status: args.status }).eq("id", args.cut_plan_id).select().single();
      if (error) throw error;
      return { success: true, message: `Cut plan status updated to ${args.status}`, data };
    }
    case "create_event": {
      const { data, error } = await supabase.from("activity_events").insert({
        company_id: companyId,
        entity_type: args.entity_type,
        entity_id: args.entity_id || crypto.randomUUID(),
        event_type: args.event_type,
        description: args.description,
        actor_id: userId,
        actor_type: "jarvis",
        source: "system",
      }).select().single();
      if (error) throw error;
      return { success: true, message: `Event logged: ${args.event_type}`, data };
    }
    default:
      throw new Error(`Unknown write tool: ${toolName}`);
  }
}

async function logAction(supabase: any, userId: string, companyId: string, tool: string, args: any, result: any) {
  await supabase.from("activity_events").insert({
    company_id: companyId,
    entity_type: "jarvis_action",
    entity_id: args?.machine_id || args?.delivery_id || args?.lead_id || args?.cut_plan_id || args?.entity_id || crypto.randomUUID(),
    event_type: `jarvis_${tool}`,
    description: `JARVIS executed: ${tool} → ${result?.message || "done"}`,
    actor_id: userId,
    actor_type: "jarvis",
    metadata: { tool, args, result },
    source: "system",
    dedupe_key: `jarvis:${tool}:${JSON.stringify(args)}:${new Date().toISOString().slice(0, 16)}`,
  }).catch(() => {});
}

// ═══ MAIN HANDLER ═══

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user } } = await anonClient.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Role-based admin check
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Access denied. Admin role required." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _user_id: user.id,
      _function_name: "admin-chat",
      _max_requests: 15,
      _window_seconds: 60,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Get company_id
    const { data: profileData } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const companyId = profileData?.company_id || "a0000000-0000-0000-0000-000000000001";

    // ═══ CONFIRM ACTION PATH ═══
    if (body.confirm_action) {
      const { tool, args } = body.confirm_action;

      // Re-validate admin server-side
      if (!adminRole) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!WRITE_TOOLS.has(tool)) {
        return new Response(JSON.stringify({ error: `Invalid tool: ${tool}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      try {
        const result = await executeWriteTool(supabase, user.id, companyId, tool, args);
        await logAction(supabase, user.id, companyId, tool, args, result);

        // Return result as SSE so frontend can display in chat
        const encoder = new TextEncoder();
        const resultMsg = `✅ **Action Executed**\n\n${result.message}`;
        const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: resultMsg } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(encoder.encode(sseData), {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      } catch (err: any) {
        const encoder = new TextEncoder();
        const errMsg = `❌ **Action Failed**\n\n${err.message || "Unknown error"}`;
        const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: errMsg } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(encoder.encode(sseData), {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }
    }

    // ═══ NORMAL CHAT PATH ═══
    const { messages, currentPage } = body;

    const systemContext = await buildFullVizzyContext(supabase, user.id);
    const pageContext = buildPageContext(currentPage || "/chat");

    const systemPrompt = `You are JARVIS — the CEO's personal and business AI assistant for REBAR SHOP OS.
You handle EVERYTHING: business operations, personal tasks, brainstorming, scheduling, reminders, writing.
You have FULL access to live business data. You can diagnose issues, explain what's happening, suggest fixes, and provide actionable commands.
═══ LANGUAGE ═══
You are MULTILINGUAL. You MUST respond in whatever language the CEO speaks to you.
If the CEO speaks Farsi (Persian), respond in Farsi with a natural Tehrani accent and conversational tone — like a native Tehran speaker.
Use informal/colloquial Farsi when appropriate (e.g. "چطوری" not "حالتان چطور است", "الان" not "اکنون", "میخوای" not "می‌خواهید", "بذار" not "بگذارید").
You can seamlessly switch between English and Farsi mid-conversation. If the CEO code-switches (mixes Farsi and English / Finglish), match their style.
Keep business terms, company names, proper nouns, and technical terms in English even when responding in Farsi.
When fully in Farsi mode, you may use Persian numerals (۱۲۳) but always keep currency in USD format.

${pageContext}

${systemContext}

═══ YOUR CAPABILITIES ═══
BUSINESS:
- Diagnose production bottlenecks, idle machines, stock shortages
- Analyze recent events and surface anomalies
- Explain stuck orders, idle machines, low stock
- Suggest SQL queries or data fixes the admin can run
- Cross-reference data: AR high + production slow → flag it
- Monitor email inbox and surface urgent items

PERSONAL:
- Brainstorming and strategy sessions
- Writing emails, messages, notes
- Personal reminders and to-do tracking
- Journaling thoughts and ideas
- Scheduling suggestions

MEMORY:
- You have persistent memory across sessions
- When you learn something important, save it using save_memory
- Reference past memories when relevant
- When the user says "remember this" or similar, use save_memory
- You can delete memories when asked to forget

PROACTIVE INTELLIGENCE:
- If you notice anomalies in the data, mention them even if not asked
- Connect dots across departments
- Flag risks before they become problems

═══ TOOL USAGE RULES ═══
- You have READ tools (list_machines, list_deliveries, list_orders, list_leads, get_stock_levels) that execute immediately and return structured JSON.
- You have WRITE tools (update_machine_status, update_delivery_status, update_lead_status, update_cut_plan_status, create_event) that require user confirmation before executing.
- ALWAYS use read tools to retrieve current entity IDs before performing write operations. Never assume or hallucinate entity IDs.
- For write operations: call the write tool directly. Do NOT ask for confirmation in text — the system handles confirmation automatically via UI.
- If an entity is ambiguous (e.g. "that machine"), ask for clarification BEFORE calling a tool.
- Prefer tools over explanation when the request is actionable.
- When reporting read results, summarize naturally — don't dump raw JSON.

═══ RULES ═══
- Be direct and concise — this is for a power user
- Use markdown formatting: headers, bullet lists, code blocks for SQL
- If you see issues in live data, proactively mention them
- When suggesting fixes, be specific (table names, column values, exact steps)
- If you don't have enough data, say what additional info you'd need
- NEVER make up figures — use only the data provided
- Track topics discussed across the session`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // First call with tools
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-preview",
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          tools: JARVIS_TOOLS,
          stream: true,
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const responseBody = aiResponse.body;
    if (!responseBody) {
      return new Response(JSON.stringify({ error: "No response body" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read full response to check for tool calls
    const reader = responseBody.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let toolCalls: any[] = [];
    let hasToolCalls = false;
    let streamChunks: string[] = [];

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") continue;

        streamChunks.push(line + "\n");

        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.content) fullText += delta.content;
          if (delta?.tool_calls) {
            hasToolCalls = true;
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCalls[idx]) {
                toolCalls[idx] = { id: tc.id || "", function: { name: tc.function?.name || "", arguments: "" } };
              }
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function?.name) toolCalls[idx].function.name = tc.function.name;
              if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
            }
          }
        } catch { /* partial */ }
      }
    }

    // If tool calls were made, execute them and make a follow-up
    if (hasToolCalls && toolCalls.length > 0) {
      const toolResults: any[] = [];
      const pendingActions: any[] = [];

      for (const tc of toolCalls) {
        let result = "";
        try {
          const args = JSON.parse(tc.function.arguments);
          const toolName = tc.function.name;

          if (toolName === "save_memory") {
            const { error } = await supabase.from("vizzy_memory").insert({
              user_id: user.id,
              category: args.category || "general",
              content: args.content,
              expires_at: args.expires_at || null,
              company_id: companyId,
            });
            result = error
              ? `Error saving: ${error.message}`
              : `✅ Saved to memory [${args.category}]: "${args.content}"`;
          } else if (toolName === "delete_memory") {
            const { error } = await supabase
              .from("vizzy_memory")
              .delete()
              .eq("id", args.memory_id)
              .eq("user_id", user.id);
            result = error ? `Error deleting: ${error.message}` : "✅ Memory deleted";
          } else if (WRITE_TOOLS.has(toolName)) {
            // Write tool → queue for confirmation, do NOT execute
            pendingActions.push({ tool: toolName, args, tool_call_id: tc.id });
            result = `⏳ Action "${toolName}" queued for user confirmation. The system will show a confirmation card to the user.`;
          } else {
            // Read tool → execute immediately
            result = await executeReadTool(supabase, toolName, args);
          }
        } catch (e) {
          result = `Tool error: ${e instanceof Error ? e.message : "Unknown"}`;
        }
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: result });
      }

      // Follow-up AI call with tool results
      const followUpMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
        {
          role: "assistant",
          content: fullText || null,
          tool_calls: toolCalls.map((tc: any) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        },
        ...toolResults,
      ];

      const followUpResp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-pro-preview",
            messages: followUpMessages,
            stream: true,
          }),
        }
      );

      if (!followUpResp.ok) {
        const encoder = new TextEncoder();
        const errorText = `\n\n_Tool operation completed. ${fullText}_`;
        const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: errorText } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(encoder.encode(sseData), {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // If there are pending write actions, we need to read the follow-up response
      // and append the pending_action event after it
      if (pendingActions.length > 0) {
        const followReader = followUpResp.body!.getReader();
        const followDecoder = new TextDecoder();
        let followChunks: string[] = [];
        let followBuf = "";

        while (true) {
          const { done, value } = await followReader.read();
          if (done) break;
          followBuf += followDecoder.decode(value, { stream: true });

          let nl2: number;
          while ((nl2 = followBuf.indexOf("\n")) !== -1) {
            let line2 = followBuf.slice(0, nl2);
            followBuf = followBuf.slice(nl2 + 1);
            if (line2.endsWith("\r")) line2 = line2.slice(0, -1);
            if (line2.startsWith("data: ") && line2.slice(6).trim() !== "[DONE]") {
              followChunks.push(line2 + "\n");
            }
          }
        }

        // Build response: AI follow-up chunks + pending_action events
        const encoder = new TextEncoder();
        let ssePayload = followChunks.join("") + "\n";

        for (const pa of pendingActions) {
          // Build a human-readable description
          const desc = buildActionDescription(pa.tool, pa.args);
          ssePayload += `event: pending_action\ndata: ${JSON.stringify({ tool: pa.tool, args: pa.args, description: desc })}\n\n`;
        }

        ssePayload += "data: [DONE]\n\n";
        return new Response(encoder.encode(ssePayload), {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      // No pending actions — just forward the follow-up response
      return new Response(followUpResp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls — reconstruct the SSE stream
    const encoder = new TextEncoder();
    const ssePayload = streamChunks.join("") + "data: [DONE]\n\n";
    return new Response(encoder.encode(ssePayload), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("admin-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildActionDescription(tool: string, args: any): string {
  switch (tool) {
    case "update_machine_status":
      return `Change machine ${args.machine_id?.slice(0, 8) || "?"} status to "${args.status}"`;
    case "update_delivery_status":
      return `Change delivery ${args.delivery_id?.slice(0, 8) || "?"} status to "${args.status}"`;
    case "update_lead_status":
      return `Change lead ${args.lead_id?.slice(0, 8) || "?"} status to "${args.status}"`;
    case "update_cut_plan_status":
      return `Change cut plan ${args.cut_plan_id?.slice(0, 8) || "?"} status to "${args.status}"`;
    case "create_event":
      return `Log event: ${args.event_type} — ${args.description || ""}`;
    default:
      return `Execute ${tool}`;
  }
}
