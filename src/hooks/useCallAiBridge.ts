import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CallAiBridgeState {
  active: boolean;
  status: "idle" | "connecting" | "active" | "error";
  transcript: Array<{ role: "ai" | "caller"; text: string }>;
}

export interface CallBridgeData {
  agentName: string;
  contactName: string;
  reason: string;
  phone: string;
  details?: string;
}

/**
 * Bridges a live RingCentral WebRTC call with an ElevenLabs Conversational AI agent.
 *
 * Flow:
 *   Remote caller audio  →  capture via AudioContext (16kHz)  →  PCM16 base64  →  ElevenLabs WS
 *   ElevenLabs AI audio  ←  decode PCM16  ←  upsample to 48kHz  ←  inject into call via replaceTrack
 */
export function useCallAiBridge() {
  const [state, setState] = useState<CallAiBridgeState>({
    active: false,
    status: "idle",
    transcript: [],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const aiDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const originalTrackRef = useRef<MediaStreamTrack | null>(null);
  const ttsPlayingRef = useRef(false);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const bridgeActiveRef = useRef(false);
  const startAudioRef = useRef<(() => void) | null>(null);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startBridge = useCallback(
    async (
      callSession: {
        rtcPeerConnection: RTCPeerConnection;
        audioElement?: HTMLAudioElement;
      },
      callData?: CallBridgeData
    ) => {
      // Guard against duplicate startBridge calls
      if (bridgeActiveRef.current) {
        console.warn("AI bridge: already active, ignoring duplicate start");
        return;
      }
      bridgeActiveRef.current = true;

      try {
        setState((s) => ({ ...s, status: "connecting", transcript: [] }));

        // 1. Get signed URL from edge function
        const { data, error } = await supabase.functions.invoke(
          "elevenlabs-conversation-token",
          { body: { mode: callData ? "phone_call" : "voice_chat" } }
        );
        if (error || !data?.signed_url) {
          throw new Error(data?.error || "Failed to get AI voice token");
        }

        const pc = callSession.rtcPeerConnection;

        // 2. Get REMOTE audio from peer connection receivers
        const audioReceiver = pc.getReceivers().find(
          (r) => r.track?.kind === "audio"
        );
        if (!audioReceiver?.track) {
          throw new Error("No remote audio track found on peer connection");
        }
        const remoteStream = new MediaStream([audioReceiver.track]);

        // 3. Create 16kHz AudioContext for CAPTURING caller audio → ElevenLabs
        const captureCtx = new AudioContext({ sampleRate: 16000 });
        captureCtxRef.current = captureCtx;

        // 4. Create 48kHz AudioContext for AI OUTPUT → WebRTC (standard rate)
        const outputCtx = new AudioContext({ sampleRate: 48000 });
        outputCtxRef.current = outputCtx;

        // 5. Capture remote audio at 16kHz for ElevenLabs
        const source = captureCtx.createMediaStreamSource(remoteStream);
        const processor = captureCtx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;

        const silentGain = captureCtx.createGain();
        silentGain.gain.value = 0;
        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(captureCtx.destination);

        // 6. AI audio output destination at 48kHz → will replace call's outgoing track
        const aiDest = outputCtx.createMediaStreamDestination();
        aiDestRef.current = aiDest;

        // 7. Build conversation overrides for phone call mode
        const overrides = callData ? buildPhoneCallOverrides(callData) : undefined;

        // 8. Connect to ElevenLabs WebSocket
        const ws = new WebSocket(data.signed_url);
        wsRef.current = ws;

        // Define the audio start function — called ONLY after server confirms overrides
        const beginAudioCapture = () => {
          startAudioRef.current = null;
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
          }

          processor.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            if (ttsPlayingRef.current) return;
            const samples = e.inputBuffer.getChannelData(0);
            const pcm16 = float32ToPcm16(samples);
            const b64 = arrayBufferToBase64(pcm16.buffer as ArrayBuffer);
            ws.send(JSON.stringify({ user_audio_chunk: b64 }));
          };

          replaceOutgoingTrack(pc, aiDest.stream);

          if (callSession.audioElement) {
            callSession.audioElement.volume = 0;
            audioElementRef.current = callSession.audioElement;
            console.log("AI bridge: muted RC audio element");
          } else {
            console.warn("AI bridge: no audioElement found on callSession");
          }

          setState((s) => ({ ...s, active: true, status: "active" }));
          toast.success("AI is now talking on the call");
        };

        // Store in ref so handleWsMessage can trigger it
        startAudioRef.current = beginAudioCapture;

        ws.onopen = () => {
          console.log("AI call bridge: WS connected");

          // Send overrides immediately but do NOT start audio yet
          if (overrides) {
            ws.send(
              JSON.stringify({
                type: "conversation_initiation_client_data",
                conversation_config_override: overrides,
              })
            );
            console.log("AI bridge: sent phone call overrides", overrides);
          }

          // Safety timeout: if metadata never arrives, start after 1.5s
          safetyTimeoutRef.current = setTimeout(() => {
            console.warn("AI bridge: metadata timeout, starting audio anyway");
            if (startAudioRef.current) {
              startAudioRef.current();
            }
          }, 1500);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            handleWsMessage(msg, outputCtx, aiDest, ws, setState, ttsPlayingRef, activeSourcesRef, startAudioRef);
          } catch (e) {
            console.warn("AI bridge: bad WS message", e);
          }
        };

        ws.onerror = (e) => {
          console.error("AI bridge WS error:", e);
          setState((s) => ({ ...s, status: "error" }));
        };

        ws.onclose = () => {
          console.log("AI bridge WS closed");
          bridgeActiveRef.current = false;
          restoreOriginalTrack(pc);
          restoreAudioElement(audioElementRef);
          cleanup(captureCtxRef, outputCtxRef, processorRef, wsRef);
          setState({ active: false, status: "idle", transcript: [] });
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI bridge failed";
        console.error("AI bridge error:", err);
        bridgeActiveRef.current = false;
        setState((s) => ({ ...s, status: "error" }));
        toast.error(msg);
      }
    },
    []
  );

  const stopBridge = useCallback(() => {
    bridgeActiveRef.current = false;
    startAudioRef.current = null;
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    restoreAudioElement(audioElementRef);
    cleanup(captureCtxRef, outputCtxRef, processorRef, wsRef);
    setState({ active: false, status: "idle", transcript: [] });
  }, []);

  useEffect(() => {
    return () => {
      cleanup(captureCtxRef, outputCtxRef, processorRef, wsRef);
    };
  }, []);

  return { bridgeState: state, startBridge, stopBridge };
}

