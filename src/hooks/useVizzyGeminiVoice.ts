import { useState, useCallback, useRef } from "react";
import { useScribe, CommitStrategy } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Vizzy Gemini Voice — ElevenLabs Scribe STT → Gemini 2.5 Flash → ElevenLabs TTS pipeline.
 * 
 * Turn-taking: Scribe STT is disconnected during TTS playback to prevent feedback loops.
 * Input queue: user speech is queued (not dropped) while processing.
 */

export interface VoiceTranscript {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export type GeminiVoiceState = "idle" | "connecting" | "connected" | "error";

export type SttMode = "auto" | "fa" | "en";

interface UseVizzyGeminiVoiceOptions {
  getSystemPrompt: () => string;
  sttMode?: SttMode;
}

// Noise filtering (reused from useNilaVoiceRelay patterns)
const NOISE_BLOCKLIST = /^(yeah|yep|hmm+|uh+|ah+|oh+|ok+|okay|mhm+|huh|ha+|hey|hi|bye|no|yes|so|well|like|um+|right|sure)\b/i;
const SCRIBE_ANNOTATION = /^\s*\(/;
const PUNCTUATION_ONLY = /^[\s.,!?…\-–—:;'"]+$/;
const REPEATED_CHARS = /(.)\1{4,}/;

function isNoise(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (SCRIBE_ANNOTATION.test(trimmed)) return true;
  if (PUNCTUATION_ONLY.test(trimmed)) return true;
  if (REPEATED_CHARS.test(trimmed)) return true;
  const letterCount = (trimmed.match(/[\p{L}]/gu) || []).length;
  if (letterCount < 1) return true;
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount < 2 && trimmed.length < 6) {
    if (NOISE_BLOCKLIST.test(trimmed.toLowerCase())) return true;
  }
  return false;
}

export function useVizzyGeminiVoice({ getSystemPrompt, sttMode = "auto" }: UseVizzyGeminiVoiceOptions) {
  const [state, setState] = useState<GeminiVoiceState>("idle");
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [partialText, setPartialText] = useState("");

  const conversationRef = useRef<Array<{ role: string; content: string }>>([]);
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const isPlayingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const processingRef = useRef(false);
  const idCounter = useRef(0);
  const activeRef = useRef(false);
  const inputQueueRef = useRef<string[]>([]);
  const suppressSTTRef = useRef(false);
  const scribeTokenRef = useRef<string | null>(null);
  const sttModeRef = useRef(sttMode);
  sttModeRef.current = sttMode;

  // Scribe hooks — committed transcript triggers processing
  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.VAD,
    onPartialTranscript: (data) => {
      if (suppressSTTRef.current || !activeRef.current) return;
      if (SCRIBE_ANNOTATION.test(data.text) || PUNCTUATION_ONLY.test(data.text)) return;
      setPartialText(data.text);
    },
    onCommittedTranscript: (data) => {
      if (suppressSTTRef.current || !activeRef.current) return;
      const trimmed = data.text.trim();
      if (isNoise(trimmed)) return;
      console.log("[VizzyGemini] Scribe committed:", trimmed);
      setPartialText("");
      processUserInput(trimmed);
    },
  });

  const scribeRef = useRef(scribe);
  scribeRef.current = scribe;

