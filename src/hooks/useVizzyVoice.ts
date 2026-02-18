import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TranscriptEntry {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export type VoiceState = "idle" | "connecting" | "connected" | "error";
export type VoiceMode = "speaking" | "listening" | null;

const CONNECTION_TIMEOUT_MS = 15_000;

export function useVizzyVoice() {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [mode, setMode] = useState<VoiceMode>(null);
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
      setVoiceState("connected");
      setMode("listening");
      // Haptic feedback on mobile
      if (navigator.vibrate) navigator.vibrate(50);
    },
    onDisconnect: () => {
      clearTimeout_();
      setVoiceState("idle");
      setMode(null);
      if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
    },
    onError: (error) => {
      clearTimeout_();
      console.error("Vizzy voice error:", error);
      setVoiceState("error");
      toast.error("Voice connection error. Please try again.");
    },
    onMessage: (payload: any) => {
      // Handle transcript messages
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
      if (status.status === "connecting") {
        setVoiceState("connecting");
      } else if (status.status === "connected") {
        clearTimeout_();
        setVoiceState("connected");
      } else if (status.status === "disconnected") {
        clearTimeout_();
        setVoiceState("idle");
        setMode(null);
      }
    },
  });

  const startSession = useCallback(async () => {
    setVoiceState("connecting");
    setTranscripts([]);
    setMode(null);

    // Set connection timeout
    timeoutRef.current = setTimeout(() => {
      console.warn("Vizzy voice connection timeout");
      setVoiceState("error");
      toast.error("Connection timed out. Please try again.");
      try { conversation.endSession(); } catch {}
    }, CONNECTION_TIMEOUT_MS);

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token"
      );

      if (error || !data?.signed_url) {
        throw new Error(error?.message || "No signed URL received");
      }

      await conversation.startSession({
        signedUrl: data.signed_url,
      });
    } catch (err: any) {
      clearTimeout_();
      console.error("Failed to start Vizzy voice:", err);
      setVoiceState("error");
      if (err?.name === "NotAllowedError") {
        toast.error("Microphone access is required for voice chat.");
      } else {
        toast.error("Could not connect to Vizzy voice. Try again.");
      }
    }
  }, [conversation]);

  const endSession = useCallback(async () => {
    clearTimeout_();
    try {
      await conversation.endSession();
    } catch {
      // ignore
    }
    setVoiceState("idle");
    setMode(null);
  }, [conversation]);

  const setVolume = useCallback((vol: number) => {
    try {
      conversation.setVolume({ volume: Math.max(0, Math.min(1, vol)) });
    } catch {}
  }, [conversation]);

  const getInputVolume = useCallback(() => {
    try { return conversation.getInputVolume(); } catch { return 0; }
  }, [conversation]);

  const getOutputVolume = useCallback(() => {
    try { return conversation.getOutputVolume(); } catch { return 0; }
  }, [conversation]);

  const getOutputFrequency = useCallback(() => {
    try { return conversation.getOutputByteFrequencyData(); } catch { return new Uint8Array(0); }
  }, [conversation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { clearTimeout_(); };
  }, []);

  return {
    voiceState,
    transcripts,
    isSpeaking: conversation.isSpeaking,
    mode,
    status: conversation.status,
    getInputVolume,
    getOutputVolume,
    getOutputFrequency,
    setVolume,
    startSession,
    endSession,
  };
}
