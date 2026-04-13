import { useState, useCallback, useRef } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { toast } from "sonner";
import { detectRtl, stripDirectionalMarkers } from "@/utils/textDirection";

export interface RelayTranscript {
  id: string;
  original: string;
  translation: string;
  sourceLang: "en" | "fa";
  isTranslating: boolean;
  isSpeaking: boolean;
}

export type RelayState = "idle" | "connecting" | "connected" | "error";

const VOICE_ENGLISH = "FGY2WhTYpPnrIDTdsKH5";
const VOICE_FARSI = "EXAVITQu4vr4xnSDxMaL";

const NOISE_BLOCKLIST = /^(yeah|yep|hmm+|uh+|ah+|oh+|ok+|okay|mhm+|huh|ha+|hey|hi|bye|no|yes|so|well|like|um+|right|sure)\b/i;
const HAS_FARSI_OR_LATIN = /[\u0600-\u06FF\u0750-\u077Fa-zA-Z]/;
const REPEATED_CHARS = /(.)\1{4,}/;
const SCRIBE_ANNOTATION = /^\s*\(/;
const PUNCTUATION_ONLY = /^[\s.,!?…\-–—:;'"]+$/;
const FOREIGN_SCRIPT = /[\u0900-\u097F\u0980-\u09FF\u0A00-\u0D7F\u0E00-\u0E7F\u1000-\u109F\u3000-\u9FFF\uAC00-\uD7AF]/;

export function useNilaVoiceRelay() {
  const [state, setState] = useState<RelayState>("idle");
  const [transcripts, setTranscripts] = useState<RelayTranscript[]>([]);
  const [partialText, setPartialText] = useState("");
  const contextRef = useRef<string[]>([]);
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const isPlayingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const playNextAudio = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    const audio = audioQueueRef.current.shift()!;
    audio.onended = () => {
      isPlayingRef.current = false;
      playNextAudio();
    };
    audio.onerror = (e) => {
      console.error("[relay] audio error:", e);
      isPlayingRef.current = false;
      playNextAudio();
    };
    audio.play().catch((err) => {
      console.warn("[relay] audio.play() blocked:", err?.message);
      isPlayingRef.current = false;
      playNextAudio();
    });
  }, []);

  const speakTranslation = useCallback(async (text: string, lang: "en" | "fa", entryId: string) => {
    const signal = abortRef.current?.signal;
    if (signal?.aborted) return;

    try {
      const voiceId = lang === "fa" ? VOICE_FARSI : VOICE_ENGLISH;
      console.log("[relay] TTS request:", { text: text.slice(0, 40), lang, voiceId });
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, voiceId, speed: 1.1 }),
          signal,
        }
      );

      if (signal?.aborted) return;
      if (!response.ok) {
        console.error("[relay] TTS response not OK:", response.status);
        return;
      }

      const audioBlob = await response.blob();
      if (signal?.aborted) return;

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

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
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("TTS error:", err);
    }
  }, [playNextAudio]);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      if (abortRef.current?.signal.aborted) return;
      if (SCRIBE_ANNOTATION.test(data.text) || PUNCTUATION_ONLY.test(data.text)) return;
      if (FOREIGN_SCRIPT.test(data.text)) return;
      setPartialText(data.text);
    },
    onCommittedTranscript: (data) => {
      const signal = abortRef.current?.signal;
      if (signal?.aborted) return;

      const trimmed = stripDirectionalMarkers(data.text).trim();
      if (!trimmed) return;
      if (SCRIBE_ANNOTATION.test(trimmed)) return;
      if (PUNCTUATION_ONLY.test(trimmed)) return;

      const letterCount = (trimmed.match(/[\p{L}]/gu) || []).length;
      if (letterCount < 1) return;
      if (letterCount / trimmed.length < 0.5) return;
      if (!HAS_FARSI_OR_LATIN.test(trimmed)) return;
      if (FOREIGN_SCRIPT.test(trimmed)) return;
      if (REPEATED_CHARS.test(trimmed)) return;
      const wordCount = trimmed.split(/\s+/).length;
      if (wordCount < 3 && trimmed.length < 8) return;
      if (NOISE_BLOCKLIST.test(trimmed.toLowerCase()) && wordCount <= 2) return;
      console.log("[relay] committed transcript accepted:", trimmed, `(${wordCount} words, ${trimmed.length} chars)`);

      const isRtl = detectRtl(trimmed);
      const detectedLang: "en" | "fa" = isRtl ? "fa" : "en";
      const targetLang = detectedLang === "fa" ? "en" : "fa";
      const entryId = crypto.randomUUID();

      setTranscripts((prev) => [
        ...prev,
        { id: entryId, original: trimmed, translation: "", sourceLang: detectedLang, isTranslating: true, isSpeaking: false },
      ]);
      setPartialText("");

      const contextWindow = contextRef.current.slice(-3).join(" | ");

      invokeEdgeFunction<{ translations: Record<string, string> }>(
        "translate-message",
        { text: trimmed, sourceLang: detectedLang, targetLangs: [targetLang], context: contextWindow || undefined },
      )
        .then((res) => {
          if (signal?.aborted) return;

          const translation = res?.translations?.[targetLang]?.trim();
          if (!translation) {
            console.warn("[relay] empty translation returned for:", trimmed);
            setTranscripts((prev) =>
              prev.map((t) => t.id === entryId ? { ...t, translation: targetLang === "fa" ? "(ترجمه موجود نیست)" : "(translation unavailable)", isTranslating: false } : t)
            );
            return;
          }

          console.log("[relay] translation received:", translation.slice(0, 40));
          contextRef.current.push(translation);
          if (contextRef.current.length > 10) contextRef.current = contextRef.current.slice(-5);

          setTranscripts((prev) =>
            prev.map((t) => t.id === entryId ? { ...t, translation, isTranslating: false } : t)
          );

          speakTranslation(translation, targetLang as "en" | "fa", entryId);
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          console.error("[relay] translation failed:", err);
          setTranscripts((prev) => prev.filter((t) => t.id !== entryId));
        });
    },
  });

  const startSession = useCallback(async () => {
    setState("connecting");
    try {
      abortRef.current = new AbortController();

      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) throw new Error(error?.message || "Failed to get scribe token");

      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
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
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    scribe.disconnect();

    audioQueueRef.current.forEach((a) => {
      a.onended = null;
      a.onerror = null;
      a.pause();
      a.src = "";
    });
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    setState("idle");
    setPartialText("");
    setTranscripts([]);
    contextRef.current = [];
  }, [scribe]);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    setPartialText("");
    contextRef.current = [];
  }, []);

  return { state, transcripts, partialText, startSession, endSession, clearTranscripts };
}
