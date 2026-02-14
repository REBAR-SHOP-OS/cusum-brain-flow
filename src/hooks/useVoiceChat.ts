import { useState, useRef, useCallback, useEffect } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useAdminChat } from "./useAdminChat";
import { useToast } from "./use-toast";
import { supabase } from "@/integrations/supabase/client";

export type VoiceChatStatus = "idle" | "listening" | "thinking" | "speaking";

const TTS_CHAR_THRESHOLD = 300;
const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

export function useVoiceChat(chat: ReturnType<typeof useAdminChat>) {
  const [status, setStatus] = useState<VoiceChatStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const { toast } = useToast();
  const ttsTriggeredRef = useRef(false);
  const prevAssistantTextRef = useRef("");
  const conversationActiveRef = useRef(false);
  const statusRef = useRef<VoiceChatStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isMutedRef = useRef(false);
  statusRef.current = status;
  isMutedRef.current = isMuted;

  // Handle barge-in: user speaks during speaking/thinking states
  const handleBargeIn = useCallback((transcript: string) => {
    // Stop current TTS audio
    abortRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    // Cancel any in-flight AI stream
    chat.cancelStream();
    // Send the new message
    ttsTriggeredRef.current = false;
    setStatus("thinking");
    chat.sendMessage(transcript);
  }, [chat]);

  // Handle auto-send when silence is detected -- now works during listening AND speaking (barge-in)
  const handleSilenceEnd = useCallback(() => {
    if (!conversationActiveRef.current) return;
    if (isMutedRef.current) return; // Don't auto-send when muted
    const currentStatus = statusRef.current;
    
    const transcript = speechRef.current.fullTranscript + (speechRef.current.interimText ? " " + speechRef.current.interimText : "");
    if (!transcript.trim()) return;

    if (currentStatus === "speaking" || currentStatus === "thinking") {
      // Barge-in: user spoke while AI was speaking/thinking
      speechRef.current.reset();
      // Restart mic immediately after reset
      setTimeout(() => {
        if (conversationActiveRef.current) speechRef.current.start();
      }, 50);
      handleBargeIn(transcript.trim());
    } else if (currentStatus === "listening") {
      // Normal send
      speechRef.current.reset();
      setTimeout(() => {
        if (conversationActiveRef.current) speechRef.current.start();
      }, 50);
      setStatus("thinking");
      ttsTriggeredRef.current = false;
      chat.sendMessage(transcript.trim());
    }
  }, [chat, handleBargeIn]);

  const speech = useSpeechRecognition({
    onError: (err) => toast({ title: "Voice", description: err, variant: "destructive" }),
    onSilenceEnd: handleSilenceEnd,
    silenceTimeout: 1500,
  });

  const speechRef = useRef(speech);
  speechRef.current = speech;

  // Monitor streaming to detect completion and trigger TTS
  useEffect(() => {
    if (status !== "thinking") return;

    const msgs = chat.messages;
    const lastMsg = msgs[msgs.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant") return;

    const text = lastMsg.content;
    const isStreaming = chat.isStreaming;

    if (!ttsTriggeredRef.current) {
      if (text.length >= TTS_CHAR_THRESHOLD || (!isStreaming && text.length > 0)) {
        ttsTriggeredRef.current = true;
        triggerTTS(text);
      }
    }

    prevAssistantTextRef.current = text;
  }, [chat.messages, chat.isStreaming, status]);

  const triggerTTS = useCallback(async (text: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatus("idle");
        conversationActiveRef.current = false;
        return;
      }

      abortRef.current = new AbortController();

      const resp = await fetch(TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ text }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        console.error("TTS failed:", resp.status, errBody);
        // Don't kill conversation — fall back to listening
        if (conversationActiveRef.current) {
          ttsTriggeredRef.current = false;
          prevAssistantTextRef.current = "";
          setStatus("listening");
        } else {
          setStatus("idle");
        }
        return;
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        if (conversationActiveRef.current) {
          // Mic is already running (full duplex) -- just transition to listening
          ttsTriggeredRef.current = false;
          prevAssistantTextRef.current = "";
          setStatus("listening");
        } else {
          setStatus("idle");
        }
      };

      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        URL.revokeObjectURL(url);
        audioRef.current = null;
        // Fall back to listening instead of killing conversation
        if (conversationActiveRef.current) {
          ttsTriggeredRef.current = false;
          prevAssistantTextRef.current = "";
          setStatus("listening");
        } else {
          setStatus("idle");
        }
      };

      setStatus("speaking");
      // Ensure mic is running during speaking for barge-in detection
      if (conversationActiveRef.current && !speechRef.current.isListening) {
        speechRef.current.reset();
        speechRef.current.start();
      }
      await audio.play();
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("TTS error:", err);
      setStatus("idle");
      conversationActiveRef.current = false;
    }
  }, []);

  const stopAudio = useCallback(() => {
    abortRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const stopConversation = useCallback(() => {
    conversationActiveRef.current = false;
    speech.stop();
    stopAudio();
    chat.cancelStream();
    setStatus("idle");
  }, [speech, stopAudio, chat]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        // Muting: stop mic
        speech.stop();
      } else if (conversationActiveRef.current && statusRef.current !== "idle") {
        // Unmuting: restart mic
        speech.reset();
        speech.start();
      }
      return next;
    });
  }, [speech]);

  const handleOrbTap = useCallback(() => {
    switch (status) {
      case "idle":
        conversationActiveRef.current = true;
        setIsMuted(false);
        speech.reset();
        ttsTriggeredRef.current = false;
        prevAssistantTextRef.current = "";
        speech.start();
        setStatus("listening");
        break;

      case "listening":
      case "thinking":
      case "speaking":
        // All active states: tap = stop conversation entirely
        stopConversation();
        setIsMuted(false);
        break;
    }
  }, [status, speech, stopConversation]);

  return {
    status,
    interimText: speech.interimText,
    fullTranscript: speech.fullTranscript,
    isSupported: speech.isSupported,
    isListening: speech.isListening,
    isMuted,
    toggleMute,
    handleOrbTap,
    isConversationActive: status !== "idle",
  };
}
