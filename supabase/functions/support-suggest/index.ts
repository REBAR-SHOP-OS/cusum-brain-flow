import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { callAI, AIError } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Auth + data fetching unchanged

    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { conversation_id } = await req.json();
    if (!conversation_id) {
      return new Response(JSON.stringify({ error: "Missing conversation_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch conversation + company
    const { data: convo } = await supabase
      .from("support_conversations")
      .select("id, company_id, visitor_name, visitor_email")
      .eq("id", conversation_id)
      .single();

    if (!convo) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch messages
    const { data: messages } = await supabase
      .from("support_messages")
      .select("sender_type, content, is_internal_note")
      .eq("conversation_id", conversation_id)
      .eq("is_internal_note", false)
      .neq("content_type", "system")
      .order("created_at", { ascending: true })
      .limit(30);

    // Fetch KB articles
    const { data: articles } = await supabase
      .from("kb_articles")
      .select("title, content, excerpt")
      .eq("company_id", convo.company_id)
      .eq("is_published", true)
      .limit(20);

    const kbContext = (articles || [])
      .map((a: any) => `## ${a.title}\n${a.excerpt || ""}\n${a.content}`)
      .join("\n\n---\n\n");

    const chatMessages = [
      {
        role: "system",
        content: `You are a support agent assistant. Draft a helpful, professional reply to the visitor based on the conversation and knowledge base articles below. Be concise, friendly, and actionable. If you're unsure, suggest the agent verify before sending.

## Visitor Info
Name: ${convo.visitor_name || "Unknown"}
Email: ${convo.visitor_email || "Not provided"}

## Knowledge Base Articles:
${kbContext || "No articles available."}`,
      },
      ...(messages || []).map((m: any) => ({
        role: m.sender_type === "visitor" ? "user" : "assistant",
        content: m.content,
      })),
      {
        role: "user",
        content: "Draft a reply to the visitor's latest message. Only output the reply text, no meta-commentary.",
      },
    ];

    // GPT-4o-mini: customer-facing draft suggestion
    const result = await callAI({
      provider: "gpt",
      model: "gpt-4o-mini",
      messages: chatMessages,
    });

    const suggestion = result.content;

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("support-suggest error:", err);
    const status = err instanceof AIError ? err.status : 500;
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
