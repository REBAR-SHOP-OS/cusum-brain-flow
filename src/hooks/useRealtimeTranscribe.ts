import { useState, useCallback, useRef } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { toast } from "sonner";

interface CommittedTranscript {
  id: string;
  text: string;
  timestamp: number;
  translatedText?: string;
  originalCleanText?: string;
  isTranslating?: boolean;
}

export function useRealtimeTranscribe() {
  const [committedTranscripts, setCommittedTranscripts] = useState<CommittedTranscript[]>([]);
  const [partialText, setPartialText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const startTimeRef = useRef<number>(0);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      setPartialText(data.text);
    },
    onCommittedTranscript: (data) => {
      if (!data.text.trim()) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const entryId = crypto.randomUUID();
      setCommittedTranscripts((prev) => [
        ...prev,
        { id: entryId, text: data.text, timestamp: elapsed, isTranslating: true },
      ]);
      setPartialText("");

      // Fire-and-forget translation to English via direct fetch (faster)
      invokeEdgeFunction<{ translations: Record<string, string> }>(
        "translate-message",
        { text: data.text, sourceLang: "auto", targetLangs: ["en"] },
      )
        .then((res) => {
          const translated = res?.translations?.en;
          setCommittedTranscripts((prev) =>
            prev.map((t) =>
              t.id === entryId
                ? { ...t, translatedText: translated || t.text, isTranslating: false }
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
        },
      });

      startTimeRef.current = Date.now();
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