// ─── phone call overrides ────────────────────────────────────────────────────

function buildPhoneCallOverrides(callData: CallBridgeData) {
  const { agentName, contactName, reason, phone, details } = callData;

  // Detect if contactName is actually a phone number
  const isPhoneNumber = /^[\d+\-\s()]+$/.test(contactName.trim());
  const displayName = isPhoneNumber ? "the person I'm trying to reach" : contactName;

  const detailsBlock = details
    ? `\n\nSPECIFIC DETAILS YOU KNOW:\n${details}\n\nUse these details naturally in conversation. Reference specific invoice numbers and amounts when discussing payment.`
    : "";

  const noDetailsWarning = !details
    ? `\n\nIMPORTANT: No specific details were provided for this call. You ONLY know the general reason above. Do NOT invent, guess, or fabricate any details such as report content, invoice numbers, amounts, dates, or any other specifics. If asked for details you do not have, say: "I don't have the full details on hand, but someone from Rebar Shop will follow up with the complete information."`
    : "";

  const firstMsg = `Hi, this is ${agentName} calling from Rebar Shop. Am I speaking with ${displayName}? I'm reaching out regarding ${reason.length > 100 ? reason.substring(0, 100) + "..." : reason}.`;

  return {
    agent: {
      prompt: {
        prompt: `You are ${agentName}, an AI assistant calling on behalf of Rebar Shop. You have placed an outbound phone call to ${displayName} at ${phone}.

PURPOSE OF THIS CALL: ${reason}${detailsBlock}${noDetailsWarning}

CRITICAL INSTRUCTIONS:
- You are calling THEM. They did not call you.
- Your FIRST message must be EXACTLY: "${firstMsg}"
- Do NOT repeat your introduction after they respond. Move directly to the purpose.
- Be professional, friendly, and concise.
- If they ask who you are, explain you are an AI assistant calling from Rebar Shop.
- Stay focused on the purpose of the call.
- If they want to speak to a human, let them know someone from Rebar Shop will follow up.
- Keep responses brief and conversational — this is a phone call, not an email.
- You ONLY know what is explicitly provided in the SPECIFIC DETAILS section above. Do NOT invent, guess, or fabricate ANY information whatsoever.
- If asked for information you do not have, say: "I don't have the full details on hand, but someone from Rebar Shop will follow up with the complete information."
- Do NOT re-introduce yourself or restate the reason after your first message.`,
      },
      first_message: firstMsg,
      language: "en",
    },
  };
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function float32ToPcm16(float32: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function pcm16Base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const pcm16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);
  }
  return float32;
}

