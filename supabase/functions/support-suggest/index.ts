import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

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

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: chatMessages,
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const suggestion = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("support-suggest error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
