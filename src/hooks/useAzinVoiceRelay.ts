import { useState, useCallback, useRef } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { toast } from "sonner";
import { detectRtl } from "@/utils/textDirection";

/**
 * AZIN Voice Relay — deterministic 3-step pipeline:
 * 1. ElevenLabs Scribe STT (accurate, no hallucination)
 * 2. Gemini translation via translate-message edge function
 * 3. ElevenLabs TTS for spoken translation output
 *
 * Replaces OpenAI Realtime to eliminate self-talk and Farsi errors.
 */

export interface RelayTranscript {
  id: string;
  original: string;
  translation: string;
  sourceLang: "en" | "fa";
  isTranslating: boolean;
  isSpeaking: boolean;
}

export type RelayState = "idle" | "connecting" | "connected" | "error";

// TTS voices
const VOICE_ENGLISH = "EXAVITQu4vr4xnSDxMaL"; // Sarah (female, multilingual v2)
const VOICE_FARSI = "EXAVITQu4vr4xnSDxMaL"; // Sarah (female, multilingual v2)

// Noise filter helpers
const NOISE_BLOCKLIST = /^(yeah|yep|hmm+|uh+|ah+|oh+|ok+|okay|mhm+|huh|ha+|hey|hi|bye|no|yes|so|well|like|um+|right|sure)\b/i;
const HAS_FARSI_OR_LATIN = /[\u0600-\u06FF\u0750-\u077Fa-zA-Z]/;
const REPEATED_CHARS = /(.)\1{4,}/;

export function useAzinVoiceRelay() {
  const [state, setState] = useState<RelayState>("idle");
  const [transcripts, setTranscripts] = useState<RelayTranscript[]>([]);
  const [partialText, setPartialText] = useState("");
  const contextRef = useRef<string[]>([]);
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const isPlayingRef = useRef(false);

  // Play next audio in queue (non-blocking)
  const playNextAudio = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    const audio = audioQueueRef.current.shift()!;
    audio.onended = () => {
      isPlayingRef.current = false;
      playNextAudio();
    };
    audio.onerror = () => {
      isPlayingRef.current = false;
      playNextAudio();
    };
    audio.play().catch(() => {
      isPlayingRef.current = false;
      playNextAudio();
    });
  }, []);

  // Speak translation via TTS
  const speakTranslation = useCallback(async (text: string, lang: "en" | "fa", entryId: string) => {
    try {
      const voiceId = lang === "fa" ? VOICE_FARSI : VOICE_ENGLISH;
      const speed = 1.1;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, voiceId }),
        }
      );

      if (!response.ok) return;

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // Mark speaking state
      setTranscripts((prev) =>
        prev.map((t) => (t.id === entryId ? { ...t, isSpeaking: true } : t))
      );

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setTranscripts((prev) =>
          prev.map((t) => (t.id === entryId ? { ...t, isSpeaking: false } : t))
        );
      };

      audioQueueRef.current.push(audio);
      playNextAudio();
    } catch (err) {
      console.error("TTS error:", err);
    }
  }, [playNextAudio]);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      setPartialText(data.text);
    },
    onCommittedTranscript: (data) => {
      const trimmed = data.text.trim();
      if (!trimmed) return;

      // Basic noise filter
      const wordCount = trimmed.split(/\s+/).length;
      if (wordCount < 2 || trimmed.length < 5) return;
      const letterCount = (trimmed.match(/[\p{L}]/gu) || []).length;
      if (letterCount / trimmed.length < 0.5) return;

      // Detect source language
      const isRtl = detectRtl(trimmed);
      const detectedLang: "en" | "fa" = isRtl ? "fa" : "en";
      const targetLang = detectedLang === "fa" ? "en" : "fa";

      const entryId = crypto.randomUUID();

      setTranscripts((prev) => [
        ...prev,
        {
          id: entryId,
          original: trimmed,
          translation: "",
          sourceLang: detectedLang,
          isTranslating: true,
          isSpeaking: false,
        },
      ]);
      setPartialText("");

      // Translate via Gemini
      const contextWindow = contextRef.current.slice(-3).join(" | ");

      invokeEdgeFunction<{ translations: Record<string, string> }>(
        "translate-message",
        {
          text: trimmed,
          sourceLang: detectedLang,
          targetLangs: [targetLang],
          context: contextWindow || undefined,
        }
      )
        .then((res) => {
          const translation = res?.translations?.[targetLang]?.trim();

          if (!translation) {
            // Noise — silently remove
            setTranscripts((prev) => prev.filter((t) => t.id !== entryId));
            return;
          }

          // Update context buffer
          contextRef.current.push(translation);
          if (contextRef.current.length > 10) {
            contextRef.current = contextRef.current.slice(-5);
          }

          setTranscripts((prev) =>
            prev.map((t) =>
              t.id === entryId
                ? { ...t, translation, isTranslating: false }
                : t
            )
          );

          // Speak the translation
          speakTranslation(translation, targetLang as "en" | "fa", entryId);
        })
        .catch(() => {
          setTranscripts((prev) => prev.filter((t) => t.id !== entryId));
        });
    },
  });

  const startSession = useCallback(async () => {
    setState("connecting");
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) {
        throw new Error(error?.message || "Failed to get scribe token");
      }

      await scribe.connect({
        token: data.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      contextRef.current = [];
      setState("connected");
    } catch (err: any) {
      console.error("Voice relay connect error:", err);
      toast.error(err.message || "Failed to start interpreter");
      setState("error");
    }
  }, [scribe]);

  const endSession = useCallback(() => {
    scribe.disconnect();
    // Stop all queued audio
    audioQueueRef.current.forEach((a) => { a.pause(); a.src = ""; });
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setState("idle");
    setPartialText("");
  }, [scribe]);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setPartialText("");
    contextRef.current = [];
  }, []);

  return {
    state,
    transcripts,
    partialText,
    startSession,
    endSession,
    clearTranscripts,
  };
}
