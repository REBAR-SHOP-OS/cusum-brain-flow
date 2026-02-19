import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callAI } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * ai-inline-suggest — lightweight general-purpose inline suggestion generator.
 *
 * Body:
 *   context_type: "task_description" | "task_comment" | "note" | "email"
 *   context:      Any relevant context (task title, existing text, conversation history, etc.)
 *   current_text: What the user has typed so far (may be empty)
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { context_type, context, current_text } = await req.json();

    if (!context_type) {
      return new Response(
        JSON.stringify({ error: "Missing context_type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompts: Record<string, string> = {
      task_description: `You are a helpful assistant writing task descriptions for a construction/rebar ERP system. 
Given a task title and any current text, write a clear, professional, actionable task description.
Be concise and specific. Include what needs to be done, any relevant details, and expected outcome.
Output ONLY the description text, no meta-commentary.`,

      task_comment: `You are a helpful assistant composing task comments for a construction/rebar ERP system.
Given the task context and any current text, suggest a clear, professional comment or update.
Be direct and actionable. If there's existing text, complete or improve it.
Output ONLY the comment text, no meta-commentary.`,

      note: `You are a helpful assistant writing notes for a business ERP system.
Given the context, write a concise, professional note.
Output ONLY the note text, no meta-commentary.`,

      email: `You are a helpful assistant drafting professional emails for a construction/rebar company.
Given the context, draft a professional, concise email or email reply.
Output ONLY the email body text, no meta-commentary.`,
    };

    const systemPrompt = systemPrompts[context_type] || systemPrompts.note;

    const userMessage = [
      context ? `Context:\n${context}` : null,
      current_text ? `Current text (continue or improve this):\n${current_text}` : "Please generate a suggestion from scratch.",
    ].filter(Boolean).join("\n\n");

    const result = await callAI({
      provider: "gpt",
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      maxTokens: 400,
      temperature: 0.7,
    });

    return new Response(
      JSON.stringify({ suggestion: result.content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("ai-inline-suggest error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
