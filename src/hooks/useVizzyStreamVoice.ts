import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { takePrimedMobileAudio } from "@/lib/audioPlayer";

/**
 * Vizzy Stream Voice — STT → Lovable AI (streaming) → ElevenLabs TTS pipeline.
 * Replaces WebRTC realtime approach to eliminate ICE/TURN mobile failures.
 * Mic → Browser SpeechRecognition → vizzy-voice-chat → elevenlabs-tts → Speaker
 */

export interface VoiceTranscript {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export type StreamVoiceState = "idle" | "connecting" | "connected" | "error";

interface UseVizzyStreamVoiceOptions {
  getSystemPrompt: () => string;
}

const TTS_VOICE_ID = "FGY2WhTYpPnrIDTdsKH5"; // Laura

export function useVizzyStreamVoice({ getSystemPrompt }: UseVizzyStreamVoiceOptions) {
  const [state, setState] = useState<StreamVoiceState>("idle");
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [partialText, setPartialText] = useState("");
  const [debugStep, setDebugStep] = useState("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const activeRef = useRef(false);
  const idCounter = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationRef = useRef<Array<{ role: string; content: string }>>([]);
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const isPlayingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const processingRef = useRef(false);

  const SpeechRecognitionAPI =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  // --- Audio queue ---
  const playNextAudio = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      if (audioQueueRef.current.length === 0) setIsSpeaking(false);
      return;
    }
    isPlayingRef.current = true;
    setIsSpeaking(true);
    const audio = audioQueueRef.current.shift()!;
    audio.onended = () => {
      isPlayingRef.current = false;
      playNextAudio();
    };
    audio.onerror = () => {
      isPlayingRef.current = false;
      playNextAudio();
    };
    audio.play().catch(() => {
      isPlayingRef.current = false;
      playNextAudio();
    });
  }, []);

  // --- TTS ---
  const speakText = useCallback(async (text: string) => {
    const signal = abortRef.current?.signal;
    if (signal?.aborted || !text.trim()) return;

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, voiceId: TTS_VOICE_ID, speed: 1.1 }),
          signal,
        }
      );
      if (signal?.aborted || !resp.ok) return;

      const blob = await resp.blob();
      if (signal?.aborted) return;

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);

      audioQueueRef.current.push(audio);
      playNextAudio();
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("[VizzyStream] TTS error:", err);
    }
  }, [playNextAudio]);

  // --- LLM stream ---
  const streamLLM = useCallback(async (userText: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setDebugStep("thinking");

    const signal = abortRef.current?.signal;

    // Add user message to conversation
    conversationRef.current.push({ role: "user", content: userText });
    setTranscripts(prev => [...prev, {
      id: `t-${++idCounter.current}`,
      role: "user",
      text: userText,
      timestamp: Date.now(),
    }]);

    // Build messages with system prompt
    const messages = [
      ...conversationRef.current,
    ];

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vizzy-voice-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages,
            systemPrompt: getSystemPrompt(),
          }),
          signal,
        }
      );

      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => "");
        console.error("[VizzyStream] LLM error:", resp.status, errText);
        processingRef.current = false;
        setDebugStep("listening");
        return;
      }

      // Parse SSE stream
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";
      const agentId = `t-${++idCounter.current}`;

      setTranscripts(prev => [...prev, {
        id: agentId,
        role: "agent",
        text: "",
        timestamp: Date.now(),
      }]);

      setDebugStep("speaking");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              setTranscripts(prev =>
                prev.map(t => t.id === agentId ? { ...t, text: fullResponse } : t)
              );
            }
          } catch {
            // partial JSON, ignore
          }
        }
      }

      // Final flush
      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw || !raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              setTranscripts(prev =>
                prev.map(t => t.id === agentId ? { ...t, text: fullResponse } : t)
              );
            }
          } catch {}
        }
      }

      // Add to conversation history
      if (fullResponse) {
        conversationRef.current.push({ role: "assistant", content: fullResponse });
        // Keep last 20 messages to avoid token overflow
        if (conversationRef.current.length > 20) {
          conversationRef.current = conversationRef.current.slice(-20);
        }

        // TTS — strip action tags before speaking
        const speakable = fullResponse
          .replace(/\[VIZZY-ACTION\][\s\S]*?\[\/VIZZY-ACTION\]/g, "")
          .replace(/\[UNCLEAR\]/g, "")
          .trim();
        if (speakable && speakable !== "[UNCLEAR]") {
          await speakText(speakable);
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("[VizzyStream] stream error:", err);
    } finally {
      processingRef.current = false;
      setDebugStep("listening");
    }
  }, [getSystemPrompt, speakText]);

  // --- Speech recognition ---
  const startRecognition = useCallback(() => {
    if (!SpeechRecognitionAPI || recognitionRef.current) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript.trim() + " ";
        } else {
          interim += result[0].transcript;
        }
      }

      if (interim) {
        setPartialText(interim);
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }

      if (finalText.trim()) {
        setPartialText("");
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        const captured = finalText.trim();
        // Wait for silence before sending to LLM
        silenceTimerRef.current = setTimeout(() => {
          if (activeRef.current && !processingRef.current) {
            streamLLM(captured);
          }
        }, 1200);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "aborted") return;
      console.error("[VizzyStream] STT error:", event.error);
      if (event.error === "not-allowed") {
        setErrorDetail("Microphone access denied");
        setState("error");
      }
    };

    recognition.onend = () => {
      // Auto-restart if still active
      if (activeRef.current && recognitionRef.current === recognition) {
        try { recognition.start(); } catch { /* ignore */ }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognitionAPI, streamLLM]);

  const stopRecognition = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      const ref = recognitionRef.current;
      recognitionRef.current = null;
      try { ref.stop(); } catch { /* ignore */ }
    }
    setPartialText("");
  }, []);

  // --- Session management ---
  const startSession = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    setDebugStep("connecting");
    setState("connecting");
    setErrorDetail(null);
    conversationRef.current = [];

    // Prime mobile audio
    takePrimedMobileAudio();

    // Quick "connection" — no WebRTC handshake needed
    setTimeout(() => {
      if (!activeRef.current) return;
      setState("connected");
      setDebugStep("listening");
      startRecognition();
    }, 300);
  }, [startRecognition]);

  const endSession = useCallback(() => {
    activeRef.current = false;
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    stopRecognition();

    // Stop all audio
    audioQueueRef.current.forEach(a => {
      a.onended = null;
      a.onerror = null;
      a.pause();
      a.src = "";
    });
    audioQueueRef.current = [];
    isPlayingRef.current = false;

    setState("idle");
    setIsSpeaking(false);
    setIsMuted(false);
    setPartialText("");
    setDebugStep("idle");
    setTranscripts([]);
    conversationRef.current = [];
  }, [stopRecognition]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (next) {
        stopRecognition();
      } else {
        startRecognition();
      }
      return next;
    });
  }, [startRecognition, stopRecognition]);

  const updateSessionInstructions = useCallback((_instructions: string) => {
    // No-op for stream mode — system prompt is read fresh via getSystemPrompt() on each LLM call
  }, []);

  const sendFollowUp = useCallback((text: string) => {
    if (!activeRef.current) return;
    streamLLM(text);
  }, [streamLLM]);

  // Initialize abort controller
  if (!abortRef.current) {
    abortRef.current = new AbortController();
  }

  return {
    state,
    transcripts,
    isSpeaking,
    isMuted,
    mode: isSpeaking ? "speaking" as const : "listening" as const,
    startSession,
    endSession,
    toggleMute,
    updateSessionInstructions,
    sendFollowUp,
    partialText,
    outputAudioBlocked: false,
    retryOutputAudio: undefined,
    debugStep,
    lastErrorDetail: errorDetail,
  };
}
