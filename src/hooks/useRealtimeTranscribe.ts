import { useState, useCallback, useRef } from "react";
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
  isTranslating?: boolean;
  sourceLang: SourceLang;
}

export function useRealtimeTranscribe() {
  const [committedTranscripts, setCommittedTranscripts] = useState<CommittedTranscript[]>([]);
  const [partialText, setPartialText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const startTimeRef = useRef<number>(0);
  const contextRef = useRef<string[]>([]);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      setPartialText(data.text);
    },
    onCommittedTranscript: (data) => {
      const trimmed = data.text.trim();
      if (!trimmed) return;
      // Filter out very short fragments (likely background noise)
      const wordCount = trimmed.split(/\s+/).length;
      if (wordCount < 2 || trimmed.length < 5) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const entryId = crypto.randomUUID();
      setCommittedTranscripts((prev) => [
        ...prev,
        { id: entryId, text: data.text, timestamp: elapsed, isTranslating: true },
      ]);
      setPartialText("");

      // Send last 5 translated segments as context for better accuracy
      const contextWindow = contextRef.current.slice(-3).join(" | ");

      invokeEdgeFunction<{ translations: Record<string, string> }>(
        "translate-message",
        {
          text: data.text,
          sourceLang: "auto",
          targetLangs: ["en", "fa"],
          context: contextWindow || undefined,
        },
      )
        .then((res) => {
          const translatedEn = res?.translations?.en;
          const translatedFa = res?.translations?.fa;

          // If AI determined it's unintelligible noise, silently remove the entry
          if (!translatedEn || !translatedEn.trim()) {
            setCommittedTranscripts((prev) => prev.filter((t) => t.id !== entryId));
            return;
          }

          // Push successful translation to context buffer
          contextRef.current.push(translatedEn);
          if (contextRef.current.length > 10) {
            contextRef.current = contextRef.current.slice(-5);
          }

          setCommittedTranscripts((prev) =>
            prev.map((t) =>
              t.id === entryId
                ? {
                    ...t,
                    translatedText: translatedEn,
                    originalCleanText: translatedFa || undefined,
                    isTranslating: false,
                  }
                : t
            )
          );
        })
        .catch(() => {
          setCommittedTranscripts((prev) =>
            prev.map((t) =>
              t.id === entryId ? { ...t, translatedText: t.text, isTranslating: false } : t
            )
          );
        });
    },
  });

  const connect = useCallback(async () => {
    setIsConnecting(true);
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

      startTimeRef.current = Date.now();
      contextRef.current = [];
      setIsConnected(true);
    } catch (err: any) {
      console.error("Scribe connect error:", err);
      toast.error(err.message || "Failed to start transcription");
    } finally {
      setIsConnecting(false);
    }
  }, [scribe]);

  const disconnect = useCallback(() => {
    scribe.disconnect();
    setIsConnected(false);
    setPartialText("");
  }, [scribe]);

  const clearTranscripts = useCallback(() => {
    setCommittedTranscripts([]);
    setPartialText("");
    contextRef.current = [];
  }, []);

  const getFullTranscript = useCallback(() => {
    return committedTranscripts.map((t) => t.translatedText || t.text).join(" ");
  }, [committedTranscripts]);

  return {
    isConnected,
    isConnecting,
    partialText,
    committedTranscripts,
    connect,
    disconnect,
    clearTranscripts,
    getFullTranscript,
  };
}
