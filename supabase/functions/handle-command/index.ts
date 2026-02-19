import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth, corsHeaders } from "../_shared/auth.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

interface CommandRequest {
  input: string;
}

function parseIntent(input: string) {
  const inputLower = input.toLowerCase();
  let intent = "ai_ask"; // Default intent

  if (inputLower.startsWith("navigate to")) {
    intent = "navigate";
    const page = input.substring("navigate to".length).trim();
    return { intent: "navigate", params: { page } };
  }

  if (inputLower.startsWith("show") && inputLower.includes("machines")) {
    intent = "query_machines";
    const statusMatch = inputLower.match(/(idle|active|stopped)/);
    const status = statusMatch ? statusMatch[0] : "idle";
    return { intent: "query_machines", params: { status } };
  }

  if (inputLower.includes("stock levels") || inputLower.includes("inventory")) {
    intent = "query_inventory";
    return { intent: "query_inventory", params: {} };
  }

  if (inputLower.includes("work orders") || inputLower.includes("orders")) {
    intent = "query_orders";
    return { intent: "query_orders", params: {} };
  }

  if (inputLower.includes("next suggestion")) {
    intent = "suggest_next";
    return { intent: "suggest_next", params: {} };
  }

  return { intent, params: {} };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Auth guard — enforce authentication
    let userId: string;
    try {
      const auth = await requireAuth(req);
      userId = auth.userId;
    } catch (res) {
      if (res instanceof Response) return res;
      throw res;
    }

    const commandSchema = z.object({
      input: z.string().min(1, "Command cannot be empty").max(1000, "Command too long (max 1000 chars)"),
    });
    const parsed = commandSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { input } = parsed.data as CommandRequest;
    const { intent, params } = parseIntent(input);

    let result = "executed";
    let resultMessage = "";

    switch (intent) {
      case "navigate":
        resultMessage = `Navigate to ${params.page}`;
        break;

      case "query_machines": {
        const statusFilter = params.status || "idle";
        const { data: machines } = await supabase
          .from("machines")
          .select("name, status, type")
          .eq("status", statusFilter);
        
        if (machines && machines.length > 0) {
          resultMessage = `${machines.length} ${statusFilter} machine(s): ${machines.map((m: any) => m.name).join(", ")}`;
        } else {
          resultMessage = `No ${statusFilter} machines found.`;
        }
        break;
      }

      case "query_inventory": {
        const { data: lots } = await supabase
          .from("inventory_lots")
          .select("bar_code, qty_on_hand, location")
          .gt("qty_on_hand", 0)
          .limit(10);
        
        if (lots && lots.length > 0) {
          const summary = lots.map((l: any) => `${l.bar_code}: ${l.qty_on_hand} @ ${l.location || 'yard'}`).join("; ");
          resultMessage = `Stock levels: ${summary}`;
        } else {
          resultMessage = "No stock found in inventory.";
        }
        break;
      }

      case "query_orders": {
        const { count } = await supabase
          .from("work_orders")
          .select("*", { count: "exact", head: true })
          .in("status", ["pending", "in_progress"]);
        resultMessage = `${count ?? 0} active work orders.`;
        break;
      }

      case "suggest_next": {
        const { data: suggestions } = await supabase
          .from("suggestions")
          .select("title, description, suggestion_type")
          .eq("status", "pending")
          .order("priority", { ascending: false })
          .limit(3);

        if (suggestions && suggestions.length > 0) {
          resultMessage = suggestions.map((s: any, i: number) => `${i + 1}. ${s.title}`).join("\n");
        } else {
          resultMessage = "No pending suggestions. Everything looks good!";
        }
        break;
      }

      case "ai_ask": {
        try {
          const aiResult = await callAI({
            provider: "gpt",
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a shop floor assistant for a rebar fabrication company. Answer briefly and actionably. If you don't know, say so. Keep responses under 100 words."
              },
              { role: "user", content: input },
            ],
          });
          resultMessage = aiResult.content || "No response from AI.";
        } catch (aiErr) {
          if (aiErr instanceof AIError && aiErr.status === 429) {
            resultMessage = "Too many requests. Please try again in a moment.";
          } else {
            resultMessage = "AI is temporarily unavailable. Try a specific command instead.";
          }
          result = "failed";
        }
        break;
      }

      default:
        resultMessage = "I don't understand that command. Try 'show idle machines' or 'check stock levels'.";
        result = "suggested_alternative";
    }

    // Log the command
    if (userId) {
      await supabase.from("command_log").insert({
        user_id: userId,
        raw_input: input,
        parsed_intent: intent,
        parsed_params: params,
        result,
        result_message: resultMessage,
      });
    }

    return new Response(
      JSON.stringify({ intent, params, result, message: resultMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Command handler error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
