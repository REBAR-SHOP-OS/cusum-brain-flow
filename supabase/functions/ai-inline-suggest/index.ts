import { handleRequest } from "../_shared/requestHandler.ts";
import { callAI } from "../_shared/aiRouter.ts";

/**
 * ai-inline-suggest — lightweight general-purpose inline suggestion generator.
 */
Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { context_type, context, current_text } = body;
    if (!context_type) throw new Error("Missing context_type");

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
      provider: "gemini",
      model: "gemini-2.5-flash-lite",
      agentName: "system",
      fallback: { provider: "gemini", model: "gemini-2.5-flash" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      maxTokens: 400,
      temperature: 0.7,
    });

    return { suggestion: result.content };
  }, { functionName: "ai-inline-suggest", requireCompany: false, wrapResult: false })
);
