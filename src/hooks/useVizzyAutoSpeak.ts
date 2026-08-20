import { useRef, useCallback } from "react";

const TTS_URL = import.meta.env.VITE_TTS_API_URL;

const SKIP_PREFIXES = ["⚠️", "❌", "🚫", "⏳"];

export function useVizzyAutoSpeak() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speakText = useCallback(async (text: string) => {
    if (!TTS_URL) return;
    if (!text?.trim() || text === "[UNCLEAR]") return;
    if (SKIP_PREFIXES.some((p) => text.startsWith(p))) return;

    try {
      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const response = await fetch(`${TTS_URL}/v1/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          max_steps: 250,
          trim_leading: true,
          trim_trailing: true,
          silence_threshold_db: -42,
          trailing_silence_stop_ms: 700,
        }),
      });

      if (!response.ok) {
        console.warn("[autoSpeak] TTS request failed:", response.status);
        return;
      }

      const data = await response.json();
      if (!data?.ok || !data?.audio_base64) return;

      const byteChars = atob(data.audio_base64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (err) {
      console.warn("[autoSpeak] error:", err);
    }
  }, []);

  return { speakText, audioRef };
}
