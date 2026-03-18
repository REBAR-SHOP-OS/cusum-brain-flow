import { useCallback, useRef, useState } from "react";
import { useVoiceEngine } from "./useVoiceEngine";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";

/**
 * Vizzy Voice Engine — wraps useVoiceEngine with executive intelligence prompt
 * and live ERP data injection from vizzy-daily-brief edge function.
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
You have LIVE access to the full ERP data below. Use it to answer with real numbers about:
orders, leads, customers, invoices, production status, machine utilization, financial health,
team presence, deliveries, and recent activity events.

═══ RULES ═══
- ALWAYS reference the live data below when answering business questions. The data IS below — search through it.
- NEVER say you "cannot access" or "don't have access to" data. ALL business data is injected below. Use it.
- If a very specific detail (like a single transaction ID) isn't in the snapshot, say: "That specific detail isn't in today's snapshot — ask me in the text chat for a deeper lookup."
- NEVER give long monologues. This is voice — keep it tight.
- If asked to do something you can't (like execute a write operation), say what you WOULD do and suggest they ask in the chat.
- Be proactive: if you notice something concerning in what they mention, flag it.
- When listing customers, employees, invoices — pull directly from the CUSTOMER DIRECTORY and TRANSACTION SUMMARY sections below.`;

export type { VoiceTranscript as VizzyVoiceTranscript } from "./useVoiceEngine";
export type { VoiceEngineState as VizzyVoiceState } from "./useVoiceEngine";

export function useVizzyVoiceEngine() {
  const [erpContext, setErpContext] = useState<string | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const contextFetched = useRef(false);

  const fullInstructions = erpContext
    ? `${VIZZY_INSTRUCTIONS}\n\n═══ LIVE BUSINESS DATA (as of ${new Date().toLocaleString()}) ═══\n${erpContext}`
    : VIZZY_INSTRUCTIONS;

  const engine = useVoiceEngine({
    instructions: fullInstructions,
    voice: "shimmer",
    model: "gpt-4o-mini-realtime-preview",
    vadThreshold: 0.5,
    silenceDurationMs: 500,
    prefixPaddingMs: 300,
    connectionTimeoutMs: 20_000,
  });

  const originalStartSession = engine.startSession;

  const startSession = useCallback(async () => {
    if (!contextFetched.current) {
      contextFetched.current = true;
      setContextLoading(true);
      try {
        const data = await invokeEdgeFunction<{ briefing: string }>(
          "vizzy-daily-brief",
          {},
          { timeoutMs: 25000 }
        );
        if (data?.briefing) {
          setErpContext(data.briefing);
        }
      } catch (err) {
        console.warn("Failed to fetch ERP context for Vizzy voice:", err);
      } finally {
        setContextLoading(false);
      }
    }
    // Let state propagate before connecting
    await new Promise((r) => setTimeout(r, 150));
    originalStartSession();
  }, [originalStartSession]);

  return {
    ...engine,
    startSession,
    contextLoading,
  };
}
