import { useVoiceEngine } from "./useVoiceEngine";

/**
 * AZIN Voice Interpreter — thin wrapper around useVoiceEngine
 * with the strict translation-only system prompt.
 */

const AZIN_INSTRUCTIONS = `You are a real-time Farsi↔English translation relay. You have ONE job:

1. If you hear Farsi/Persian → speak ONLY the English translation.
2. If you hear English → speak ONLY the Farsi/Persian translation.
3. If you hear silence, noise, or unclear audio → stay completely silent. Produce NO sound.
4. NEVER speak on your own. NEVER greet, comment, explain, or acknowledge. NEVER refer to yourself.
5. Translate complete thoughts idiomatically and naturally — preserve tone, intent, and meaning. Keep numbers, names, and measurements exactly as spoken.

SILENCE IS YOUR DEFAULT STATE. You only break silence to output a faithful translation.`;

export function useAzinVoiceInterpreter() {
  return useVoiceEngine({
    instructions: AZIN_INSTRUCTIONS,
    voice: "alloy",
    model: "gpt-4o-realtime-preview",
    vadThreshold: 0.4,
    silenceDurationMs: 600,
    prefixPaddingMs: 300,
    connectionTimeoutMs: 15_000,
  });
}