  // Resume STT listening after TTS finishes
  const resumeListening = useCallback(async () => {
    suppressSTTRef.current = false;
    if (!activeRef.current || isMuted) return;
    // Skip if already connected
    if (scribeRef.current.isConnected) return;
    try {
      // Always fetch a fresh token — cached tokens expire after 15 min
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) {
        console.warn("[VizzyGemini] Failed to get scribe token for resume:", error);
        return;
      }
      scribeTokenRef.current = data.token;
      await scribeRef.current.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e: any) {
      if (e?.message?.includes("WebSocket") || e?.name === "InvalidStateError") {
        console.warn("[VizzyGemini] Scribe reconnect WebSocket error (suppressed):", e?.message);
      } else {
        console.error("[VizzyGemini] Scribe reconnect failed:", e);
      }
    }
  }, [isMuted]);

  // Pause STT listening before TTS starts
  const pauseListening = useCallback(() => {
    suppressSTTRef.current = true;
    try {
      if (scribeRef.current.isConnected) {
        scribeRef.current.disconnect();
      }
    } catch {
      // ignore — WebSocket may already be closed
    }
  }, []);

  // Audio queue player — pauses STT during playback
  const playNext = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      if (audioQueueRef.current.length === 0) {
        setIsSpeaking(false);
        resumeListening();
      }
      return;
    }
    isPlayingRef.current = true;
    setIsSpeaking(true);
    pauseListening();

    const audio = audioQueueRef.current.shift()!;
    currentAudioRef.current = audio;
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
    currentAudioRef.current = null;
    isPlayingRef.current = false;
    playNext();
  }, [pauseListening, resumeListening]);

  // Process one user input through Gemini + TTS
  const processOneInput = useCallback(async (text: string) => {
    if (!text.trim()) return;
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

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

      if (!fullResponse.trim()) return;

      // If Gemini signals unclear input, silently discard
      if (fullResponse.trim() === "[UNCLEAR]") {
        setTranscripts((prev) => prev.filter((t) => t.id !== userTranscript.id));
        conversationRef.current.pop();
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
        try {
          const hasFarsi = /[\u0600-\u06FF]/.test(ttsText);
          const ttsVoiceId = hasFarsi
            ? "pFZP5JQG7iQjIQuC4Bku" // Lily — multilingual
            : "EXAVITQu4vr4xnSDxMaL"; // Sarah — English

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
                voiceId: ttsVoiceId,
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
    }
  }, [getSystemPrompt, playNext]);

  // Flush the input queue sequentially
  const flushQueue = useCallback(async () => {
    if (processingRef.current) return;
    while (inputQueueRef.current.length > 0 && activeRef.current) {
      const next = inputQueueRef.current.shift()!;
      processingRef.current = true;
      await processOneInput(next);
      processingRef.current = false;
    }
  }, [processOneInput]);

  // Public entry: queue user input
  const processUserInput = useCallback(async (text: string) => {
    if (!text.trim()) return;
    inputQueueRef.current.push(text);
    if (!processingRef.current) {
      await flushQueue();
    }
  }, [flushQueue]);

  const startSession = useCallback(async () => {
    setState("connecting");
    setErrorDetail(null);
    activeRef.current = true;
    suppressSTTRef.current = false;
    conversationRef.current = [];
    inputQueueRef.current = [];
    setTranscripts([]);
    setPartialText("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      // Get Scribe token
      const { data, error } = await supabase.functions.invoke("elevenlabs-scribe-token");
      if (error || !data?.token) throw new Error(error?.message || "Failed to get scribe token");
      scribeTokenRef.current = data.token;

      // Connect Scribe for real-time STT
      await scribe.connect({
        token: data.token,
        microphone: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      setState("connected");
    } catch (err) {
      setState("error");
      setErrorDetail(err instanceof Error ? err.message : String(err));
    }
  }, [scribe]);

  const endSession = useCallback(() => {
    activeRef.current = false;
    suppressSTTRef.current = true;
    inputQueueRef.current = [];
    processingRef.current = false;

    try { if (scribe.isConnected) scribe.disconnect(); } catch { /* ignore */ }
    scribeTokenRef.current = null;

    // Stop currently playing audio immediately
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.onended = null;
      currentAudioRef.current.onerror = null;
      URL.revokeObjectURL(currentAudioRef.current.src);
      currentAudioRef.current = null;
    }
    audioQueueRef.current.forEach((a) => {
      a.pause();
      a.onended = null;
      a.onerror = null;
      URL.revokeObjectURL(a.src);
    });
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
    setPartialText("");
    setState("idle");
  }, [scribe]);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      if (!suppressSTTRef.current) {
        resumeListening();
      }
    } else {
      setIsMuted(true);
      pauseListening();
    }
  }, [isMuted, resumeListening, pauseListening]);

  const updateSessionInstructions = useCallback((_instructions: string) => {
    // Instructions are fetched lazily via getSystemPrompt — no-op here
  }, []);

  return {
    state,
    transcripts,
    isSpeaking,
    isMuted,
    partialText,
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
