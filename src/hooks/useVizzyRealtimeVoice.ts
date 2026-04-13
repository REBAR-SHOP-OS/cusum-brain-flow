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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
  const idCounter = useRef(0);

  // Track partial agent transcript for streaming display
  const agentPartialRef = useRef("");
  const agentPartialIdRef = useRef<string | null>(null);

  // Guard against duplicate response.create while model is already responding
  const modelRespondingRef = useRef(false);
  // Track whether session.created has been received
  const sessionReadyRef = useRef(false);

  const cleanup = useCallback(() => {
    activeRef.current = false;
    sessionReadyRef.current = false;
    modelRespondingRef.current = false;
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
  }, [triggerResponseCreate]);

  const startSession = useCallback(async () => {
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

    try {
      // 0. Prime audio element NOW (within user gesture) to unlock mobile playback
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

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

      if (!tokenResp.ok) {
        const errText = await tokenResp.text();
        throw new Error(`Token request failed (${tokenResp.status}): ${errText}`);
      }

      const tokenData = await tokenResp.json();
      if (tokenData.error || tokenData.fallback) {
        throw new Error(tokenData.error || "Realtime session unavailable");
      }

      const ephemeralKey = tokenData.client_secret;
      if (!ephemeralKey) throw new Error("No ephemeral key received");

      // 2. Create WebRTC peer connection
      const pc = createRealtimePeerConnection();
      pcRef.current = pc;

      // 3. Assign remote audio to the already-primed element
      pc.ontrack = (ev) => {
        console.log("[RealtimeVoice] Got remote audio track");
        if (audioElRef.current) {
          audioElRef.current.srcObject = ev.streams[0];
          audioElRef.current.play().catch(err => {
            console.warn("[RealtimeVoice] Audio autoplay blocked:", err);
            setOutputAudioBlocked(true);
          });
        }
      };

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        console.log("[RealtimeVoice] PC connection state:", pc.connectionState);
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          if (activeRef.current) {
            console.error("[RealtimeVoice] Connection lost");
            setErrorDetail("Connection lost — try reconnecting");
            setState("error");
          }
        }
      };

      // 4. Capture mic and add to peer connection
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = micStream;
      micStream.getTracks().forEach(track => pc.addTrack(track, micStream));

      // 5. Create data channel for events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.addEventListener("open", () => {
        console.log("[RealtimeVoice] Data channel OPEN — session ready for events");
      });

      dc.addEventListener("close", () => {
        console.log("[RealtimeVoice] Data channel closed");
      });

      dc.addEventListener("error", (e) => {
        console.error("[RealtimeVoice] Data channel error:", e);
      });

      dc.addEventListener("message", (ev) => {
        try {
          const event = JSON.parse(ev.data);
          handleRealtimeEvent(event);
        } catch (e) {
          console.warn("[RealtimeVoice] Failed to parse data channel message:", e);
        }
      });

      // 6. Create offer, wait for ICE, then send SDP to OpenAI
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const localDesc = await waitForIceGatheringComplete(pc, 10000);

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

      if (!sdpResp.ok) {
        const errText = await sdpResp.text();
        throw new Error(`OpenAI SDP exchange failed (${sdpResp.status}): ${errText}`);
      }

      const answerSdp = await sdpResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      // NOTE: We do NOT setState("connected") here.
      // Instead we wait for "session.created" event on the data channel.
      console.log("[RealtimeVoice] SDP exchange complete — waiting for session.created");
    } catch (err) {
      console.error("[RealtimeVoice] Connection failed:", err);
      cleanup();
      setState("error");
      setErrorDetail(err instanceof Error ? err.message : String(err));
    }
  }, [getSystemPrompt, cleanup, handleRealtimeEvent]);

  const endSession = useCallback(() => {
    cleanup();
    setIsSpeaking(false);
    setOutputAudioBlocked(false);
    setPartialText("");
    agentPartialRef.current = "";
    setState("idle");
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
