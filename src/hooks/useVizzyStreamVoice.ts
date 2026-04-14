import { useState, useCallback, useRef } from "react";
import { takePrimedMobileAudio } from "@/lib/audioPlayer";
import { supabase } from "@/integrations/supabase/client";
import { chunkText } from "@/utils/chunkText";

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
  const latestInstructionsRef = useRef<string>("");
  const audioQueueRef = useRef<HTMLAudioElement[]>([]);
  const isPlayingRef = useRef(false);
  const abortRef = useRef<AbortController>(new AbortController());
  const processingRef = useRef(false);
  const primedAudioRef = useRef<HTMLAudioElement | null>(null);
  const fallbackSpeechRef = useRef<string | null>(null);
  const browserFallbackTriggeredRef = useRef(false);

  const SpeechRecognitionAPI =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  // Legacy browser TTS fallback (kept as last resort)
  const speakWithBrowserTTS = useCallback((text: string) => {
    if (!window.speechSynthesis || !text.trim()) return;
    console.warn("[VizzyStream] Using browser TTS as last resort");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.onstart = () => {
      setAudioStatus("browser-tts");
      setIsSpeaking(true);
    };
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  const triggerBrowserFallback = useCallback((text?: string | null) => {
    if (!text?.trim() || browserFallbackTriggeredRef.current) return;
    browserFallbackTriggeredRef.current = true;
    fallbackSpeechRef.current = null;
    speakWithBrowserTTS(text);
  }, [speakWithBrowserTTS]);

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
      if (audioQueueRef.current.length === 0) triggerBrowserFallback(fallbackSpeechRef.current);
      playNextAudio();
    };
    audio.play()
      .then(() => {
        fallbackSpeechRef.current = null;
      })
      .catch(() => {
        isPlayingRef.current = false;
        if (audioQueueRef.current.length === 0) triggerBrowserFallback(fallbackSpeechRef.current);
        playNextAudio();
      });
  }, [triggerBrowserFallback]);

  // --- Play base64 audio ---
  const playBase64Audio = useCallback((base64: string, format: string = "mp3", fallbackText?: string) => {
    const mime = format === "wav" ? "audio/wav" : "audio/mpeg";
    const src = `data:${mime};base64,${base64}`;
    const audio = primedAudioRef.current ?? new Audio();
    primedAudioRef.current = null;
    audio.setAttribute("playsinline", "true");
    audio.preload = "auto";
    audio.src = src;
    fallbackSpeechRef.current = fallbackText || null;
    browserFallbackTriggeredRef.current = false;
    audioQueueRef.current.push(audio);
    playNextAudio();
  }, [playNextAudio]);

  // --- Chunked realtime TTS via vizzy-tts edge function ---
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsUrlCacheRef = useRef<string[]>([]);

  const stopSpeech = useCallback(() => {
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    fallbackSpeechRef.current = null;
    browserFallbackTriggeredRef.current = false;
    primedAudioRef.current?.pause();
    primedAudioRef.current = null;
    // Revoke cached object URLs
    ttsUrlCacheRef.current.forEach(url => URL.revokeObjectURL(url));
    ttsUrlCacheRef.current = [];
    // Clear audio queue
    audioQueueRef.current.forEach(a => {
      a.onended = null; a.onerror = null; a.pause(); a.src = "";
    });
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
    window.speechSynthesis?.cancel();
  }, []);

  const speakRealtime = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const chunks = chunkText(text);
    if (chunks.length === 0) return;

    console.log(`[VizzyStream] Chunked TTS: ${chunks.length} chunks`);
    setIsSpeaking(true);
    setAudioStatus("chunked-tts");
    fallbackSpeechRef.current = text;
    browserFallbackTriggeredRef.current = false;

    // Abort any previous TTS generation
    ttsAbortRef.current?.abort();
    const controller = new AbortController();
    ttsAbortRef.current = controller;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      console.error("[VizzyStream] Not authenticated for TTS");
      setIsSpeaking(false);
      triggerBrowserFallback(text);
      return;
    }

    const ttsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vizzy-tts`;
    let successCount = 0;

    // Fire chunks in parallel with staggered starts — queue as they resolve
    for (let i = 0; i < chunks.length; i++) {
      if (controller.signal.aborted) break;

      try {
        const resp = await fetch(ttsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ text: chunks[i] }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          console.warn(`[VizzyStream] TTS chunk ${i} failed: ${resp.status}`);
          continue;
        }

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        ttsUrlCacheRef.current.push(url);

        const audio = primedAudioRef.current ?? new Audio();
        primedAudioRef.current = null;
        audio.setAttribute("playsinline", "true");
        audio.preload = "auto";
        audio.src = url;
        audioQueueRef.current.push(audio);
        successCount += 1;
        playNextAudio();
      } catch (err: any) {
        if (err?.name === "AbortError") break;
        console.warn(`[VizzyStream] TTS chunk ${i} error:`, err?.message);
      }
    }

    if (!controller.signal.aborted && successCount === 0) {
      triggerBrowserFallback(text);
    }
  }, [playNextAudio, triggerBrowserFallback]);

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
      // Route through edge function proxy (avoids CORS/network issues)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/personaplex-voice`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: conversationRef.current,
          systemPrompt: latestInstructionsRef.current || getSystemPrompt(),
          voiceEnabled: true,
        }),
        signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        const errMsg = `API error ${resp.status}: ${errText || "Unknown error"}`;
        console.error("[VizzyStream] Edge function error:", errMsg);
        setApiConnected(false);
        setErrorDetail(errMsg);
        // Show error in transcript
        setTranscripts(prev => [...prev, {
          id: `t-${++idCounter.current}`,
          role: "agent",
          text: "⚠️ Vizzy API is unreachable right now. Please try again in a moment.",
          timestamp: Date.now(),
        }]);
        processingRef.current = false;
        setDebugStep("listening");
        return;
      }

      const data = await resp.json();
      const text = data.text || "";
      const agentId = `t-${++idCounter.current}`;

      // Track Vizzy One API metadata from edge function normalized response
      setApiConnected(data._api_connected === true);
      if (data._voice_path) setVoicePath(data._voice_path);
      if (data._intent) setIntent(data._intent);
      if (data._grounded !== undefined) setGrounded(data._grounded);
      setAudioStatus(data.audio_base64 ? "vizzy-one" : "text-only");
      setErrorDetail(null);

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
            // Chunked realtime TTS — start speaking chunk-by-chunk
            setAudioStatus("chunked-tts");
            speakRealtime(speakable);
          }
        }
      }
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      const errMsg = err?.message || "Unknown error";
      console.error("[VizzyStream] error:", errMsg);
      setApiConnected(false);
      setErrorDetail(errMsg);
      // Show error in transcript
      setTranscripts(prev => [...prev, {
        id: `t-${++idCounter.current}`,
        role: "agent",
        text: "⚠️ Vizzy API is unreachable right now. Please try again in a moment.",
        timestamp: Date.now(),
      }]);
    } finally {
      processingRef.current = false;
      setDebugStep("listening");
    }
  }, [playBase64Audio, speakRealtime]);

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
        setErrorDetail("Microphone access denied — check browser permissions");
        setState("error");
        return;
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
    console.log("[Patch A] active — native PersonaPlex audio still in lab");
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
    stopSpeech();

    setState("idle");
    setIsSpeaking(false);
    setIsMuted(false);
    setPartialText("");
    setDebugStep("idle");
    setTranscripts([]);
    conversationRef.current = [];
  }, [stopRecognition, stopSpeech]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (next) stopRecognition(); else startRecognition();
      return next;
    });
  }, [startRecognition, stopRecognition]);

  const updateSessionInstructions = useCallback((instructions: string) => {
    latestInstructionsRef.current = instructions;
  }, []);

  const sendFollowUp = useCallback((text: string) => {
    if (!activeRef.current) return;
    // Hidden system messages (tool results) — add as system role, not user
    if (text.startsWith("[TOOL_RESULTS_READY]") || text.startsWith("[SYSTEM]")) {
      conversationRef.current.push({ role: "system", content: text });
      // Call backend without adding user transcript
      (async () => {
        if (processingRef.current) return;
        processingRef.current = true;
        setDebugStep("thinking");
        const signal = abortRef.current.signal;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error("Not authenticated");
          const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/personaplex-voice`;
          const resp = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              messages: conversationRef.current,
              systemPrompt: latestInstructionsRef.current || getSystemPrompt(),
              voiceEnabled: true,
            }),
            signal,
          });
          if (!resp.ok) { processingRef.current = false; setDebugStep("listening"); return; }
          const data = await resp.json();
          const replyText = data.text || "";
          if (replyText && replyText.trim() !== "[UNCLEAR]") {
            setTranscripts(prev => [...prev, {
              id: `t-${++idCounter.current}`,
              role: "agent",
              text: replyText,
              timestamp: Date.now(),
            }]);
            conversationRef.current.push({ role: "assistant", content: replyText });
            if (data.audio_base64) playBase64Audio(data.audio_base64, data.audio_format || "mp3");
            else speakRealtime(replyText);
          }
        } catch (err: any) {
          if (err?.name === "AbortError") return;
          console.error("[VizzyStream] follow-up error:", err?.message);
        } finally {
          processingRef.current = false;
          setDebugStep("listening");
        }
      })();
      return;
    }
    callPersonaPlex(text);
  }, [callPersonaPlex, getSystemPrompt, playBase64Audio, speakRealtime]);

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