function playAiAudioChunk(
  base64Audio: string,
  outputCtx: AudioContext,
  dest: MediaStreamAudioDestinationNode,
  ttsPlayingRef: React.MutableRefObject<boolean>,
  activeSourcesRef: React.MutableRefObject<Set<AudioBufferSourceNode>>
) {
  const float32 = pcm16Base64ToFloat32(base64Audio);
  if (float32.length === 0) return;

  // Mark TTS as playing to mute mic input
  ttsPlayingRef.current = true;

  // Upsample from 16kHz to output sample rate (48kHz) via linear interpolation
  const outputSampleRate = outputCtx.sampleRate;
  const resampledLength = Math.round(float32.length * (outputSampleRate / 16000));
  const audioBuffer = outputCtx.createBuffer(1, resampledLength, outputSampleRate);
  const channelData = audioBuffer.getChannelData(0);
  const ratio = float32.length / resampledLength;

  for (let i = 0; i < resampledLength; i++) {
    const srcIdx = i * ratio;
    const lower = Math.floor(srcIdx);
    const upper = Math.min(lower + 1, float32.length - 1);
    const frac = srcIdx - lower;
    channelData[i] = float32[lower] * (1 - frac) + float32[upper] * frac;
  }

  const onEnded = (src: AudioBufferSourceNode) => {
    activeSourcesRef.current.delete(src);
    if (activeSourcesRef.current.size === 0) {
      // Echo tail guard: wait 1000ms for remote telephony echo to pass before unmuting capture
      setTimeout(() => {
        if (activeSourcesRef.current.size === 0) {
          ttsPlayingRef.current = false;
        }
      }, 1000);
    }
  };

  // Play to remote caller via replaced track
  const bufferSource = outputCtx.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(dest);
  bufferSource.onended = () => onEnded(bufferSource);
  activeSourcesRef.current.add(bufferSource);
  bufferSource.start();

  // Local playback removed — user monitors AI via live transcript UI
}

function replaceOutgoingTrack(
  pc: RTCPeerConnection,
  aiStream: MediaStream
) {
  const senders = pc.getSenders();
  const audioSender = senders.find(
    (s) => s.track?.kind === "audio"
  );
  if (!audioSender) {
    console.warn("AI bridge: no audio sender found on peer connection");
    return;
  }

  const aiTrack = aiStream.getAudioTracks()[0];
  if (aiTrack) {
    audioSender.replaceTrack(aiTrack).catch((e) => {
      console.error("AI bridge: failed to replace track", e);
    });
  }
}

function restoreOriginalTrack(pc: RTCPeerConnection) {
  // The RC SDK manages its own tracks - when bridge closes, call will end or
  // user takes over naturally. No explicit restore needed for now.
}

function restoreAudioElement(
  audioElementRef: React.MutableRefObject<HTMLAudioElement | null>
) {
  if (audioElementRef.current) {
    audioElementRef.current.volume = 1;
    audioElementRef.current = null;
  }
}

function stopAllTtsPlayback(
  activeSourcesRef: React.MutableRefObject<Set<AudioBufferSourceNode>>,
  ttsPlayingRef: React.MutableRefObject<boolean>
) {
  for (const src of activeSourcesRef.current) {
    try { src.stop(); } catch {}
  }
  activeSourcesRef.current.clear();
  ttsPlayingRef.current = false;
}

function handleWsMessage(
  msg: any,
  outputCtx: AudioContext,
  aiDest: MediaStreamAudioDestinationNode,
  ws: WebSocket,
  setState: React.Dispatch<React.SetStateAction<CallAiBridgeState>>,
  ttsPlayingRef: React.MutableRefObject<boolean>,
  activeSourcesRef: React.MutableRefObject<Set<AudioBufferSourceNode>>,
  startAudioRef: React.MutableRefObject<(() => void) | null>
) {
  switch (msg.type) {
    case "audio":
      const audioB64 = msg.audio_event?.audio_base_64;
      if (audioB64) {
        playAiAudioChunk(audioB64, outputCtx, aiDest, ttsPlayingRef, activeSourcesRef);
      }
      break;

    case "agent_response":
      const aiText = msg.agent_response_event?.agent_response;
      if (aiText) {
        setState((s) => ({
          ...s,
          transcript: [...s.transcript, { role: "ai", text: aiText }],
        }));
      }
      break;

    case "user_transcript":
      const callerText = msg.user_transcription_event?.user_transcript;
      if (callerText) {
        // Barge-in: stop TTS playback when caller speaks
        stopAllTtsPlayback(activeSourcesRef, ttsPlayingRef);
        setState((s) => ({
          ...s,
          transcript: [...s.transcript, { role: "caller", text: callerText }],
        }));
      }
      break;

    case "interruption":
      stopAllTtsPlayback(activeSourcesRef, ttsPlayingRef);
      break;

    case "ping":
      ws.send(
        JSON.stringify({
          type: "pong",
          event_id: msg.ping_event?.event_id,
        })
      );
      break;

    case "conversation_initiation_metadata":
      console.log("AI bridge: conversation started, overrides confirmed", msg);
      // Server confirmed overrides — NOW start audio capture
      if (startAudioRef?.current) {
        startAudioRef.current();
      }
      break;

    default:
      break;
  }
}

function cleanup(
  captureCtxRef: React.MutableRefObject<AudioContext | null>,
  outputCtxRef: React.MutableRefObject<AudioContext | null>,
  processorRef: React.MutableRefObject<ScriptProcessorNode | null>,
  wsRef: React.MutableRefObject<WebSocket | null>
) {
  processorRef.current?.disconnect();
  processorRef.current = null;
  captureCtxRef.current?.close().catch(() => {});
  captureCtxRef.current = null;
  outputCtxRef.current?.close().catch(() => {});
  outputCtxRef.current = null;
  const ws = wsRef.current;
  if (ws && ws.readyState <= WebSocket.OPEN) {
    ws.close();
  }
  wsRef.current = null;
}
