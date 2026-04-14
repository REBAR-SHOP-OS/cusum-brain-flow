import { useState, useCallback, useRef } from "react";
import { takePrimedMobileAudio } from "@/lib/audioPlayer";

/**
 * Vizzy Stream Voice — STT → PersonaPlex (via backend proxy) → Audio playback.
 * 
 * Phase 1: Browser SpeechRecognition → personaplex-voice edge function → base64 audio
 * Phase 2: PersonaPlex handles full-duplex audio I/O
 * 
 * Fallback: If PersonaPlex adapter isn't deployed, the edge function falls back
 * to Lovable AI (text-only) + browser SpeechSynthesis for TTS.
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

export function useVizzyStreamVoice({ getSystemPrompt }: UseVizzyStreamVoiceOptions) {
  const [state, setState] = useState<StreamVoiceState>("idle");
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [partialText, setPartialText] = useState("");
  const [debugStep, setDebugStep] = useState("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [voicePath, setVoicePath] = useState<string>("idle");
  const [audioStatus, setAudioStatus] = useState<string>("idle");
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const [intent, setIntent] = useState<string | null>(null);
  const [grounded, setGrounded] = useState<boolean | null>(null);

  const recognitionRef = useRef<any>(null);
  const activeRef = useRef(false);
  const idCounter = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationRef = useRef<Array<{ role: string; content: string }>>([]);
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const isPlayingRef = useRef(false);
  const abortRef = useRef<AbortController>(new AbortController());
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
    audio.onended = () => { isPlayingRef.current = false; playNextAudio(); };
    audio.onerror = () => { isPlayingRef.current = false; playNextAudio(); };
    audio.play().catch(() => { isPlayingRef.current = false; playNextAudio(); });
  }, []);

  // --- Play base64 audio ---
  const playBase64Audio = useCallback((base64: string, format: string = "mp3") => {
    const mime = format === "wav" ? "audio/wav" : "audio/mpeg";
    const audio = new Audio(`data:${mime};base64,${base64}`);
    audioQueueRef.current.push(audio);
    playNextAudio();
  }, [playNextAudio]);

  // --- Browser TTS fallback (only if PersonaPlex returns no audio) ---
  const speakWithBrowserTTS = useCallback((text: string) => {
    if (!window.speechSynthesis || !text.trim()) return;
    console.warn("[VizzyStream] PersonaPlex returned no audio — using browser TTS fallback");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, []);

  // --- Call Vizzy One API directly ---
  const callPersonaPlex = useCallback(async (userText: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setDebugStep("thinking");

    const signal = abortRef.current.signal;

    // Add user transcript
    conversationRef.current.push({ role: "user", content: userText });
    setTranscripts(prev => [...prev, {
      id: `t-${++idCounter.current}`,
      role: "user",
      text: userText,
      timestamp: Date.now(),
    }]);

    try {
      const VIZZY_ONE_BASE = "https://pc.tail669f65.ts.net";
      const endpoint = `${VIZZY_ONE_BASE}/api/v1/vizzy/voice`;

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          source: "lovable",
          voice_enabled: true,
        }),
        signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.error("[VizzyStream] Vizzy One API error:", resp.status, errText);
        setApiConnected(false);
        processingRef.current = false;
        setDebugStep("listening");
        return;
      }

      const data = await resp.json();
      const text = data.reply || "";
      const agentId = `t-${++idCounter.current}`;

      // Track Vizzy One API metadata
      setApiConnected(data.ok === true);
      if (data.voice_path) setVoicePath(data.voice_path);
      if (data.intent) setIntent(data.intent);
      if (data.grounded !== undefined) setGrounded(data.grounded);
      setAudioStatus(data.audio_base64 ? "vizzy-one" : "text-only");

      if (text) {
        // Silently drop [UNCLEAR] — no transcript, no TTS
        if (text.trim() === "[UNCLEAR]") {
          processingRef.current = false;
          setDebugStep("listening");
          return;
        }

        // Add agent transcript
        setTranscripts(prev => [...prev, {
          id: agentId,
          role: "agent",
          text,
          timestamp: Date.now(),
        }]);

        conversationRef.current.push({ role: "assistant", content: text });
        if (conversationRef.current.length > 20) {
          conversationRef.current = conversationRef.current.slice(-20);
        }

        // Play audio
        const speakable = text
          .replace(/\[VIZZY-ACTION\][\s\S]*?\[\/VIZZY-ACTION\]/g, "")
          .replace(/\[UNCLEAR\]/g, "")
          .trim();

        if (speakable) {
          setDebugStep("speaking");
          if (data.audio_base64) {
            playBase64Audio(data.audio_base64, data.audio_format || "mp3");
          } else {
            // Fallback: browser TTS when PersonaPlex returns text-only
            speakWithBrowserTTS(speakable);
          }
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      console.error("[VizzyStream] error:", err);
    } finally {
      processingRef.current = false;
      setDebugStep("listening");
    }
  }, [playBase64Audio, speakWithBrowserTTS]);

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
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        const captured = finalText.trim();
        silenceTimerRef.current = setTimeout(() => {
          if (activeRef.current && !processingRef.current) {
            callPersonaPlex(captured);
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
      if (activeRef.current && recognitionRef.current === recognition) {
        try { recognition.start(); } catch { /* ignore */ }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognitionAPI, callPersonaPlex]);

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
    abortRef.current = new AbortController();
    setDebugStep("connecting");
    setState("connecting");
    setErrorDetail(null);
    conversationRef.current = [];

    takePrimedMobileAudio();

    setTimeout(() => {
      if (!activeRef.current) return;
      setState("connected");
      setDebugStep("listening");
      startRecognition();
    }, 300);
  }, [startRecognition]);

  const endSession = useCallback(() => {
    activeRef.current = false;
    abortRef.current.abort();
    abortRef.current = new AbortController();

    stopRecognition();
    window.speechSynthesis?.cancel();

    audioQueueRef.current.forEach(a => {
      a.onended = null; a.onerror = null; a.pause(); a.src = "";
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
      if (next) stopRecognition(); else startRecognition();
      return next;
    });
  }, [startRecognition, stopRecognition]);

  const updateSessionInstructions = useCallback((_instructions: string) => {
    // No-op — system prompt is read fresh on each call via getSystemPrompt()
  }, []);

  const sendFollowUp = useCallback((text: string) => {
    if (!activeRef.current) return;
    callPersonaPlex(text);
  }, [callPersonaPlex]);

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
    voicePath,
    audioStatus,
    apiConnected,
    intent,
    grounded,
  };
}
