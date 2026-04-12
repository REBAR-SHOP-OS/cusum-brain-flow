import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Vizzy Gemini Voice — Browser SpeechRecognition STT → Gemini 2.5 Flash → Browser SpeechSynthesis TTS.
 * All premium voice I/O is handled by the external PersonaPlex bridge.
 * The web app uses free browser-native speech APIs as a lightweight fallback.
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

const NOISE_BLOCKLIST = /^(yeah|yep|hmm+|uh+|ah+|oh+|ok+|okay|mhm+|huh|ha+|hey|hi|bye|no|yes|so|well|like|um+|right|sure)\b/i;
const PUNCTUATION_ONLY = /^[\s.,!?…\-–—:;'"]+$/;
const REPEATED_CHARS = /(.)\1{4,}/;

function isNoise(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
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

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export function useVizzyGeminiVoice({ getSystemPrompt, sttMode = "auto" }: UseVizzyGeminiVoiceOptions) {
  const [state, setState] = useState<GeminiVoiceState>("idle");
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [partialText, setPartialText] = useState("");
  const [outputAudioBlocked, setOutputAudioBlocked] = useState(false);

  const conversationRef = useRef<Array<{ role: string; content: string }>>([]);
  const processingRef = useRef(false);
  const idCounter = useRef(0);
  const activeRef = useRef(false);
  const inputQueueRef = useRef<string[]>([]);
  const recognitionRef = useRef<any>(null);
  const sttModeRef = useRef(sttMode);
  sttModeRef.current = sttMode;

  // --- Browser SpeechSynthesis TTS ---
  const speakText = useCallback((text: string) => {
    if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Pick a natural-sounding voice if available
    const voices = window.speechSynthesis.getVoices();
    const hasFarsi = /[\u0600-\u06FF]/.test(text);
    
    if (hasFarsi) {
      const farsiVoice = voices.find(v => v.lang.startsWith("fa") || v.lang.startsWith("ar"));
      if (farsiVoice) utterance.voice = farsiVoice;
    } else {
      const preferred = voices.find(v =>
        v.lang.startsWith("en") && (v.name.includes("Natural") || v.name.includes("Enhanced") || v.name.includes("Google"))
      ) || voices.find(v => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;
    }

    utterance.rate = 0.95;
    utterance.pitch = 1.05;

    setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      resumeListening();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      resumeListening();
    };

    pauseListening();
    window.speechSynthesis.speak(utterance);
  }, []);

  // --- Browser SpeechRecognition STT ---
  const startRecognition = useCallback(() => {
    if (!SpeechRecognitionAPI || !activeRef.current || isMuted) return;
    if (recognitionRef.current) return; // already running

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    const lang = sttModeRef.current;
    if (lang === "fa") recognition.lang = "fa-IR";
    else if (lang === "en") recognition.lang = "en-US";
    // "auto" uses browser default

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      if (interimTranscript) setPartialText(interimTranscript);
      if (finalTranscript) {
        const trimmed = finalTranscript.trim();
        setPartialText("");
        if (!isNoise(trimmed)) {
          console.log("[VizzyGemini] Browser STT committed:", trimmed);
          processUserInput(trimmed);
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      console.warn("[VizzyGemini] SpeechRecognition error:", event.error);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      // Auto-restart if still active
      if (activeRef.current && !isMuted) {
        setTimeout(() => startRecognition(), 100);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.warn("[VizzyGemini] Recognition start failed:", e);
      recognitionRef.current = null;
    }
  }, [isMuted]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      recognitionRef.current = null;
    }
  }, []);

  const resumeListening = useCallback(() => {
    if (!activeRef.current || isMuted) return;
    startRecognition();
  }, [isMuted, startRecognition]);

  const pauseListening = useCallback(() => {
    stopRecognition();
  }, [stopRecognition]);

  // Core processing: send messages to Gemini, stream response, TTS via browser
  const processMessages = useCallback(async (
    userText: string | null,
    internalPrompt?: string
  ): Promise<string> => {
    processingRef.current = true;

    let userTranscript: VoiceTranscript | null = null;

    if (userText) {
      userTranscript = {
        id: `vt-${++idCounter.current}`,
        role: "user",
        text: userText,
        timestamp: Date.now(),
      };
      setTranscripts((prev) => [...prev, userTranscript!]);
      conversationRef.current.push({ role: "user", content: userText });
    }

    if (internalPrompt) {
      conversationRef.current.push({ role: "user", content: internalPrompt });
    }

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

      if (!fullResponse.trim()) return "";

      // If Gemini signals unclear input, silently discard
      if (fullResponse.trim() === "[UNCLEAR]") {
        if (userTranscript) {
          setTranscripts((prev) => prev.filter((t) => t.id !== userTranscript!.id));
          conversationRef.current.pop();
        }
        if (internalPrompt) conversationRef.current.pop();
        return "";
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

      if (ttsText && ttsText.length > 0) {
        speakText(ttsText);
      }

      return fullResponse;
    } catch (err) {
      console.error("[VizzyGemini] Processing error:", err);
      setErrorDetail(err instanceof Error ? err.message : String(err));
      return "";
    }
  }, [getSystemPrompt, speakText]);

  const processOneInput = useCallback(async (text: string) => {
    if (!text.trim()) return;
    await processMessages(text);
  }, [processMessages]);

  const flushQueue = useCallback(async () => {
    if (processingRef.current) return;
    while (inputQueueRef.current.length > 0 && activeRef.current) {
      const next = inputQueueRef.current.shift()!;
      processingRef.current = true;
      await processOneInput(next);
      processingRef.current = false;
    }
  }, [processOneInput]);

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
    setOutputAudioBlocked(false);
    activeRef.current = true;
    conversationRef.current = [];
    inputQueueRef.current = [];
    setTranscripts([]);
    setPartialText("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      // Start browser speech recognition
      startRecognition();

      setState("connected");
    } catch (err) {
      setState("error");
      setErrorDetail(err instanceof Error ? err.message : String(err));
    }
  }, [startRecognition]);

  const endSession = useCallback(() => {
    activeRef.current = false;
    inputQueueRef.current = [];
    processingRef.current = false;

    stopRecognition();
    window.speechSynthesis?.cancel();

    setIsSpeaking(false);
    setOutputAudioBlocked(false);
    setPartialText("");
    setState("idle");
  }, [stopRecognition]);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      resumeListening();
    } else {
      setIsMuted(true);
      pauseListening();
    }
  }, [isMuted, resumeListening, pauseListening]);

  const updateSessionInstructions = useCallback((_instructions: string) => {
    // Instructions are fetched lazily via getSystemPrompt — no-op here
  }, []);

  const sendFollowUp = useCallback(async (internalPrompt: string): Promise<string> => {
    if (!activeRef.current) return "";
    processingRef.current = true;
    const result = await processMessages(null, internalPrompt);
    processingRef.current = false;
    if (inputQueueRef.current.length > 0) {
      await flushQueue();
    }
    return result;
  }, [processMessages, flushQueue]);

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
    sendFollowUp,
    connectionPhase: state === "connecting" ? "getting_token" as const : state === "connected" ? "connected" as const : null,
    lastErrorKind: state === "error" ? "network" as const : null,
    lastErrorDetail: errorDetail,
    outputAudioBlocked,
    retryOutputAudio: () => {
      setOutputAudioBlocked(false);
    },
  };
}
