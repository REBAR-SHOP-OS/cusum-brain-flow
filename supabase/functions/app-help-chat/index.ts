import { handleRequest } from "../_shared/requestHandler.ts";
import { buildPageContext } from "../_shared/pageMap.ts";
import { callAIStream, AIError } from "../_shared/aiRouter.ts";
import { corsHeaders } from "../_shared/auth.ts";
import { VIZZY_HELP_ADDENDUM } from "../_shared/vizzyIdentity.ts";

Deno.serve((req) =>
  handleRequest(req, async ({ body }) => {
    const { messages, currentPage } = body;
    const pageContext = buildPageContext(currentPage || "/home");

    const response = await callAIStream({
      provider: "gpt",
      model: "gpt-4o-mini",
      agentName: "system",
      messages: [
        { role: "system", content: VIZZY_HELP_ADDENDUM + "\n\n" + pageContext },
        ...messages,
      ],
    });

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  }, { functionName: "app-help-chat", authMode: "required", requireCompany: false, rawResponse: true })
);
