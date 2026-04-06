import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  useVoiceEngine — Generic OpenAI Realtime WebRTC Voice Engine      */
/*  Reusable across any feature needing real-time voice interaction.   */
/* ------------------------------------------------------------------ */

export interface VoiceTranscript {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export type VoiceEngineState = "idle" | "connecting" | "connected" | "error";
export type VoiceEngineMode = "speaking" | "listening" | null;

export interface VoiceEngineConfig {
  /** System prompt / instructions sent to OpenAI Realtime. Can also be a getter function for lazy evaluation. */
  instructions: string | (() => string);
  /** OpenAI voice id (default: "alloy") */
  voice?: string;
  /** OpenAI Realtime model (default: "gpt-4o-mini-realtime-preview") */
  model?: string;
  /** VAD threshold 0-1 (default: 0.4) */
  vadThreshold?: number;
  /** Silence duration in ms before turn ends (default: 300) */
  silenceDurationMs?: number;
  /** Prefix padding in ms (default: 200) */
  prefixPaddingMs?: number;
  /** Connection timeout in ms (default: 15000) */
  connectionTimeoutMs?: number;
  /** Max session duration in ms (default: 1800000 = 30 minutes) */
  maxSessionDurationMs?: number;
  /** Temperature for model output (default: 0.8). Lower = more deterministic */
  temperature?: number;
  /** Enable translation-mode filtering (language-mismatch + aggressive phrase blocking). Default: false */
  translationMode?: boolean;
}

const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime";
const DEFAULT_MAX_SESSION_MS = 30 * 60 * 1000; // 30 minutes

// RTL character detection for Farsi/Arabic
const FARSI_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

// Patterns that are ALWAYS filtered (empty/filler noise regardless of mode)
const ALWAYS_FILTER_PATTERNS = [
  /^\.{1,3}$/,  // just dots
  /^(oh|hmm|uh|um|huh)\.?$/i,
];

// Patterns only filtered in translation mode (conversational phrases that are valid assistant responses)
const TRANSLATION_ONLY_PATTERNS = [
  /^(hello|hi|hey|salam|welcome)/i,
  /\b(i am|i'm|i can|i will|i'll|let me|how can i)\b/i,
  /\b(sure|of course|okay|got it|understood|absolutely|certainly)\b/i,
  /\b(how can i help|what would you like|let me know|is there anything)\b/i,
  /\b(i'm here to|i am here to|i'm ready|i am ready|i'm listening)\b/i,
  /\b(translat(ing|ion)|interpret(ing|ation))\b/i,
  /\b(that's interesting|good question|i see|i understand)\b/i,
  /^(nothing|well|so|alright|yes|no|yeah|nah)\.?$/i,
  /^(sorry|pardon|excuse me|right|okay then|now|wait)\.?$/i,
  /\b(what do you|what should|can you|do you want|would you like)\b/i,
  /\b(first|listen|carefully|you shouldn't|you should)\b/i,
  /^(go ahead|please|thank you|thanks|you're welcome)\.?$/i,
];

// Single-word or two-word filler that is clearly not a translation
const SHORT_FILLER_RE = /^[a-zA-Z]{1,12}\.?$/; // single short English word

function isSelfTalk(text: string, lastUserText?: string, translationMode = false): boolean {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  
  // Block empty or whitespace
  if (!trimmed || trimmed.length < 2) return true;
  
  // Always-filter patterns (noise in any mode)
  if (ALWAYS_FILTER_PATTERNS.some(p => p.test(lower))) return true;
  
  // Translation-only patterns — skip for assistant mode
  if (translationMode && TRANSLATION_ONLY_PATTERNS.some(p => p.test(lower))) return true;
  
  // Block very short agent outputs (1-2 words) that look like filler — only in translation mode
  if (translationMode) {
    const words = lower.split(/\s+/);
    if (words.length <= 2 && SHORT_FILLER_RE.test(words[0]) && !FARSI_RE.test(trimmed)) return true;
  }
  
  // Language-mismatch filter: translation must switch languages — ONLY in translation mode
  if (translationMode && lastUserText) {
    const userIsFarsi = FARSI_RE.test(lastUserText);
    const agentIsFarsi = FARSI_RE.test(trimmed);
    if (userIsFarsi && agentIsFarsi) return true;
    if (!userIsFarsi && !agentIsFarsi) return true;
  }
  
  // Echo detection: if agent text is very similar to user text, it's parroting
  if (lastUserText && lastUserText.length > 5) {
    const similarity = textSimilarity(lower, lastUserText.toLowerCase());
    if (similarity > 0.7) return true;
  }
  
  return false;
}

// Simple Jaccard similarity for echo detection
function textSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/));
  const setB = new Set(b.split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export function useVoiceEngine(config: VoiceEngineConfig) {
  const [state, setState] = useState<VoiceEngineState>("idle");
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [mode, setMode] = useState<VoiceEngineMode>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [outputAudioBlocked, setOutputAudioBlocked] = useState(false);

  const idCounter = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  /** Latest instructions to send via session.update when the data channel becomes ready */
  const pendingSessionInstructionsRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const agentTextRef = useRef("");
  const transcriptsRef = useRef<VoiceTranscript[]>([]);
  const configRef = useRef(config);
  configRef.current = config;

  // Stability refs
  const reconnectAttemptsRef = useRef(0);
  const keepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceGraceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const MAX_RECONNECT_ATTEMPTS = 3;

  // Keep transcriptsRef in sync
  useEffect(() => { transcriptsRef.current = transcripts; }, [transcripts]);

  const clearTimeout_ = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const clearSessionTimer = () => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
  };

  const clearKeepalive = useCallback(() => {
    if (keepaliveRef.current) {
      clearInterval(keepaliveRef.current);
      keepaliveRef.current = null;
    }
  }, []);

  const clearIceGrace = useCallback(() => {
    if (iceGraceRef.current) {
      clearTimeout(iceGraceRef.current);
      iceGraceRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    intentionalCloseRef.current = true;
    clearTimeout_();
    clearSessionTimer();
    clearKeepalive();
    clearIceGrace();
    if (dcRef.current) {
      try { dcRef.current.close(); } catch {}
      dcRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch {}
      pcRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioElRef.current) {
      try { audioElRef.current.pause(); audioElRef.current.remove(); } catch {}
      audioElRef.current = null;
    }
    pendingSessionInstructionsRef.current = null;
    setOutputAudioBlocked(false);
  }, [clearKeepalive, clearIceGrace]);

  /** Push new system instructions to OpenAI Realtime after connect (e.g. ERP digest arrived late). */
  const updateSessionInstructions = useCallback((instructions: string) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      try {
        dc.send(JSON.stringify({
          type: "session.update",
          session: { instructions },
        }));
        pendingSessionInstructionsRef.current = null;
        console.log("[VoiceEngine] session.update (instructions) sent");
      } catch (e) {
        console.warn("[VoiceEngine] session.update failed:", e);
        pendingSessionInstructionsRef.current = instructions;
      }
      return;
    }
    pendingSessionInstructionsRef.current = instructions;
  }, []);

  const retryOutputAudio = useCallback(() => {
    const el = audioElRef.current;
    if (!el?.srcObject) {
      toast.error("No voice stream yet — wait until connected.");
      return;
    }
    el.play()
      .then(() => {
        setOutputAudioBlocked(false);
        toast.success("Voice output enabled");
      })
      .catch(() => {
        toast.error("Could not start audio. Try tapping again.");
      });
  }, []);

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);
      // Diagnostic: log all incoming event types for debugging
      console.log("[VoiceEngine] DC event:", msg.type);

      switch (msg.type) {
        case "session.created":
        case "session.updated":
          clearTimeout_();
          setState("connected");
          setMode("listening");
          reconnectAttemptsRef.current = 0; // Reset on successful session
          if (navigator.vibrate) navigator.vibrate(50);
          break;

        case "conversation.item.input_audio_transcription.completed": {
          const text = msg.transcript?.trim();
          if (text) {
            // Filter short noise fragments (greetings, filler, mic artifacts)
            const words = text.split(/\s+/);
            if (words.length < 3 && text.length < 10) break;
            // Repetition filter
            const uniqueWords = new Set(words.map(w => w.toLowerCase()));
            if (uniqueWords.size <= 2 && words.length >= 3) break;
            setTranscripts(prev => [
              ...prev,
              { id: String(++idCounter.current), role: "user", text, timestamp: Date.now() },
            ]);
          }
          break;
        }

        case "response.audio_transcript.delta":
          agentTextRef.current += msg.delta || "";
          break;

        case "response.audio_transcript.done": {
          const text = (msg.transcript || agentTextRef.current).trim();
          agentTextRef.current = "";
          // Get last user transcript for language-mismatch filtering
          const lastUser = [...transcriptsRef.current].reverse().find(t => t.role === "user");
          if (text && !isSelfTalk(text, lastUser?.text, configRef.current.translationMode)) {
            setTranscripts(prev => [
              ...prev,
              { id: String(++idCounter.current), role: "agent", text, timestamp: Date.now() },
            ]);
          }
          break;
        }

        case "response.audio.started":
        case "output_audio_buffer.speech_started":
          setIsSpeaking(true);
          setMode("speaking");
          break;

        case "response.audio.done":
        case "output_audio_buffer.speech_stopped":
        case "response.done":
          setIsSpeaking(false);
          setMode("listening");
          break;

        case "input_audio_buffer.speech_started":
          setMode("listening");
          break;

        case "error":
          console.error("OpenAI Realtime error event:", msg.error);
          break;
      }
    } catch (e) {
      console.warn("Failed to parse data channel message:", e);
    }
  }, []);

  const endSession = useCallback(async () => {
    cleanup();
    setState("idle");
    setMode(null);
    setIsSpeaking(false);
  }, [cleanup]);

  const startSession = useCallback(async () => {
    const cfg = configRef.current;
    setState("connecting");
    setTranscripts([]);
    setMode(null);
    setIsSpeaking(false);
    agentTextRef.current = "";

    const timeout = cfg.connectionTimeoutMs ?? 15_000;
    timeoutRef.current = setTimeout(() => {
      console.warn("Voice engine connection timeout");
      setState("error");
      toast.error("Connection timed out. Please try again.");
      cleanup();
    }, timeout);

    try {
      // 1. Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2. Resolve instructions (support lazy getter to avoid stale closures)
      const resolvedInstructions = typeof cfg.instructions === "function"
        ? cfg.instructions()
        : cfg.instructions;

      // 3. Get ephemeral token from generic edge function
      const { data, error } = await supabase.functions.invoke("voice-engine-token", {
        body: {
          instructions: resolvedInstructions,
          voice: cfg.voice ?? "alloy",
          model: cfg.model ?? "gpt-4o-realtime-preview-2024-12-17",
          vadThreshold: cfg.vadThreshold ?? 0.4,
          silenceDurationMs: cfg.silenceDurationMs ?? 300,
          prefixPaddingMs: cfg.prefixPaddingMs ?? 200,
          temperature: cfg.temperature ?? 0.8,
        },
      });

      if (error || !data?.client_secret) {
        throw new Error(error?.message || "No ephemeral token received");
      }

      // 3. Create RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 4. Audio output — remote track plays automatically
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioEl.setAttribute("playsinline", "true");
      audioEl.style.display = "none";
      document.body.appendChild(audioEl);
      audioElRef.current = audioEl;
      pc.ontrack = async (e) => {
        audioEl.srcObject = e.streams[0];
        try {
          await audioEl.play();
          setOutputAudioBlocked(false);
          console.log("[VoiceEngine] Remote audio playback started");
        } catch (err) {
          console.error("[VoiceEngine] Remote audio play failed:", err);
          setOutputAudioBlocked(true);
          toast.error("Browser blocked voice playback", {
            id: "voice-output-blocked",
            description: "Tap Enable sound to hear the assistant.",
            duration: 20000,
            action: {
              label: "Enable sound",
              onClick: () => {
                audioEl.play()
                  .then(() => {
                    setOutputAudioBlocked(false);
                    toast.success("Voice output enabled");
                  })
                  .catch(() => toast.error("Still blocked — try again."));
              },
            },
          });
        }
      };

      // 5. Add mic track
      stream.getTracks().forEach(track => pc.addTransceiver(track, { direction: "sendrecv" }));

      // 6. Create data channel for events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = handleDataChannelMessage;
      dc.onopen = () => {
        console.log("Voice engine data channel open");
        const pending = pendingSessionInstructionsRef.current;
        if (pending) {
          try {
            dc.send(JSON.stringify({
              type: "session.update",
              session: { instructions: pending },
            }));
            pendingSessionInstructionsRef.current = null;
            console.log("[VoiceEngine] session.update (flush pending instructions) sent");
          } catch (e) {
            console.warn("[VoiceEngine] session.update on open failed:", e);
          }
        }
      };

      // 7. Create and set local SDP offer
      const model = cfg.model ?? "gpt-4o-realtime-preview-2024-12-17";
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 8. Send SDP to OpenAI Realtime
      const sdpResponse = await fetch(`${OPENAI_REALTIME_URL}?model=${model}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${data.client_secret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!sdpResponse.ok) {
        const errText = await sdpResponse.text();
        console.error("OpenAI SDP error:", sdpResponse.status, errText);
        throw new Error("Failed to establish WebRTC connection");
      }

      // 9. Set remote description
      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      // 10. Session duration cap — auto-end after max duration
      const maxDuration = cfg.maxSessionDurationMs ?? DEFAULT_MAX_SESSION_MS;
      sessionTimerRef.current = setTimeout(() => {
        console.warn(`Voice session reached max duration (${maxDuration / 1000}s), auto-ending`);
        toast.info("Voice session ended — maximum duration reached.");
        endSession();
      }, maxDuration);

      // Connection state monitoring
      // Auto-reconnect once on disconnect, give up on "failed"
      let hasAutoReconnected = false;
      pc.onconnectionstatechange = () => {
        const cs = pc.connectionState;
        if (cs === "failed") {
          clearTimeout_();
          clearSessionTimer();
          setState("error");
          setMode(null);
          setIsSpeaking(false);
          cleanup();
          toast.error("Voice connection lost.");
        } else if (cs === "disconnected" && !hasAutoReconnected) {
          hasAutoReconnected = true;
          console.warn("Voice engine disconnected — attempting auto-reconnect...");
          cleanup();
          // Small delay then retry
          setTimeout(() => {
            startSession();
          }, 1500);
        }
      };

    } catch (err: any) {
      clearTimeout_();
      console.error("Failed to start voice engine:", err);
      setState("error");
      cleanup();
      if (err?.name === "NotAllowedError") {
        toast.error("Microphone access is required.");
      } else {
        toast.error("Could not connect. Try again.");
      }
    }
  }, [cleanup, handleDataChannelMessage, endSession]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
      }
      return next;
    });
  }, []);

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
  }, []);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return {
    state,
    transcripts,
    isSpeaking,
    isMuted,
    mode,
    outputAudioBlocked,
    startSession,
    endSession,
    toggleMute,
    clearTranscripts,
    updateSessionInstructions,
    retryOutputAudio,
  };
}
