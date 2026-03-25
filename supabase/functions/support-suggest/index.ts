import { handleRequest } from "../_shared/requestHandler.ts";
import { callAI, AIError } from "../_shared/aiRouter.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ userId, serviceClient, body }) => {
    const { conversation_id } = body;
    if (!conversation_id) throw new Error("Missing conversation_id");

    const { data: convo } = await serviceClient
      .from("support_conversations")
      .select("id, company_id, visitor_name, visitor_email")
      .eq("id", conversation_id)
      .single();
    if (!convo) throw new Error("Conversation not found");

    const { data: messages } = await serviceClient
      .from("support_messages")
      .select("sender_type, content, is_internal_note")
      .eq("conversation_id", conversation_id)
      .eq("is_internal_note", false)
      .neq("content_type", "system")
      .order("created_at", { ascending: true })
      .limit(30);

    const { data: articles } = await serviceClient
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

    const result = await callAI({
      provider: "gemini",
      model: "gemini-2.5-flash",
      agentName: "support",
      messages: chatMessages,
      fallback: { provider: "gpt", model: "gpt-4o-mini" },
    });

    return { suggestion: result.content };
  }, { functionName: "support-suggest", requireCompany: false, wrapResult: false })
);
