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

/** Granular connection phase for UI diagnostics */
export type VoiceConnectionPhase =
  | "requesting_mic"
  | "getting_token"
  | "negotiating_sdp"
  | "waiting_channel"
  | "connected"
  | null;

/** Error classification for smart retry */
export type VoiceErrorKind =
  | "mic_denied"        // user denied mic — no retry
  | "mic_unavailable"   // no mic device — no retry
  | "token_failed"      // edge function failed — retryable
  | "sdp_failed"        // OpenAI SDP exchange failed — retryable
  | "sdp_rejected"      // SDP 4xx — not retryable
  | "channel_timeout"   // DC/PC never opened — retryable once
  | "webrtc_failed"     // ICE/connection failed — retryable
  | "network"           // fetch error — retryable
  | "unknown";          // catch-all

const RETRYABLE_ERRORS: Set<VoiceErrorKind> = new Set([
  "token_failed", "sdp_failed", "channel_timeout", "webrtc_failed", "network",
]);

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
  /** Connection timeout in ms (default: 25000) */
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

// Off-topic / wrong-language guard — blocks agent output in unexpected languages
const UNEXPECTED_LANG_KEYWORDS = /\b(appartement|loyer|disponible|découvrir|équipée|chauffage|commerces|caractéristiques|hésitez|contacter|visite|chambres|cuisine|superficie|precio|habitación|dirección|disponibilidad|alquiler)\b/i;

function isOffTopicOutput(text: string): boolean {
  if (!text || text.length < 30) return false;
  if (UNEXPECTED_LANG_KEYWORDS.test(text)) return true;
  const words = text.split(/\s+/);
  if (words.length > 20) {
    const foreignIndicators = text.match(/[àâéèêëïîôùûüçœæñ¿¡]/g);
    if (foreignIndicators && foreignIndicators.length > 5) return true;
  }
  return false;
}

// Patterns that are ALWAYS filtered (empty/filler noise regardless of mode)
const ALWAYS_FILTER_PATTERNS = [
  /^\.{1,3}$/,
  /^(oh|hmm|uh|um|huh)\.?$/i,
];

// Patterns only filtered in translation mode
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

const SHORT_FILLER_RE = /^[a-zA-Z]{1,12}\.?$/;

function isSelfTalk(text: string, lastUserText?: string, translationMode = false): boolean {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed || trimmed.length < 2) return true;
  if (ALWAYS_FILTER_PATTERNS.some(p => p.test(lower))) return true;
  if (translationMode && TRANSLATION_ONLY_PATTERNS.some(p => p.test(lower))) return true;
  if (translationMode) {
    const words = lower.split(/\s+/);
    if (words.length <= 2 && SHORT_FILLER_RE.test(words[0]) && !FARSI_RE.test(trimmed)) return true;
  }
  if (translationMode && lastUserText) {
    const userIsFarsi = FARSI_RE.test(lastUserText);
    const agentIsFarsi = FARSI_RE.test(trimmed);
    if (userIsFarsi && agentIsFarsi) return true;
    if (!userIsFarsi && !agentIsFarsi) return true;
  }
  if (lastUserText && lastUserText.length > 5) {
    const similarity = textSimilarity(lower, lastUserText.toLowerCase());
    if (similarity > 0.7) return true;
  }
  return false;
}

function textSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/));
  const setB = new Set(b.split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export function useVoiceEngine(config: VoiceEngineConfig) {
  const [state, setState] = useState<VoiceEngineState>("idle");
  const [connectionPhase, setConnectionPhase] = useState<VoiceConnectionPhase>(null);
  const [lastErrorKind, setLastErrorKind] = useState<VoiceErrorKind | null>(null);
  const [lastErrorDetail, setLastErrorDetail] = useState<string | null>(null);
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

  // Conversation context pruning
  const conversationItemIdsRef = useRef<string[]>([]);
  const MAX_CONVERSATION_ITEMS = 12;

  useEffect(() => { transcriptsRef.current = transcripts; }, [transcripts]);

  const clearTimeout_ = () => {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };
  const clearSessionTimer = () => {
    if (sessionTimerRef.current) { clearTimeout(sessionTimerRef.current); sessionTimerRef.current = null; }
  };
  const clearKeepalive = useCallback(() => {
    if (keepaliveRef.current) { clearInterval(keepaliveRef.current); keepaliveRef.current = null; }
  }, []);
  const clearIceGrace = useCallback(() => {
    if (iceGraceRef.current) { clearTimeout(iceGraceRef.current); iceGraceRef.current = null; }
  }, []);

  const cleanup = useCallback(() => {
    intentionalCloseRef.current = true;
    clearTimeout_();
    clearSessionTimer();
    clearKeepalive();
    clearIceGrace();
    if (dcRef.current) { try { dcRef.current.close(); } catch {} dcRef.current = null; }
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioElRef.current) { try { audioElRef.current.pause(); audioElRef.current.remove(); } catch {} audioElRef.current = null; }
    pendingSessionInstructionsRef.current = null;
    setOutputAudioBlocked(false);
  }, [clearKeepalive, clearIceGrace]);

  /** Fail with classified error */
  const failWithError = useCallback((kind: VoiceErrorKind, detail: string) => {
    console.error(`[VoiceEngine] FAIL [${kind}]: ${detail}`);
    clearTimeout_();
    setLastErrorKind(kind);
    setLastErrorDetail(detail);
    setState("error");
    setConnectionPhase(null);
    cleanup();
  }, [cleanup]);

  const updateSessionInstructions = useCallback((instructions: string) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      try {
        dc.send(JSON.stringify({ type: "session.update", session: { instructions } }));
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
    if (!el?.srcObject) { toast.error("No voice stream yet — wait until connected."); return; }
    el.play()
      .then(() => { setOutputAudioBlocked(false); toast.success("Voice output enabled"); })
      .catch(() => { toast.error("Could not start audio. Try tapping again."); });
  }, []);

  const markConnected = useCallback(() => {
    clearTimeout_();
    setState(prev => {
      if (prev === "connected") return prev;
      console.log("[VoiceEngine] ✅ Session marked CONNECTED");
      reconnectAttemptsRef.current = 0;
      setConnectionPhase("connected");
      setLastErrorKind(null);
      setLastErrorDetail(null);
      if (navigator.vibrate) navigator.vibrate(50);
      return "connected";
    });
    setMode(prev => prev ?? "listening");
  }, []);

  const triggerInitialResponse = useCallback(() => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") {
      try {
        dc.send(JSON.stringify({ type: "response.create" }));
        console.log("[VoiceEngine] Triggered initial response.create");
      } catch (e) { console.warn("[VoiceEngine] Failed to trigger initial response:", e); }
    }
  }, []);

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);
      console.log("[VoiceEngine] DC event:", msg.type);

      switch (msg.type) {
        case "session.created":
        case "session.updated":
          markConnected();
          if (msg.type === "session.created") {
            conversationItemIdsRef.current = [];
            setTimeout(() => triggerInitialResponse(), 300);
          }
          break;

        case "conversation.item.created": {
          const itemId = msg.item?.id;
          if (itemId) {
            conversationItemIdsRef.current.push(itemId);
            console.log(`[VoiceEngine] Conversation items: ${conversationItemIdsRef.current.length}`);
          }
          break;
        }

        case "conversation.item.input_audio_transcription.completed": {
          const text = msg.transcript?.trim();
          if (text) {
            const words = text.split(/\s+/);
            if (words.length < 3 && text.length < 10) break;
            const uniqueWords = new Set(words.map((w: string) => w.toLowerCase()));
            if (uniqueWords.size <= 2 && words.length >= 3) break;
            const FOREIGN_SCRIPT = /[\u3000-\u9FFF\uAC00-\uD7AF\u1100-\u11FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0D7F\u0E00-\u0E7F\u1000-\u109F]/;
            if (FOREIGN_SCRIPT.test(text)) break;
            const HAS_TARGET_LANG = /[\u0600-\u06FF\u0750-\u077Fa-zA-Z]/;
            if (!HAS_TARGET_LANG.test(text)) break;
            const MEDIA_NOISE = /\b(MBC|KBS|SBS|CNN|BBC|channel|subtitle|broadcast|breaking news)\b/i;
            if (MEDIA_NOISE.test(text)) break;
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
          if (isOffTopicOutput(text)) break;
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
          setIsSpeaking(true); setMode("speaking"); break;

        case "response.audio.done":
        case "output_audio_buffer.speech_stopped":
          setIsSpeaking(false); setMode("listening"); break;

        case "response.done": {
          setIsSpeaking(false); setMode("listening");
          const items = conversationItemIdsRef.current;
          const PRUNE_BUFFER = MAX_CONVERSATION_ITEMS + 4;
          if (items.length > PRUNE_BUFFER) {
            setTimeout(() => {
              const dc = dcRef.current;
              const currentItems = conversationItemIdsRef.current;
              if (dc && dc.readyState === "open" && currentItems.length > MAX_CONVERSATION_ITEMS) {
                const toDelete = currentItems.splice(0, currentItems.length - MAX_CONVERSATION_ITEMS);
                for (const itemId of toDelete) {
                  try { dc.send(JSON.stringify({ type: "conversation.item.delete", item_id: itemId })); } catch {}
                }
                console.log(`[VoiceEngine] Pruned ${toDelete.length} old items`);
              }
            }, 2000);
          }
          break;
        }

        case "input_audio_buffer.speech_started":
          setMode("listening"); break;

        case "error":
          console.error("OpenAI Realtime error event:", msg.error); break;
      }
    } catch (e) { console.warn("Failed to parse data channel message:", e); }
  }, [markConnected, triggerInitialResponse]);

  const endSession = useCallback(async () => {
    reconnectAttemptsRef.current = 0;
    cleanup();
    setState("idle");
    setConnectionPhase(null);
    setMode(null);
    setIsSpeaking(false);
  }, [cleanup]);

  /** Internal reconnect — only for retryable errors */
  const attemptReconnect = useCallback((startFn: () => Promise<void>) => {
    const attempt = reconnectAttemptsRef.current;
    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[VoiceEngine] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
      failWithError("webrtc_failed", "Connection lost after multiple reconnect attempts");
      return;
    }
    reconnectAttemptsRef.current = attempt + 1;
    const delay = 1500 * Math.pow(2, attempt);
    console.warn(`[VoiceEngine] Reconnect attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
    cleanup();
    setState("connecting");
    setConnectionPhase("getting_token");
    setTimeout(() => startFn(), delay);
  }, [cleanup, failWithError]);

  const startSession = useCallback(async () => {
    const cfg = configRef.current;
    intentionalCloseRef.current = false;
    setState("connecting");
    setConnectionPhase("requesting_mic");
    setLastErrorKind(null);
    setLastErrorDetail(null);
    setTranscripts([]);
    setMode(null);
    setIsSpeaking(false);
    agentTextRef.current = "";
    conversationItemIdsRef.current = [];

    try {
      // Phase 1: Microphone
      console.log("[VoiceEngine] Phase: requesting_mic");
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (micErr: any) {
        if (micErr?.name === "NotAllowedError") {
          failWithError("mic_denied", "Microphone permission denied by user");
          toast.error("Microphone access is required for voice.");
        } else {
          failWithError("mic_unavailable", micErr?.message || "No microphone available");
          toast.error("Microphone not available.");
        }
        return;
      }
      streamRef.current = stream;

      // Phase 2: Token
      setConnectionPhase("getting_token");
      console.log("[VoiceEngine] Phase: getting_token");
      const resolvedInstructions = typeof cfg.instructions === "function" ? cfg.instructions() : cfg.instructions;

      let tokenData: any;
      try {
        const { data, error } = await supabase.functions.invoke("voice-engine-token", {
          body: {
            instructions: resolvedInstructions,
            voice: cfg.voice ?? "alloy",
            model: cfg.model ?? "gpt-4o-mini-realtime-preview-2025-06-03",
            vadThreshold: cfg.vadThreshold ?? 0.4,
            silenceDurationMs: cfg.silenceDurationMs ?? 300,
            prefixPaddingMs: cfg.prefixPaddingMs ?? 200,
            temperature: cfg.temperature ?? 0.8,
          },
        });
        if (error || data?.fallback || !data?.client_secret) {
          throw new Error(data?.error || error?.message || "No ephemeral token received");
        }
        tokenData = data;
      } catch (tokenErr: any) {
        const isNetwork = tokenErr?.message?.includes("fetch") || tokenErr?.message?.includes("network") || tokenErr?.message?.includes("Failed to fetch");
        failWithError(isNetwork ? "network" : "token_failed", tokenErr?.message || "Token acquisition failed");
        toast.error("Voice token error — retrying...");
        return;
      }
      console.log("[VoiceEngine] ✅ Token acquired");

      // Phase 3: WebRTC setup + SDP negotiation
      setConnectionPhase("negotiating_sdp");
      console.log("[VoiceEngine] Phase: negotiating_sdp");

      const pc = createRealtimePeerConnection();
      pcRef.current = pc;

      // Audio output
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
                  .then(() => { setOutputAudioBlocked(false); toast.success("Voice output enabled"); })
                  .catch(() => toast.error("Still blocked — try again."));
              },
            },
          });
        }
      };

      // Add mic track
      stream.getTracks().forEach(track => pc.addTransceiver(track, { direction: "sendrecv" }));

      // Data channel
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = handleDataChannelMessage;
      dc.onopen = () => {
        console.log("[VoiceEngine] ✅ Data channel OPEN");
        markConnected();

        const pending = pendingSessionInstructionsRef.current;
        if (pending) {
          try {
            dc.send(JSON.stringify({ type: "session.update", session: { instructions: pending } }));
            pendingSessionInstructionsRef.current = null;
          } catch {}
        }

        clearKeepalive();
        keepaliveRef.current = setInterval(() => {
          try {
            if (dc.readyState === "open") {
              dc.send(JSON.stringify({ type: "session.update", session: {} }));
            } else {
              attemptReconnect(startSession);
            }
          } catch {
            attemptReconnect(startSession);
          }
        }, 30_000);
      };

      dc.onclose = () => {
        if (intentionalCloseRef.current) return;
        console.warn("[VoiceEngine] Data channel closed unexpectedly");
        attemptReconnect(startSession);
      };
      dc.onerror = (ev) => {
        if (intentionalCloseRef.current) return;
        console.error("[VoiceEngine] Data channel error:", ev);
        attemptReconnect(startSession);
      };

      // SDP exchange — wait for ICE gathering to complete before sending
      const model = cfg.model ?? "gpt-4o-mini-realtime-preview-2025-06-03";
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log("[VoiceEngine] Waiting for ICE gathering to complete...");
      let fullDescription: RTCSessionDescription;
      try {
        fullDescription = await waitForIceGatheringComplete(pc);
        const candidateCount = countCandidates(fullDescription.sdp);
        console.log(`[VoiceEngine] ✅ ICE gathering complete — ${candidateCount} candidate(s)`);
      } catch (iceErr: any) {
        failWithError("webrtc_failed", iceErr?.message || "ICE gathering failed — no candidates");
        toast.error("Network issue — could not establish voice connection.");
        return;
      }

      let sdpResponse: Response;
      try {
        sdpResponse = await fetch(`${OPENAI_REALTIME_URL}?model=${model}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenData.client_secret}`,
            "Content-Type": "application/sdp",
          },
          body: fullDescription.sdp,
        });
      } catch (fetchErr: any) {
        failWithError("network", `SDP fetch failed: ${fetchErr?.message || "Network error"}`);
        toast.error("Network error connecting to voice service.");
        return;
      }

      if (!sdpResponse.ok) {
        const errText = await sdpResponse.text().catch(() => "");
        console.error("[VoiceEngine] SDP error:", sdpResponse.status, errText);
        const is4xx = sdpResponse.status >= 400 && sdpResponse.status < 500;
        failWithError(
          is4xx ? "sdp_rejected" : "sdp_failed",
          `SDP ${sdpResponse.status}: ${errText.slice(0, 200)}`
        );
        toast.error(is4xx
          ? "Voice session rejected. Try again later."
          : "Voice service temporarily unavailable."
        );
        return;
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      console.log("[VoiceEngine] ✅ SDP exchanged, remote description set");

      // Phase 4: Wait for channel/connection
      setConnectionPhase("waiting_channel");
      console.log("[VoiceEngine] Phase: waiting_channel");

      // Channel open timeout — if DC doesn't open within 15s after SDP, fail
      const channelTimeout = cfg.connectionTimeoutMs ?? 25_000;
      timeoutRef.current = setTimeout(() => {
        if (dcRef.current?.readyState !== "open" && pcRef.current?.connectionState !== "connected") {
          const pcState = pcRef.current?.connectionState || "unknown";
          const iceState = pcRef.current?.iceConnectionState || "unknown";
          const dcState = dcRef.current?.readyState || "unknown";
          failWithError(
            "channel_timeout",
            `Token OK, SDP OK, but channel never opened. PC=${pcState}, ICE=${iceState}, DC=${dcState}`
          );
          toast.error("Voice channel could not be established.");
        }
      }, channelTimeout);

      // Session duration cap
      const maxDuration = cfg.maxSessionDurationMs ?? DEFAULT_MAX_SESSION_MS;
      sessionTimerRef.current = setTimeout(() => {
        console.warn(`Voice session reached max duration (${maxDuration / 1000}s)`);
        toast.info("Voice session ended — maximum duration reached.");
        endSession();
      }, maxDuration);

      // Connection state monitoring
      pc.onconnectionstatechange = () => {
        if (intentionalCloseRef.current) return;
        const cs = pc.connectionState;
        console.log("[VoiceEngine] Connection state:", cs);
        if (cs === "failed") {
          attemptReconnect(startSession);
        } else if (cs === "disconnected") {
          clearIceGrace();
          iceGraceRef.current = setTimeout(() => {
            if (pcRef.current?.connectionState === "disconnected") {
              attemptReconnect(startSession);
            }
          }, 5000);
        } else if (cs === "connected") {
          clearIceGrace();
          markConnected();
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (intentionalCloseRef.current) return;
        const ics = pc.iceConnectionState;
        console.log("[VoiceEngine] ICE state:", ics);
        if (ics === "failed") {
          attemptReconnect(startSession);
        } else if (ics === "disconnected") {
          clearIceGrace();
          iceGraceRef.current = setTimeout(() => {
            if (pcRef.current?.iceConnectionState === "disconnected") {
              attemptReconnect(startSession);
            }
          }, 5000);
        }
      };

    } catch (err: any) {
      failWithError("unknown", err?.message || "Unexpected error");
      toast.error("Could not connect. Try again.");
    }
  }, [cleanup, handleDataChannelMessage, endSession, attemptReconnect, clearKeepalive, clearIceGrace, markConnected, failWithError]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (streamRef.current) { streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; }); }
      return next;
    });
  }, []);

  const clearTranscripts = useCallback(() => { setTranscripts([]); }, []);

  // Network change detection
  useEffect(() => {
    const handleOnline = () => {
      if (pcRef.current && !intentionalCloseRef.current) {
        const cs = pcRef.current.connectionState;
        if (cs === "disconnected" || cs === "failed") {
          attemptReconnect(startSession);
        }
      }
    };
    window.addEventListener("online", handleOnline);
    return () => { window.removeEventListener("online", handleOnline); cleanup(); };
  }, [cleanup, attemptReconnect, startSession]);

  return {
    state,
    connectionPhase,
    lastErrorKind,
    lastErrorDetail,
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
