import { useState, useCallback, useRef, useEffect } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { toast } from "sonner";

export type SourceLang = "auto" | "en" | "fa";

interface CommittedTranscript {
  id: string;
  text: string;
  timestamp: number;
  translatedText?: string;
  originalCleanText?: string;
  englishText?: string;
  farsiText?: string;
  isTranslating?: boolean;
  sourceLang: SourceLang;
}

// Concurrency limiter for translation calls
const MAX_CONCURRENT = 3;

export function useRealtimeTranscribe() {
  const [committedTranscripts, setCommittedTranscripts] = useState<CommittedTranscript[]>([]);
  const [partialText, setPartialText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sourceLang, setSourceLang] = useState<SourceLang>("auto");
  const startTimeRef = useRef<number>(0);
  const contextRef = useRef<string[]>([]);
  const sourceLangRef = useRef<SourceLang>("auto");

  // Auto-reconnect state
  const shouldBeConnectedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_RECONNECT = 3;

  // Concurrency tracking
  const activeTranslationsRef = useRef(0);
  const translationQueueRef = useRef<Array<() => void>>([]);

  const processTranslationQueue = useCallback(() => {
    while (
      activeTranslationsRef.current < MAX_CONCURRENT &&
      translationQueueRef.current.length > 0
    ) {
      const next = translationQueueRef.current.shift()!;
      activeTranslationsRef.current++;
      next();
    }
  }, []);

  const enqueueTranslation = useCallback(
    (fn: () => Promise<void>) => {
      const wrapped = () => {
        fn().finally(() => {
          activeTranslationsRef.current--;
          processTranslationQueue();
        });
      };
      if (activeTranslationsRef.current < MAX_CONCURRENT) {
        activeTranslationsRef.current++;
        wrapped();
      } else {
        translationQueueRef.current.push(wrapped);
      }
    },
    [processTranslationQueue]
  );

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      setPartialText(data.text);
    },
    onCommittedTranscript: (data) => {
      const trimmed = data.text.trim();
      if (!trimmed) return;
      const wordCount = trimmed.split(/\s+/).length;
      if (wordCount < 2 || trimmed.length < 5) return;
      const letterCount = (trimmed.match(/[\p{L}]/gu) || []).length;
      if (letterCount / trimmed.length < 0.5) return;
      const words = trimmed.split(/\s+/);
      const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
      if (uniqueWords.size <= 2 && words.length >= 3) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const entryId = crypto.randomUUID();
      const currentSourceLang = sourceLangRef.current;
      const targetLangs = currentSourceLang === "en" ? ["fa"] : currentSourceLang === "fa" ? ["en"] : ["en", "fa"];
      setCommittedTranscripts((prev) => [
        ...prev,
        { id: entryId, text: data.text, timestamp: elapsed, isTranslating: true, sourceLang: currentSourceLang },
      ]);
      setPartialText("");

      const contextWindow = contextRef.current.slice(-1).join(" | ");

      enqueueTranslation(async () => {
        try {
          const res = await invokeEdgeFunction<{ translations: Record<string, string> }>(
            "translate-message",
            {
              text: data.text,
              sourceLang: currentSourceLang,
              targetLangs,
              context: contextWindow || undefined,
            },
            { timeoutMs: 10000 }
          );

          const translatedEn = res?.translations?.en;
          const translatedFa = res?.translations?.fa;

          // Build per-language fields
          let englishText: string | undefined;
          let farsiText: string | undefined;

          if (currentSourceLang === "en") {
            englishText = data.text.trim();
            farsiText = translatedFa || undefined;
          } else if (currentSourceLang === "fa") {
            englishText = translatedEn || undefined;
            farsiText = data.text.trim();
          } else {
            englishText = translatedEn || data.text.trim();
            farsiText = translatedFa || data.text.trim();
          }

          // Language-aware fallback: NEVER put wrong language in wrong field
          const primaryTranslation = currentSourceLang === "fa" ? translatedEn : (currentSourceLang === "en" ? translatedFa : (translatedEn || translatedFa));
          if (!primaryTranslation || !primaryTranslation.trim()) {
            // Only populate the source language field with raw text
            setCommittedTranscripts((prev) =>
              prev.map((t) =>
                t.id === entryId
                  ? {
                      ...t,
                      englishText: currentSourceLang === "en" ? data.text.trim() : undefined,
                      farsiText: currentSourceLang === "fa" ? data.text.trim() : undefined,
                      translatedText: undefined,
                      isTranslating: false,
                    }
                  : t
              )
            );
            return;
          }

          // Push successful translation to context buffer
          contextRef.current.push(translatedEn || translatedFa || data.text);
          if (contextRef.current.length > 10) {
            contextRef.current = contextRef.current.slice(-5);
          }

          setCommittedTranscripts((prev) =>
            prev.map((t) =>
              t.id === entryId
                ? {
                    ...t,
                    translatedText: currentSourceLang === "fa" ? translatedEn : (currentSourceLang === "en" ? translatedFa : translatedEn),
                    originalCleanText: currentSourceLang === "en" ? undefined : translatedFa,
                    englishText,
                    farsiText,
                    isTranslating: false,
                  }
                : t
            )
          );
        } catch {
          // On failure: show raw text as fallback, NEVER remove entry
          setCommittedTranscripts((prev) =>
            prev.map((t) =>
              t.id === entryId
                ? {
                    ...t,
                    translatedText: data.text.trim(),
                    englishText: data.text.trim(),
                    farsiText: data.text.trim(),
                    isTranslating: false,
                  }
                : t
            )
          );
        }
      });
    },
  });

  // Auto-reconnect: detect unexpected disconnection
  const attemptReconnect = useCallback(async () => {
    if (!shouldBeConnectedRef.current) return;
    if (reconnectAttemptRef.current >= MAX_RECONNECT) {
      toast.error("Connection lost. Please restart transcription.");
      shouldBeConnectedRef.current = false;
      setIsConnected(false);
      return;
    }

    reconnectAttemptRef.current++;
    const delay = reconnectAttemptRef.current * 2000;
    console.log(`[transcribe] auto-reconnect attempt ${reconnectAttemptRef.current}/${MAX_RECONNECT} in ${delay}ms`);

    reconnectTimerRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
        if (error || !data?.token) throw new Error("Token fetch failed");

        const langCodeMap: Record<string, string> = { en: "eng", fa: "fas" };
        const languageCode = langCodeMap[sourceLangRef.current] || undefined;

        await scribe.connect({
          token: data.token,
          languageCode,
          microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });

        reconnectAttemptRef.current = 0;
        setIsConnected(true);
        console.log("[transcribe] auto-reconnect succeeded");
      } catch (err) {
        console.error("[transcribe] reconnect failed:", err);
        attemptReconnect();
      }
    }, delay);
  }, [scribe]);

  // Watch for unexpected disconnection
  useEffect(() => {
    if (!isConnected && shouldBeConnectedRef.current && !isConnecting) {
      console.log("[transcribe] unexpected disconnect detected, attempting reconnect");
      attemptReconnect();
    }
  }, [isConnected, isConnecting, attemptReconnect]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    shouldBeConnectedRef.current = true;
    reconnectAttemptRef.current = 0;
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) {
        throw new Error(error?.message || "Failed to get scribe token");
      }

      const langCodeMap: Record<string, string> = { en: "eng", fa: "fas" };
      const languageCode = langCodeMap[sourceLangRef.current] || undefined;

      await scribe.connect({
        token: data.token,
        languageCode,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      startTimeRef.current = Date.now();
      contextRef.current = [];
      setIsConnected(true);
    } catch (err: any) {
      console.error("Scribe connect error:", err);
      toast.error(err.message || "Failed to start transcription");
      shouldBeConnectedRef.current = false;
    } finally {
      setIsConnecting(false);
    }
  }, [scribe]);

  const disconnect = useCallback(() => {
    shouldBeConnectedRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    scribe.disconnect();
    setIsConnected(false);
    setPartialText("");
    // Clear translation queue
    translationQueueRef.current = [];
  }, [scribe]);

  const clearTranscripts = useCallback(() => {
    setCommittedTranscripts([]);
    setPartialText("");
    contextRef.current = [];
  }, []);

  const getFullTranscript = useCallback(() => {
    return committedTranscripts.map((t) => t.translatedText || t.text).join(" ");
  }, [committedTranscripts]);

  const updateSourceLang = useCallback((lang: SourceLang) => {
    setSourceLang(lang);
    sourceLangRef.current = lang;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldBeConnectedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    partialText,
    committedTranscripts,
    sourceLang,
    setSourceLang: updateSourceLang,
    connect,
    disconnect,
    clearTranscripts,
    getFullTranscript,
  };
}
