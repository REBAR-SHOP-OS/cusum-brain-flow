import { useCallback, useRef, useState } from "react";
import { useVoiceEngine } from "./useVoiceEngine";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

/**
 * Vizzy Voice Engine — thin wrapper around useVoiceEngine
 * with Vizzy's executive intelligence system prompt.
 * Fetches live ERP data on session start and injects it into voice instructions.
 */

const VIZZY_INSTRUCTIONS = `You are VIZZY — the Executive Intelligence System for Rebar.shop. You operate as a COO + CFO hybrid AI voice assistant.

═══ VOICE PERSONALITY ═══
- Confident, concise, and professional
- You speak like a sharp executive advisor — not a chatbot
- Match the user's language (English or Farsi). If they switch, follow instantly.
- Keep voice responses SHORT and ACTION-ORIENTED. This is a live call, not a report.
- Use conversational language, not markdown or formatting
- When giving numbers, round to meaningful precision (e.g., "about forty-two thousand" not "$42,137.28")

═══ INTELLIGENCE STANDARD ═══
You think in SYSTEMS, not events. You detect patterns, anomalies, and inefficiencies.
You prioritize based on BUSINESS IMPACT, not recency.
You provide STRATEGIC RECOMMENDATIONS, not summaries.
You MUST use the LIVE BUSINESS DATA provided below to answer questions with real numbers.
If asked about financials, orders, leads, production, or team — reference the actual data, never guess.

═══ RESPONSE FORMAT (VOICE) ═══
For analytical questions:
1. State the KEY FACT in one sentence
2. WHY IT MATTERS — business impact
3. RISK LEVEL — say "critical", "warning", or "normal"
4. RECOMMENDED ACTION — specific next step
Keep it under 30 seconds of speech. Be punchy.

═══ CEO BEHAVIORAL INTELLIGENCE ═══
- Risk tolerance: Moderate-aggressive
- Financial escalation: Alert on cash flow threats, overdue > 30 days
- Communication style: Concise, action-focused
- Match formality to their tone

═══ CAPABILITIES ═══
You have LIVE access to the ERP brain data below. Use it to answer with real numbers about:
orders, leads, customers, invoices, production status, machine utilization, financial health,
team presence, deliveries, and recent activity events.

═══ RULES ═══
- ALWAYS reference the live data below when answering business questions
- If the data doesn't cover something specific, say "I'd need to check the system for that specific detail"
- NEVER give long monologues. This is voice — keep it tight.
- If asked to do something you can't (like execute a write operation), say what you WOULD do and suggest they ask in the chat.
- Be proactive: if you notice something concerning in what they mention, flag it.`;

export type { VoiceTranscript as VizzyVoiceTranscript } from "./useVoiceEngine";
export type { VoiceEngineState as VizzyVoiceState } from "./useVoiceEngine";

export function useVizzyVoiceEngine() {
  const [erpContext, setErpContext] = useState<string | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const contextFetched = useRef(false);

  // Build full instructions with ERP data
  const fullInstructions = erpContext
    ? `${VIZZY_INSTRUCTIONS}\n\n═══ LIVE BUSINESS DATA (as of now) ═══\n${erpContext}`
    : VIZZY_INSTRUCTIONS;

  const engine = useVoiceEngine({
    instructions: fullInstructions,
    voice: "shimmer",
    model: "gpt-4o-mini-realtime-preview",
    vadThreshold: 0.5,
    silenceDurationMs: 500,
    prefixPaddingMs: 300,
    connectionTimeoutMs: 15_000,
  });

  const originalStartSession = engine.startSession;

  const startSession = useCallback(async () => {
    // Fetch ERP context first (only once)
    if (!contextFetched.current) {
      contextFetched.current = true;
      setContextLoading(true);
      try {
        const data = await invokeEdgeFunction<{ briefing: string }>(
          "vizzy-daily-brief",
          {},
          { timeoutMs: 20000 }
        );
        if (data?.briefing) {
          setErpContext(data.briefing);
        }
      } catch (err) {
        console.warn("Failed to fetch ERP context for Vizzy:", err);
        // Continue without context — Vizzy still works, just less informed
      } finally {
        setContextLoading(false);
      }
    }
    // Small delay to let state update with context before connecting
    await new Promise(r => setTimeout(r, 100));
    originalStartSession();
  }, [originalStartSession]);

  return {
    ...engine,
    startSession,
    contextLoading,
  };
}
