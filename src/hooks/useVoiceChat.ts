import { useState, useRef, useCallback, useEffect } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useAdminChat } from "./useAdminChat";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export type VoiceChatStatus = "idle" | "listening" | "thinking" | "speaking";

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
const TTS_CHAR_THRESHOLD = 300;

export function useVoiceChat(chat: ReturnType<typeof useAdminChat>) {
  const [status, setStatus] = useState<VoiceChatStatus>("idle");
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const ttsTriggeredRef = useRef(false);
  const prevAssistantTextRef = useRef("");
  const conversationActiveRef = useRef(false);
  const statusRef = useRef<VoiceChatStatus>("idle");
  statusRef.current = status;

  // Handle auto-send when silence is detected
  const handleSilenceEnd = useCallback(() => {
    if (statusRef.current !== "listening" || !conversationActiveRef.current) return;
    // Grab transcript and send
    const transcript = speechRef.current.fullTranscript + (speechRef.current.interimText ? " " + speechRef.current.interimText : "");
    if (transcript.trim()) {
      speechRef.current.stop();
      setStatus("thinking");
      ttsTriggeredRef.current = false;
      chat.sendMessage(transcript.trim());
    }
  }, [chat]);

  const speech = useSpeechRecognition({
    onError: (err) => toast({ title: "Voice", description: err, variant: "destructive" }),
    onSilenceEnd: handleSilenceEnd,
    silenceTimeout: 1500,
  });

  // Keep a ref to speech so callbacks can access latest state
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

    // Trigger TTS when threshold reached or stream ends
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
      if (!session?.access_token) return;

      const controller = new AbortController();
      abortRef.current = controller;

      const resp = await fetch(TTS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        console.error("TTS failed:", resp.status);
        setStatus("idle");
        conversationActiveRef.current = false;
        return;
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        // Auto-listen: restart the loop if conversation is still active
        if (conversationActiveRef.current) {
          speechRef.current.reset();
          ttsTriggeredRef.current = false;
          prevAssistantTextRef.current = "";
          speechRef.current.start();
          setStatus("listening");
        } else {
          setStatus("idle");
        }
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setStatus("idle");
        conversationActiveRef.current = false;
      };

      setStatus("speaking");
      await audio.play();
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error("TTS error:", e);
      }
      setStatus("idle");
      conversationActiveRef.current = false;
    }
  }, []);

  const stopAudio = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
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

  const handleOrbTap = useCallback(() => {
    switch (status) {
      case "idle":
        // Start conversation loop
        conversationActiveRef.current = true;
        speech.reset();
        ttsTriggeredRef.current = false;
        prevAssistantTextRef.current = "";
        speech.start();
        setStatus("listening");
        break;

      case "listening":
        // Stop the entire conversation
        stopConversation();
        break;

      case "thinking":
        // Cancel and stop
        stopConversation();
        break;

      case "speaking":
        // Interrupt: stop audio, start listening again
        stopAudio();
        speech.reset();
        ttsTriggeredRef.current = false;
        speech.start();
        setStatus("listening");
        break;
    }
  }, [status, speech, stopAudio, stopConversation]);

  return {
    status,
    interimText: speech.interimText,
    fullTranscript: speech.fullTranscript,
    isSupported: speech.isSupported,
    handleOrbTap,
    isConversationActive: status !== "idle",
  };
}
