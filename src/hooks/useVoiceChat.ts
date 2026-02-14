import { useState, useRef, useCallback, useEffect } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useAdminChat } from "./useAdminChat";
import { useToast } from "./use-toast";

export type VoiceChatStatus = "idle" | "listening" | "thinking" | "speaking";

const TTS_CHAR_THRESHOLD = 300;

export function useVoiceChat(chat: ReturnType<typeof useAdminChat>) {
  const [status, setStatus] = useState<VoiceChatStatus>("idle");
  const { toast } = useToast();
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

  const triggerTTS = useCallback((text: string) => {
    if (!window.speechSynthesis) {
      setStatus("idle");
      conversationActiveRef.current = false;
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
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

    utterance.onerror = () => {
      setStatus("idle");
      conversationActiveRef.current = false;
    };

    setStatus("speaking");
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopAudio = useCallback(() => {
    window.speechSynthesis?.cancel();
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
