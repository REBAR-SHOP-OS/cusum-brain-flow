import { useConversation } from "@elevenlabs/react";
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TranscriptEntry {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export type VoiceState = "idle" | "connecting" | "connected" | "error";

export function useVizzyVoice() {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const idCounter = useRef(0);

  const conversation = useConversation({
    onConnect: () => {
      setVoiceState("connected");
    },
    onDisconnect: () => {
      setVoiceState("idle");
    },
    onError: (error) => {
      console.error("Vizzy voice error:", error);
      setVoiceState("error");
      toast.error("Voice connection error. Please try again.");
    },
    onMessage: (payload) => {
      setTranscripts((prev) => [
        ...prev,
        {
          id: String(++idCounter.current),
          role: payload.role === "user" ? "user" : "agent",
          text: payload.message,
          timestamp: Date.now(),
        },
      ]);
    },
  });

  const startSession = useCallback(async () => {
    setVoiceState("connecting");
    setTranscripts([]);

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token"
      );

      if (error || !data?.token) {
        throw new Error(error?.message || "No token received");
      }

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (err: any) {
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
    try {
      await conversation.endSession();
    } catch {
      // ignore
    }
    setVoiceState("idle");
  }, [conversation]);

  return {
    voiceState,
    transcripts,
    isSpeaking: conversation.isSpeaking,
    status: conversation.status,
    startSession,
    endSession,
  };
}
