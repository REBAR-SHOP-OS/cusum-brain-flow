import { useState, useCallback, useRef, useEffect } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { supabase } from "@/integrations/supabase/client";

/**
 * Vizzy Gemini Voice — STT → Gemini 2.5 Flash → ElevenLabs TTS pipeline.
 * Replaces WebRTC-based OpenAI Realtime with a reliable text-based pipeline.
 */

export interface VoiceTranscript {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export type GeminiVoiceState = "idle" | "connecting" | "connected" | "error";

interface UseVizzyGeminiVoiceOptions {
  getSystemPrompt: () => string;
}

export function useVizzyGeminiVoice({ getSystemPrompt }: UseVizzyGeminiVoiceOptions) {
  const [state, setState] = useState<GeminiVoiceState>("idle");
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const conversationRef = useRef<Array<{ role: string; content: string }>>([]);
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const isPlayingRef = useRef(false);
  const processingRef = useRef(false);
  const idCounter = useRef(0);
  const activeRef = useRef(false);

  // Audio queue player
  const playNext = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      if (audioQueueRef.current.length === 0) setIsSpeaking(false);
      return;
    }
    isPlayingRef.current = true;
    setIsSpeaking(true);
    const audio = audioQueueRef.current.shift()!;
    try {
      await audio.play();
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
      });
    } catch (e) {
      console.warn("[VizzyGemini] Audio playback failed:", e);
    }
    URL.revokeObjectURL(audio.src);
    isPlayingRef.current = false;
    playNext();
  }, []);

  // Send text to Gemini, get response, TTS it
  const processUserInput = useCallback(async (text: string) => {
    if (!text.trim() || processingRef.current) return;
    processingRef.current = true;

    const userTranscript: VoiceTranscript = {
      id: `vt-${++idCounter.current}`,
      role: "user",
      text,
      timestamp: Date.now(),
    };
    setTranscripts((prev) => [...prev, userTranscript]);
    conversationRef.current.push({ role: "user", content: text });

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      // Stream from Gemini via edge function
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vizzy-voice-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: conversationRef.current,
            systemPrompt: getSystemPrompt(),
          }),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini error ${resp.status}: ${errText}`);
      }

      // Parse SSE stream
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullResponse += content;
          } catch {
            // partial JSON, ignore
          }
        }
      }

      if (!fullResponse.trim()) {
        processingRef.current = false;
        return;
      }

      // Add agent transcript
      const agentTranscript: VoiceTranscript = {
        id: `vt-${++idCounter.current}`,
        role: "agent",
        text: fullResponse,
        timestamp: Date.now(),
      };
      setTranscripts((prev) => [...prev, agentTranscript]);
      conversationRef.current.push({ role: "assistant", content: fullResponse });

      // Strip action tags for TTS
      const ttsText = fullResponse
        .replace(/\[VIZZY-ACTION\][\s\S]*?\[\/VIZZY-ACTION\]/g, "")
        .replace(/LOVABLE COMMAND:[\s\S]*?DO NOT TOUCH:[^\n]*/g, "")
        .trim();

      if (ttsText && ttsText.length > 0 && ttsText.length <= 5000) {
        // Send to ElevenLabs TTS
        try {
          const ttsResp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({
                text: ttsText.slice(0, 4500),
                voiceId: "EXAVITQu4vr4xnSDxMaL", // Sarah - clear female voice
                speed: 1.0,
              }),
            }
          );

          if (ttsResp.ok) {
            const blob = await ttsResp.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioQueueRef.current.push(audio);
            playNext();
          } else {
            console.warn("[VizzyGemini] TTS failed:", ttsResp.status);
          }
        } catch (ttsErr) {
          console.warn("[VizzyGemini] TTS error:", ttsErr);
        }
      }
    } catch (err) {
      console.error("[VizzyGemini] Processing error:", err);
      setErrorDetail(err instanceof Error ? err.message : String(err));
    } finally {
      processingRef.current = false;
    }
  }, [getSystemPrompt, playNext]);

  // Speech recognition
  const speech = useSpeechRecognition({
    lang: "en-US",
    silenceTimeout: 2000,
    onSilenceEnd: () => {
      if (speech.fullTranscript.trim() && activeRef.current) {
        const text = speech.fullTranscript.trim();
        speech.clearTranscripts();
        processUserInput(text);
      }
    },
    onError: (err) => {
      console.warn("[VizzyGemini] Speech error:", err);
    },
  });

  const startSession = useCallback(async () => {
    setState("connecting");
    setErrorDetail(null);
    activeRef.current = true;
    conversationRef.current = [];
    setTranscripts([]);

    try {
      // Test auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      speech.start();
      setState("connected");

      // Send greeting prompt after a short delay
      setTimeout(() => {
        processUserInput("(Session started — give your morning briefing greeting)");
      }, 1000);
    } catch (err) {
      setState("error");
      setErrorDetail(err instanceof Error ? err.message : String(err));
    }
  }, [speech, processUserInput]);

  const endSession = useCallback(() => {
    activeRef.current = false;
    speech.stop();
    audioQueueRef.current.forEach((a) => {
      a.pause();
      URL.revokeObjectURL(a.src);
    });
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
    setState("idle");
  }, [speech]);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      speech.start();
      setIsMuted(false);
    } else {
      speech.stop();
      setIsMuted(true);
    }
  }, [isMuted, speech]);

  // Update session instructions (called by VizzyVoiceEngine for context refresh)
  const updateSessionInstructions = useCallback((_instructions: string) => {
    // Instructions are fetched lazily via getSystemPrompt — no-op here
  }, []);

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
    connectionPhase: state === "connecting" ? "getting_token" as const : state === "connected" ? "connected" as const : null,
    lastErrorKind: state === "error" ? "network" as const : null,
    lastErrorDetail: errorDetail,
    outputAudioBlocked: false,
    retryOutputAudio: () => {},
  };
}
