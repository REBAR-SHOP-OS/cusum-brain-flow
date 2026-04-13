import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SILENT_WAV } from "@/lib/audioPlayer";
import {
  createRealtimePeerConnection,
  waitForIceGatheringComplete,
} from "@/lib/webrtc/realtimeConnection";

/**
 * Vizzy Realtime Voice — OpenAI Realtime API over WebRTC.
 * Mic → WebRTC → GPT-4o-mini Realtime → WebRTC → Speaker
 * No intermediate text conversion — true voice-to-voice.
 */

export interface VoiceTranscript {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export type RealtimeVoiceState = "idle" | "connecting" | "connected" | "error";

interface UseVizzyRealtimeVoiceOptions {
  getSystemPrompt: () => string;
}

export function useVizzyRealtimeVoice({ getSystemPrompt }: UseVizzyRealtimeVoiceOptions) {
  const [state, setState] = useState<RealtimeVoiceState>("idle");
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [partialText, setPartialText] = useState("");
  const [outputAudioBlocked, setOutputAudioBlocked] = useState(false);
  const [debugStep, setDebugStep] = useState<string>("idle");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
  const idCounter = useRef(0);
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Monotonically increasing attempt ID — guards async continuations against stale attempts */
  const attemptIdRef = useRef(0);

  // Track partial agent transcript for streaming display
  const agentPartialRef = useRef("");
  const agentPartialIdRef = useRef<string | null>(null);

  // Guard against duplicate response.create while model is already responding
  const modelRespondingRef = useRef(false);
  // Track whether session.created has been received
  const sessionReadyRef = useRef(false);

  // Debug step helper
  const setStep = useCallback((step: string) => {
    console.log(`[RealtimeVoice][STEP] ${step}`);
    setDebugStep(step);
  }, []);

  const cleanup = useCallback((reason?: string) => {
    console.log(`[RealtimeVoice] cleanup() called — reason: ${reason || "unknown"}`);
    activeRef.current = false;
    sessionReadyRef.current = false;
    modelRespondingRef.current = false;
    // Clear session timeout
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
      sessionTimeoutRef.current = null;
    }
    if (dcRef.current) {
      try { dcRef.current.close(); } catch { /* ignore */ }
      dcRef.current = null;
    }
    if (pcRef.current) {
      try { pcRef.current.close(); } catch { /* ignore */ }
      pcRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
  }, []);

  /** Safely send a message on the data channel */
  const dcSend = useCallback((payload: object) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") {
      console.warn("[RealtimeVoice] Cannot send — data channel not open");
      return false;
    }
    dc.send(JSON.stringify(payload));
    return true;
  }, []);

  /** Trigger a guarded response.create — skips if model is already responding */
  const triggerResponseCreate = useCallback(() => {
    if (modelRespondingRef.current) {
      console.log("[RealtimeVoice] Skipping response.create — model already responding");
      return;
    }
    dcSend({ type: "response.create", response: { modalities: ["text", "audio"] } });
    console.log("[RealtimeVoice] Sent response.create");
  }, [dcSend]);

  const handleRealtimeEvent = useCallback((event: any) => {
    const type = event.type as string;

    switch (type) {
      // ── Session lifecycle ──
      case "session.created": {
        console.log("[RealtimeVoice] Session created:", event.session?.id);
        sessionReadyRef.current = true;
        setStep("session_created");
        // Clear session timeout since we got session.created
        if (sessionTimeoutRef.current) {
          clearTimeout(sessionTimeoutRef.current);
          sessionTimeoutRef.current = null;
        }
        if (activeRef.current) {
          setState("connected");
        }
        break;
      }
      case "session.updated": {
        console.log("[RealtimeVoice] Session updated (instructions/config refreshed)");
        break;
      }

      // ── User speech ──
      case "conversation.item.input_audio_transcription.completed": {
        const userText = event.transcript?.trim();
        if (userText) {
          const transcript: VoiceTranscript = {
            id: `vt-${++idCounter.current}`,
            role: "user",
            text: userText,
            timestamp: Date.now(),
          };
          setTranscripts(prev => [...prev, transcript]);
        }
        // If server VAD didn't auto-trigger a response, nudge it
        if (!modelRespondingRef.current) {
          console.log("[RealtimeVoice] User transcript done, nudging response.create");
          triggerResponseCreate();
        }
        break;
      }

      // ── Agent audio response lifecycle ──
      case "response.created": {
        modelRespondingRef.current = true;
        break;
      }
      case "response.audio_transcript.delta": {
        const delta = event.delta || "";
        agentPartialRef.current += delta;
        setPartialText(agentPartialRef.current);
        break;
      }
      case "response.audio.delta": {
        setIsSpeaking(true);
        break;
      }
      case "output_audio_buffer.speech_started": {
        setIsSpeaking(true);
        break;
      }
      case "output_audio_buffer.speech_stopped": {
        setIsSpeaking(false);
        break;
      }
      case "response.audio_transcript.done": {
        const fullText = event.transcript?.trim() || agentPartialRef.current.trim();
        if (fullText) {
          const transcript: VoiceTranscript = {
            id: `vt-${++idCounter.current}`,
            role: "agent",
            text: fullText,
            timestamp: Date.now(),
          };
          setTranscripts(prev => [...prev, transcript]);
        }
        agentPartialRef.current = "";
        agentPartialIdRef.current = null;
        setPartialText("");
        break;
      }
      case "response.done": {
        setIsSpeaking(false);
        modelRespondingRef.current = false;
        console.log("[RealtimeVoice] Response done");
        break;
      }

      // ── Input audio buffer events (VAD) ──
      case "input_audio_buffer.speech_started": {
        console.log("[RealtimeVoice] VAD: user speech started");
        break;
      }
      case "input_audio_buffer.speech_stopped": {
        console.log("[RealtimeVoice] VAD: user speech stopped");
        break;
      }
      case "input_audio_buffer.committed": {
        console.log("[RealtimeVoice] VAD: audio buffer committed");
        break;
      }

      // ── Errors ──
      case "error": {
        console.error("[RealtimeVoice] OpenAI error:", event.error);
        setErrorDetail(event.error?.message || "OpenAI realtime error");
        modelRespondingRef.current = false;
        break;
      }

      default: {
        // Log unhandled events for debugging (not noisy ones)
        if (!type.startsWith("response.audio.") && type !== "response.text.delta") {
          console.log("[RealtimeVoice] Event:", type);
        }
        break;
      }
    }
  }, [triggerResponseCreate, setStep]);

  const startSession = useCallback(async () => {
    // Bump attempt ID — any in-flight older attempt will bail at its next checkpoint
    const thisAttempt = ++attemptIdRef.current;
    console.log(`[RealtimeVoice] startSession attempt #${thisAttempt}`);

    // Clean up any previous attempt's resources
    cleanup("new_attempt_starting");

    setState("connecting");
    setErrorDetail(null);
    setOutputAudioBlocked(false);
    activeRef.current = true;
    sessionReadyRef.current = false;
    modelRespondingRef.current = false;
    setTranscripts([]);
    setPartialText("");
    agentPartialRef.current = "";
    agentPartialIdRef.current = null;

    /** Returns true if this attempt has been superseded */
    const isStale = () => attemptIdRef.current !== thisAttempt;

    try {
      // 0. Prime audio element NOW (within user gesture) to unlock mobile playback
      setStep("audio_priming");
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioEl.setAttribute("playsinline", "true");
      audioEl.src = SILENT_WAV;
      try {
        await audioEl.play();
        audioEl.pause();
        audioEl.currentTime = 0;
        audioEl.src = "";
        console.log("[RealtimeVoice] Audio element primed (gesture-unlocked)");
      } catch (primeErr) {
        console.warn("[RealtimeVoice] Audio priming failed:", primeErr);
      }
      audioElRef.current = audioEl;

      // 1. Get ephemeral token from voice-engine-token edge function
      setStep("token_fetch_started");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      if (isStale()) { console.log(`[RealtimeVoice] Attempt #${thisAttempt} stale after auth`); return; }

      const instructions = getSystemPrompt();

      const tokenResp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-engine-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            instructions,
            voice: "sage",
            model: "gpt-4o-mini-realtime-preview-2025-06-03",
          }),
        }
      );

      if (isStale()) { console.log(`[RealtimeVoice] Attempt #${thisAttempt} stale after token fetch`); return; }

      if (!tokenResp.ok) {
        const errText = await tokenResp.text();
        throw new Error(`Token request failed (${tokenResp.status}): ${errText}`);
      }

      const tokenData = await tokenResp.json();
      setStep("token_fetch_ok");
      if (tokenData.error || tokenData.fallback) {
        throw new Error(tokenData.error || "Realtime session unavailable");
      }

      const ephemeralKey = tokenData.client_secret;
      if (!ephemeralKey) throw new Error("No ephemeral key received");

      // 2. Capture mic
      setStep("mic_requesting");
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (isStale()) {
        console.log(`[RealtimeVoice] Attempt #${thisAttempt} stale after mic — releasing tracks`);
        micStream.getTracks().forEach(t => t.stop());
        return;
      }
      micStreamRef.current = micStream;
      setStep("mic_granted");

      // 3. Create WebRTC peer connection
      const pc = createRealtimePeerConnection();
      pcRef.current = pc;
      setStep("pc_created");

      // ── Diagnostic flags ──
      let remoteTrackReceived = false;
      let dataChannelEverOpened = false;

      /** Log all PC/ICE/DC states in one snapshot */
      const logAllStates = (label: string) => {
        console.log(
          `[RealtimeVoice][DIAG] ${label} | signaling=${pc.signalingState} conn=${pc.connectionState} ice=${pc.iceConnectionState} iceGather=${pc.iceGatheringState} dc=${dc?.readyState ?? "N/A"} remoteTrack=${remoteTrackReceived} dcOpened=${dataChannelEverOpened}`
        );
      };

      // 4. Assign remote audio to the already-primed element
      pc.ontrack = (ev) => {
        remoteTrackReceived = true;
        console.log("[RealtimeVoice][DIAG] Remote track received:", ev.track.kind);
        logAllStates("ontrack");
        if (audioElRef.current) {
          audioElRef.current.srcObject = ev.streams[0];
          audioElRef.current.play().catch(err => {
            console.warn("[RealtimeVoice] Audio autoplay blocked:", err);
            setOutputAudioBlocked(true);
          });
        }
      };

      // ── Full state transition logging ──
      pc.onsignalingstatechange = () => {
        console.log("[RealtimeVoice][DIAG] signalingState=" + pc.signalingState);
      };

      pc.onicegatheringstatechange = () => {
        console.log("[RealtimeVoice][DIAG] iceGatheringState=" + pc.iceGatheringState);
      };

      (pc as any).onicecandidateerror = (ev: any) => {
        console.warn("[RealtimeVoice][DIAG] ICE candidate error:", {
          errorCode: ev.errorCode,
          errorText: ev.errorText,
          url: ev.url,
          address: ev.address,
          port: ev.port,
        });
      };

      // Monitor connection state — increased grace, only fatal after DC confirmed never opened
      let disconnectGraceTimer: ReturnType<typeof setTimeout> | null = null;
      const GRACE_PERIOD_MS = 10_000; // 10s grace (was 5s)

      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        console.log("[RealtimeVoice][STEP] pc_connection_state=" + s);
        logAllStates("onconnectionstatechange");

        if (s === "connected") {
          if (disconnectGraceTimer) {
            console.log("[RealtimeVoice] Recovered from disconnected state");
            clearTimeout(disconnectGraceTimer);
            disconnectGraceTimer = null;
          }
        }

        if (s === "disconnected" && activeRef.current) {
          console.warn(`[RealtimeVoice] Disconnected — waiting ${GRACE_PERIOD_MS}ms grace period`);
          disconnectGraceTimer = setTimeout(() => {
            if (pc.connectionState !== "connected" && activeRef.current && !isStale()) {
              logAllStates("disconnected_grace_expired");
              setErrorDetail(
                `WebRTC peer connection lost (conn=${pc.connectionState} ice=${pc.iceConnectionState} dc=${dc?.readyState ?? "N/A"} track=${remoteTrackReceived})`
              );
              setState("error");
            }
          }, GRACE_PERIOD_MS);
        }

        if (s === "failed" && activeRef.current && !isStale()) {
          if (disconnectGraceTimer) { clearTimeout(disconnectGraceTimer); disconnectGraceTimer = null; }

          // If the data channel opened and session is ready, don't immediately fail —
          // the media path may recover. Give it a grace period.
          if (dataChannelEverOpened && sessionReadyRef.current) {
            console.warn("[RealtimeVoice] PC failed but DC was open + session ready — grace period");
            disconnectGraceTimer = setTimeout(() => {
              if (pc.connectionState === "failed" && activeRef.current && !isStale()) {
                logAllStates("failed_grace_expired");
                setErrorDetail(
                  `WebRTC peer connection failed (ice=${pc.iceConnectionState} dc=${dc?.readyState ?? "N/A"} track=${remoteTrackReceived})`
                );
                setState("error");
              }
            }, GRACE_PERIOD_MS);
            return;
          }

          logAllStates("pc_connection_failed");
          console.error("[RealtimeVoice] Connection failed — no DC open, treating as fatal");
          setErrorDetail(
            `WebRTC peer connection failed (signaling=${pc.signalingState} ice=${pc.iceConnectionState} iceGather=${pc.iceGatheringState} dc=${dc?.readyState ?? "N/A"} track=${remoteTrackReceived} dcOpened=${dataChannelEverOpened})`
          );
          setState("error");
        }
      };

      // Monitor ICE connection state
      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        console.log("[RealtimeVoice][STEP] ice_connection_state=" + s);
        logAllStates("oniceconnectionstatechange");
      };

      // Add mic tracks to PC
      micStream.getTracks().forEach(track => pc.addTrack(track, micStream));

      // 5. Create data channel for events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.addEventListener("open", () => {
        dataChannelEverOpened = true;
        console.log("[RealtimeVoice][STEP] data_channel_open — readyState:", dc.readyState);
        logAllStates("data_channel_open");
        setStep("data_channel_open");
        // If session.created doesn't arrive within 8s of channel open,
        // treat the channel as connected anyway (server may skip session.created
        // in newer API versions or certain model configs)
        setTimeout(() => {
          if (isStale()) return;
          if (activeRef.current && !sessionReadyRef.current && dc.readyState === "open") {
            console.warn("[RealtimeVoice] session.created not received 8s after dc open — treating as connected");
            sessionReadyRef.current = true;
            // Clear the outer 20s timeout
            if (sessionTimeoutRef.current) {
              clearTimeout(sessionTimeoutRef.current);
              sessionTimeoutRef.current = null;
            }
            setState("connected");
            setStep("connected_without_session_event");
            // Send session.update to configure and verify channel is usable
            dcSend({
              type: "session.update",
              session: {
                instructions: getSystemPrompt(),
                modalities: ["text", "audio"],
                voice: "sage",
                input_audio_transcription: { model: "whisper-1" },
                turn_detection: { type: "server_vad", threshold: 0.5, silence_duration_ms: 800 },
              },
            });
          }
        }, 8000);
      });

      dc.addEventListener("close", () => {
        console.log("[RealtimeVoice] Data channel closed");
        logAllStates("data_channel_close");
      });

      dc.addEventListener("error", (e) => {
        console.error("[RealtimeVoice] Data channel error:", e);
        logAllStates("data_channel_error");
      });

      dc.addEventListener("message", (ev) => {
        try {
          const event = JSON.parse(ev.data);
          const msgType = event.type || "unknown";
          console.log("[RealtimeVoice][DC_MSG] type=" + msgType);
          handleRealtimeEvent(event);
        } catch (e) {
          console.warn("[RealtimeVoice] Failed to parse data channel message:", ev.data?.substring?.(0, 200), e);
        }
      });

      // 6. Create offer, wait for ICE, then send SDP to OpenAI
      setStep("sdp_offer_creating");
      const offer = await pc.createOffer();
      if (isStale()) { console.log(`[RealtimeVoice] Attempt #${thisAttempt} stale after createOffer`); return; }

      await pc.setLocalDescription(offer);
      setStep("ice_gathering");

      const localDesc = await waitForIceGatheringComplete(pc, 15000);
      if (isStale()) { console.log(`[RealtimeVoice] Attempt #${thisAttempt} stale after ICE gathering`); return; }
      setStep("sdp_post_started");

      const sdpResp = await fetch(
        `https://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2025-06-03`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
          body: localDesc.sdp,
        }
      );

      if (isStale()) { console.log(`[RealtimeVoice] Attempt #${thisAttempt} stale after SDP POST`); return; }

      if (!sdpResp.ok) {
        const errText = await sdpResp.text();
        throw new Error(`OpenAI SDP exchange failed (${sdpResp.status}): ${errText}`);
      }

      setStep("sdp_post_ok");
      const answerSdp = await sdpResp.text();

      // Guard: check PC is still usable before setRemoteDescription
      const sigState = pc.signalingState;
      const connState = pc.connectionState;
      console.log(`[RealtimeVoice] Pre-setRemoteDescription: signalingState=${sigState} connectionState=${connState} attempt=#${thisAttempt} current=#${attemptIdRef.current}`);
      if (isStale()) {
        console.log(`[RealtimeVoice] Attempt #${thisAttempt} stale before setRemoteDescription — aborting`);
        return;
      }
      if (sigState === "closed") {
        console.error(`[RealtimeVoice] PC signalingState=closed before setRemoteDescription — aborting`);
        throw new Error("Peer connection was closed before answer could be applied");
      }

      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      setStep("remote_desc_applied");

      if (isStale()) { console.log(`[RealtimeVoice] Attempt #${thisAttempt} stale after setRemoteDescription`); return; }

      // NOTE: We do NOT setState("connected") here.
      // Instead we wait for "session.created" event on the data channel.
      const dcStateNow = dc.readyState;
      const pcStateNow = pc.connectionState;
      const iceStateNow = pc.iceConnectionState;
      console.log(`[RealtimeVoice] SDP exchange complete — dc=${dcStateNow} pc=${pcStateNow} ice=${iceStateNow} — waiting for session.created`);
      setStep("waiting_session_created");

      // Overall connection timeout — if session.created never arrives
      sessionTimeoutRef.current = setTimeout(() => {
        if (activeRef.current && !sessionReadyRef.current && !isStale()) {
          const dcState = dcRef.current?.readyState || "no_dc";
          const pcState = pcRef.current?.connectionState || "no_pc";
          const iceState = pcRef.current?.iceConnectionState || "no_ice";
          console.error(`[RealtimeVoice] 20s timeout — dc=${dcState} pc=${pcState} ice=${iceState}`);
          cleanup("session_timeout");
          setErrorDetail(`Session handshake timed out (dc=${dcState}, pc=${pcState}, ice=${iceState})`);
          setState("error");
        }
      }, 20000);
    } catch (err) {
      if (isStale()) {
        console.log(`[RealtimeVoice] Attempt #${thisAttempt} error after being superseded — ignoring`);
        return;
      }
      const step = debugStep;
      console.error("[RealtimeVoice] Connection failed at step:", step, err);
      cleanup("catch_error");
      setState("error");
      const msg = err instanceof Error ? err.message : String(err);
      setErrorDetail(`${msg} (failed at step: ${step})`);
    }
  }, [getSystemPrompt, cleanup, handleRealtimeEvent, setStep, debugStep, dcSend]);

  const endSession = useCallback(() => {
    // Bump attempt ID to invalidate any in-flight startSession
    attemptIdRef.current++;
    cleanup("endSession_called");
    setIsSpeaking(false);
    setOutputAudioBlocked(false);
    setPartialText("");
    agentPartialRef.current = "";
    setState("idle");
    setDebugStep("idle");
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    const stream = micStreamRef.current;
    if (!stream) return;

    if (isMuted) {
      stream.getTracks().forEach(t => { t.enabled = true; });
      setIsMuted(false);
    } else {
      stream.getTracks().forEach(t => { t.enabled = false; });
      setIsMuted(true);
    }
  }, [isMuted]);

  const updateSessionInstructions = useCallback((instructions: string) => {
    dcSend({
      type: "session.update",
      session: { instructions },
    });
    console.log("[RealtimeVoice] Pushed session.update with new instructions");
  }, [dcSend]);

  const sendFollowUp = useCallback(async (internalPrompt: string): Promise<string> => {
    // Send a conversation item with the internal prompt
    dcSend({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: internalPrompt }],
      },
    });

    // Trigger a response
    triggerResponseCreate();

    console.log("[RealtimeVoice] Sent follow-up via data channel");
    return ""; // Response comes asynchronously via data channel events
  }, [dcSend, triggerResponseCreate]);

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
    debugStep,
    connectionPhase: state === "connecting" ? "getting_token" as const : state === "connected" ? "connected" as const : null,
    lastErrorKind: state === "error" ? "network" as const : null,
    lastErrorDetail: errorDetail,
    outputAudioBlocked,
    retryOutputAudio: () => {
      setOutputAudioBlocked(false);
      if (audioElRef.current) {
        audioElRef.current.play().catch(() => {});
      }
    },
  };
}
