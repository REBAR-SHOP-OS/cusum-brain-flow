import { useState, useRef, useCallback, useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MeetingAiBridgeState {
  active: boolean;
  status: "idle" | "connecting" | "active" | "error";
  isSpeaking: boolean;
  transcript: Array<{ role: "vizzy" | "user"; text: string; timestamp: number }>;
}

/**
 * Bridges ElevenLabs Conversational AI into a meeting as a local companion.
 *
 * Unlike useCallAiBridge (which injects audio into a WebRTC call), this hook:
 * - Uses the `useConversation` hook from @elevenlabs/react for WebRTC connection
 * - Captures local mic audio (same mic used for RC Video in another tab)
 * - Plays AI audio locally through speakers
 * - Does NOT inject audio into the RingCentral Video call
 * - Provides real-time transcript of the Vizzy conversation
 */
export function useMeetingAiBridge(meetingId: string | null) {
  const [state, setState] = useState<MeetingAiBridgeState>({
    active: false,
    status: "idle",
    isSpeaking: false,
    transcript: [],
  });

  const activeRef = useRef(false);

  const conversation = useConversation({
    onConnect: () => {
      console.log("[MeetingAI] Connected to Vizzy");
      activeRef.current = true;
      setState((s) => ({ ...s, active: true, status: "active" }));
      toast.success("Vizzy joined the meeting");
    },
    onDisconnect: () => {
      console.log("[MeetingAI] Vizzy disconnected");
      activeRef.current = false;
      setState((s) => ({ ...s, active: false, status: "idle", isSpeaking: false }));
    },
    onError: (error) => {
      console.error("[MeetingAI] Error:", error);
      activeRef.current = false;
      setState((s) => ({ ...s, status: "error", active: false }));
      toast.error("Vizzy connection error");
    },
    onMessage: (payload) => {
      const role = payload.role === "agent" ? "vizzy" as const : "user" as const;
      setState((s) => ({
        ...s,
        transcript: [
          ...s.transcript,
          { role, text: payload.message, timestamp: Date.now() },
        ],
      }));
    },
  });

  // Track speaking state
  useEffect(() => {
    setState((s) => {
      if (s.isSpeaking !== conversation.isSpeaking) {
        return { ...s, isSpeaking: conversation.isSpeaking };
      }
      return s;
    });
  }, [conversation.isSpeaking]);

  const summonVizzy = useCallback(async () => {
    if (activeRef.current || !meetingId) return;

    setState((s) => ({ ...s, status: "connecting", transcript: [] }));

    try {
      // Request mic permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL from existing edge function
      const { data, error } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        { body: { mode: "meeting_companion" } }
      );

      if (error || !data?.signed_url) {
        throw new Error(data?.error || "Failed to get Vizzy token");
      }

      // Start conversation via WebSocket with signed URL
      await conversation.startSession({
        signedUrl: data.signed_url,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to summon Vizzy";
      console.error("[MeetingAI] Start error:", err);
      setState((s) => ({ ...s, status: "error" }));
      toast.error(msg);
    }
  }, [meetingId, conversation]);

  const dismissVizzy = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch {
      // Force state reset
      activeRef.current = false;
      setState({ active: false, status: "idle", isSpeaking: false, transcript: [] });
    }
  }, [conversation]);

  // Send contextual update to Vizzy (e.g. meeting transcript context)
  const sendContext = useCallback(
    (text: string) => {
      if (activeRef.current) {
        conversation.sendContextualUpdate(text);
      }
    },
    [conversation]
  );

  // Send a text message to Vizzy
  const sendMessage = useCallback(
    (text: string) => {
      if (activeRef.current) {
        conversation.sendUserMessage(text);
      }
    },
    [conversation]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeRef.current) {
        conversation.endSession().catch(() => {});
      }
    };
  }, [conversation]);

  return {
    state,
    summonVizzy,
    dismissVizzy,
    sendContext,
    sendMessage,
    conversationStatus: conversation.status,
  };
}
