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
  const prevMsgCountRef = useRef(0);
  const prevAssistantTextRef = useRef("");

  const speech = useSpeechRecognition({
    onError: (err) => toast({ title: "Voice", description: err, variant: "destructive" }),
  });

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
        // Use full text when stream is done, otherwise use what we have
        if (!isStreaming) {
          triggerTTS(text);
        } else {
          triggerTTS(text);
        }
      }
    }

    // If TTS was already triggered with partial text, and stream just ended,
    // we already sent what we had — the audio covers the first chunk
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
        return;
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setStatus("idle");
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setStatus("idle");
      };

      setStatus("speaking");
      await audio.play();
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error("TTS error:", e);
      }
      setStatus("idle");
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

  const handleOrbTap = useCallback(() => {
    switch (status) {
      case "idle":
        // Start listening
        speech.reset();
        ttsTriggeredRef.current = false;
        prevAssistantTextRef.current = "";
        speech.start();
        setStatus("listening");
        break;

      case "listening":
        // Stop listening, send transcript
        speech.stop();
        const transcript = speech.fullTranscript + (speech.interimText ? " " + speech.interimText : "");
        if (transcript.trim()) {
          setStatus("thinking");
          ttsTriggeredRef.current = false;
          chat.sendMessage(transcript.trim());
        } else {
          setStatus("idle");
        }
        break;

      case "thinking":
        // Cancel and go back to idle
        chat.cancelStream();
        stopAudio();
        setStatus("idle");
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
  }, [status, speech, chat, stopAudio]);

  return {
    status,
    interimText: speech.interimText,
    fullTranscript: speech.fullTranscript,
    isSupported: speech.isSupported,
    handleOrbTap,
  };
}
