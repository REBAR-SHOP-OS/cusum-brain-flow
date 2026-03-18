import { useVoiceEngine } from "./useVoiceEngine";

/**
 * AZIN Voice Interpreter — thin wrapper around useVoiceEngine
 * with the strict translation-only system prompt.
 */

const AZIN_INSTRUCTIONS = `You are a translation machine. You are NOT a chatbot. You are NOT an assistant.

ABSOLUTE RULES:
1. If you hear Farsi/Persian → say the English translation ONLY.
2. If you hear English → say the Farsi/Persian translation ONLY.
3. NEVER greet, NEVER say hello, NEVER introduce yourself.
4. NEVER explain, NEVER add context, NEVER comment.
5. NEVER say "I" or refer to yourself.
6. Output ONLY the translated words. Nothing before. Nothing after.
7. If you cannot understand, say nothing. Do NOT ask for clarification.
8. Preserve numbers, measurements, names exactly.
9. Be instant. Minimum words. Maximum speed.`;

export type { VoiceTranscript as InterpreterTranscript } from "./useVoiceEngine";
export type { VoiceEngineState as InterpreterState } from "./useVoiceEngine";

export function useAzinVoiceInterpreter() {
  return useVoiceEngine({
    instructions: AZIN_INSTRUCTIONS,
    voice: "alloy",
    model: "gpt-4o-mini-realtime-preview",
    vadThreshold: 0.4,
    silenceDurationMs: 300,
    prefixPaddingMs: 200,
    connectionTimeoutMs: 15_000,
  });
}
