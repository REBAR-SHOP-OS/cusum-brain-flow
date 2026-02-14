import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildFullVizzyContext } from "../_shared/vizzyFullContext.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAIL = "sattar@rebar.shop";

const MEMORY_TOOLS = [
  {
    type: "function",
    function: {
      name: "save_memory",
      description:
        "Save something to persistent memory so you can recall it in future sessions. Use when the user says 'remember this', or when you identify important information worth storing.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["business", "personal", "reminder", "insight"],
            description: "Category of the memory",
          },
          content: {
            type: "string",
            description: "The content to remember",
          },
          expires_at: {
            type: "string",
            description:
              "Optional ISO date when this memory should expire (for reminders)",
          },
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
];

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
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const {
      data: { user },
    } = await anonClient.auth.getUser(token);

    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
      return new Response(
        JSON.stringify({ error: "Access denied. Super admin only." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Rate limit
    const { data: allowed } = await supabase.rpc("check_rate_limit", {
      _user_id: user.id,
      _function_name: "admin-chat",
      _max_requests: 15,
      _window_seconds: 60,
    });
    if (allowed === false) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { messages } = await req.json();

    // Get company_id for memory ops
    const { data: profileData } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const companyId = profileData?.company_id || "a0000000-0000-0000-0000-000000000001";

    // Build full context
    const systemContext = await buildFullVizzyContext(supabase, user.id);

    const systemPrompt = `You are JARVIS — the CEO's personal and business AI assistant for REBAR SHOP OS.
You handle EVERYTHING: business operations, personal tasks, brainstorming, scheduling, reminders, writing.
You have FULL access to live business data. You can diagnose issues, explain what's happening, suggest fixes, and provide actionable commands.
You are MULTILINGUAL. Respond in whatever language the CEO speaks. If they speak Farsi, respond naturally in colloquial Farsi.

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
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          tools: MEMORY_TOOLS,
          stream: true,
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Try again in a moment." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted." }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // We need to intercept the stream to handle tool calls
    // For streaming with tools, we'll collect tool calls and execute them,
    // then make a follow-up call if needed
    const responseBody = aiResponse.body;
    if (!responseBody) {
      return new Response(JSON.stringify({ error: "No response body" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
                toolCalls[idx] = {
                  id: tc.id || "",
                  function: { name: tc.function?.name || "", arguments: "" },
                };
              }
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function?.name)
                toolCalls[idx].function.name = tc.function.name;
              if (tc.function?.arguments)
                toolCalls[idx].function.arguments += tc.function.arguments;
            }
          }
        } catch {
          /* partial */
        }
      }
    }

    // If tool calls were made, execute them and make a follow-up
    if (hasToolCalls && toolCalls.length > 0) {
      const toolResults: any[] = [];

      for (const tc of toolCalls) {
        let result = "";
        try {
          const args = JSON.parse(tc.function.arguments);
          if (tc.function.name === "save_memory") {
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
          } else if (tc.function.name === "delete_memory") {
            const { error } = await supabase
              .from("vizzy_memory")
              .delete()
              .eq("id", args.memory_id)
              .eq("user_id", user.id);
            result = error
              ? `Error deleting: ${error.message}`
              : "✅ Memory deleted";
          } else {
            result = "Unknown tool";
          }
        } catch (e) {
          result = `Tool error: ${e instanceof Error ? e.message : "Unknown"}`;
        }
        toolResults.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }

      // Follow-up call with tool results (non-streaming for simplicity, then stream the response)
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
        // Return what we have
        const errorText = `\n\n_Memory operation completed. ${fullText}_`;
        const encoder = new TextEncoder();
        const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: errorText } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(encoder.encode(sseData), {
          headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        });
      }

      return new Response(followUpResp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls — reconstruct the SSE stream from collected chunks
    const encoder = new TextEncoder();
    const ssePayload = streamChunks.join("") + "data: [DONE]\n\n";
    return new Response(encoder.encode(ssePayload), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("admin-chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
