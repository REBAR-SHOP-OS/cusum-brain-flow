import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InterpreterTranscript {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export type InterpreterState = "idle" | "connecting" | "connected" | "error";

const CONNECTION_TIMEOUT_MS = 15_000;

export function useAzinVoiceInterpreter() {
  const [state, setState] = useState<InterpreterState>("idle");
  const [transcripts, setTranscripts] = useState<InterpreterTranscript[]>([]);
  const [mode, setMode] = useState<"speaking" | "listening" | null>(null);
  const idCounter = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimeout_ = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const conversation = useConversation({
    onConnect: () => {
      clearTimeout_();
      setState("connected");
      setMode("listening");
      if (navigator.vibrate) navigator.vibrate(50);
    },
    onDisconnect: () => {
      clearTimeout_();
      setState("idle");
      setMode(null);
    },
    onError: (error) => {
      clearTimeout_();
      console.error("AZIN interpreter error:", error);
      setState("error");
      toast.error("Voice connection error. Please try again.");
    },
    onMessage: (payload: any) => {
      if (payload.type === "user_transcript") {
        const text = payload.user_transcription_event?.user_transcript;
        if (text) {
          setTranscripts((prev) => [
            ...prev,
            { id: String(++idCounter.current), role: "user", text, timestamp: Date.now() },
          ]);
        }
      } else if (payload.type === "agent_response") {
        const text = payload.agent_response_event?.agent_response;
        if (text) {
          setTranscripts((prev) => [
            ...prev,
            { id: String(++idCounter.current), role: "agent", text, timestamp: Date.now() },
          ]);
        }
      } else if (payload.message) {
        setTranscripts((prev) => [
          ...prev,
          {
            id: String(++idCounter.current),
            role: payload.role === "user" ? "user" : "agent",
            text: payload.message,
            timestamp: Date.now(),
          },
        ]);
      }
    },
    onModeChange: (newMode: any) => {
      setMode(newMode.mode === "speaking" ? "speaking" : "listening");
    },
    onStatusChange: (status: any) => {
      if (status.status === "connecting") setState("connecting");
      else if (status.status === "connected") { clearTimeout_(); setState("connected"); }
      else if (status.status === "disconnected") { clearTimeout_(); setState("idle"); setMode(null); }
    },
  });

  const startSession = useCallback(async () => {
    setState("connecting");
    setTranscripts([]);
    setMode(null);

    timeoutRef.current = setTimeout(() => {
      console.warn("AZIN interpreter connection timeout");
      setState("error");
      toast.error("Connection timed out. Please try again.");
      try { conversation.endSession(); } catch {}
    }, CONNECTION_TIMEOUT_MS);

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke("elevenlabs-azin-token");

      if (error || !data?.signed_url) {
        throw new Error(error?.message || "No signed URL received");
      }

      await conversation.startSession({ signedUrl: data.signed_url });
    } catch (err: any) {
      clearTimeout_();
      console.error("Failed to start AZIN interpreter:", err);
      setState("error");
      if (err?.name === "NotAllowedError") {
        toast.error("Microphone access is required.");
      } else {
        toast.error("Could not connect. Try again.");
      }
    }
  }, [conversation]);

  const endSession = useCallback(async () => {
    clearTimeout_();
    try { await conversation.endSession(); } catch {}
    setState("idle");
    setMode(null);
  }, [conversation]);

  const setVolume = useCallback((vol: number) => {
    try { conversation.setVolume({ volume: Math.max(0, Math.min(1, vol)) }); } catch {}
  }, [conversation]);

  const getInputVolume = useCallback(() => {
    try { return conversation.getInputVolume(); } catch { return 0; }
  }, [conversation]);

  const getOutputVolume = useCallback(() => {
    try { return conversation.getOutputVolume(); } catch { return 0; }
  }, [conversation]);

  useEffect(() => {
    return () => { clearTimeout_(); };
  }, []);

  return {
    state,
    transcripts,
    isSpeaking: conversation.isSpeaking,
    mode,
    startSession,
    endSession,
    setVolume,
    getInputVolume,
    getOutputVolume,
  };
}
