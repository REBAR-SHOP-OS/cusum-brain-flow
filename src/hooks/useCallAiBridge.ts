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
 *   Remote caller audio  →  capture via AudioContext  →  PCM16 base64  →  ElevenLabs WS
 *   ElevenLabs AI audio  ←  decode PCM16  ←  inject into call via replaceTrack
 */
export function useCallAiBridge() {
  const [state, setState] = useState<CallAiBridgeState>({
    active: false,
    status: "idle",
    transcript: [],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const aiDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const originalTrackRef = useRef<MediaStreamTrack | null>(null);

  const startBridge = useCallback(
    async (
      callSession: {
        rtcPeerConnection: RTCPeerConnection;
        audioElement?: HTMLAudioElement;
      },
      callData?: CallBridgeData
    ) => {
      try {
        setState((s) => ({ ...s, status: "connecting", transcript: [] }));

        // 1. Get signed URL from edge function (phone_call mode for outbound calls)
        const { data, error } = await supabase.functions.invoke(
          "elevenlabs-conversation-token",
          { body: { mode: callData ? "phone_call" : "voice_chat" } }
        );
        if (error || !data?.signed_url) {
          throw new Error(data?.error || "Failed to get AI voice token");
        }

        const pc = callSession.rtcPeerConnection;

        // 2. Get REMOTE audio from peer connection receivers (not mediaStream which is local mic)
        const audioReceiver = pc.getReceivers().find(
          (r) => r.track?.kind === "audio"
        );
        if (!audioReceiver?.track) {
          throw new Error("No remote audio track found on peer connection");
        }
        const remoteStream = new MediaStream([audioReceiver.track]);

        // 3. Create AudioContext at 16 kHz to match ElevenLabs expected input
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;

        // 4. Capture remote audio
        const source = audioCtx.createMediaStreamSource(remoteStream);
        const processor = audioCtx.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;

        // Silent gain so processor fires without audible output (RC SDK handles playback via audioElement)
        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;
        source.connect(processor);
        processor.connect(silentGain);
        silentGain.connect(audioCtx.destination);

        // 5. AI audio output destination → will replace call's outgoing track
        const aiDest = audioCtx.createMediaStreamDestination();
        aiDestRef.current = aiDest;

        // 6. Build conversation overrides for phone call mode
        const overrides = callData ? buildPhoneCallOverrides(callData) : undefined;

        // 7. Connect to ElevenLabs WebSocket
        const ws = new WebSocket(data.signed_url);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("AI call bridge: WS connected");

          // Send conversation_initiation_client_data with overrides BEFORE audio
          if (overrides) {
            ws.send(
              JSON.stringify({
                type: "conversation_initiation_client_data",
                conversation_config_override: overrides,
              })
            );
            console.log("AI bridge: sent phone call overrides", overrides);
          }

          // Wait briefly for override to register, then start audio
          setTimeout(() => {
            // Start sending remote audio to ElevenLabs
            processor.onaudioprocess = (e) => {
              if (ws.readyState !== WebSocket.OPEN) return;
              const samples = e.inputBuffer.getChannelData(0);
              const pcm16 = float32ToPcm16(samples);
              const b64 = arrayBufferToBase64(pcm16.buffer as ArrayBuffer);
              ws.send(JSON.stringify({ user_audio_chunk: b64 }));
            };

            // Replace the call's outgoing audio (local mic) with AI voice
            replaceOutgoingTrack(pc, aiDest.stream);

            setState((s) => ({ ...s, active: true, status: "active" }));
            toast.success("AI is now talking on the call");
          }, 300);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            handleWsMessage(msg, audioCtx, aiDest, ws, setState);
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
          restoreOriginalTrack(pc);
          cleanup(audioCtxRef, processorRef, wsRef);
          setState({ active: false, status: "idle", transcript: [] });
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI bridge failed";
        console.error("AI bridge error:", err);
        setState((s) => ({ ...s, status: "error" }));
        toast.error(msg);
      }
    },
    []
  );

  const stopBridge = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    cleanup(audioCtxRef, processorRef, wsRef);
    setState({ active: false, status: "idle", transcript: [] });
  }, []);

  useEffect(() => {
    return () => {
      cleanup(audioCtxRef, processorRef, wsRef);
    };
  }, []);

  return { bridgeState: state, startBridge, stopBridge };
}

// ─── phone call overrides ────────────────────────────────────────────────────

function buildPhoneCallOverrides(callData: CallBridgeData) {
  const { agentName, contactName, reason, phone, details } = callData;

  const detailsBlock = details
    ? `\n\nSPECIFIC DETAILS YOU KNOW:\n${details}\n\nUse these details naturally in conversation. Reference specific invoice numbers and amounts when discussing payment.`
    : "";

  const firstMsg = `Hi, this is ${agentName} calling from Rebar Shop. Am I speaking with ${contactName}? I'm reaching out regarding ${reason.length > 100 ? reason.substring(0, 100) + "..." : reason}.`;

  return {
    agent: {
      prompt: {
        prompt: `You are ${agentName}, an AI assistant calling on behalf of Rebar Shop. You have placed an outbound phone call to ${contactName} at ${phone}.

PURPOSE OF THIS CALL: ${reason}${detailsBlock}

CRITICAL INSTRUCTIONS:
- You are calling THEM. They did not call you.
- Your FIRST message must be EXACTLY: "${firstMsg}"
- Do NOT repeat your introduction after they respond. Move directly to the purpose.
- Be professional, friendly, and concise.
- If they ask who you are, explain you are an AI assistant calling from Rebar Shop.
- Stay focused on the purpose of the call.
- If they want to speak to a human, let them know someone from Rebar Shop will follow up.
- Keep responses brief and conversational — this is a phone call, not an email.
- NEVER say you don't have access to invoice details — use the specific details provided above.
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
  audioCtx: AudioContext,
  dest: MediaStreamAudioDestinationNode
) {
  const float32 = pcm16Base64ToFloat32(base64Audio);
  if (float32.length === 0) return;

  const audioBuffer = audioCtx.createBuffer(1, float32.length, 16000);
  audioBuffer.getChannelData(0).set(float32);

  // Play to remote caller via replaced track
  const bufferSource = audioCtx.createBufferSource();
  bufferSource.buffer = audioBuffer;
  bufferSource.connect(dest);
  bufferSource.start();

  // Also play locally so the user can monitor the AI voice
  const localSource = audioCtx.createBufferSource();
  localSource.buffer = audioBuffer;
  localSource.connect(audioCtx.destination);
  localSource.start();
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

function handleWsMessage(
  msg: any,
  audioCtx: AudioContext,
  aiDest: MediaStreamAudioDestinationNode,
  ws: WebSocket,
  setState: React.Dispatch<React.SetStateAction<CallAiBridgeState>>
) {
  switch (msg.type) {
    case "audio":
      const audioB64 = msg.audio_event?.audio_base_64;
      if (audioB64) {
        playAiAudioChunk(audioB64, audioCtx, aiDest);
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
        setState((s) => ({
          ...s,
          transcript: [...s.transcript, { role: "caller", text: callerText }],
        }));
      }
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
      console.log("AI bridge: conversation started", msg);
      break;

    default:
      break;
  }
}

function cleanup(
  audioCtxRef: React.MutableRefObject<AudioContext | null>,
  processorRef: React.MutableRefObject<ScriptProcessorNode | null>,
  wsRef: React.MutableRefObject<WebSocket | null>
) {
  processorRef.current?.disconnect();
  processorRef.current = null;
  audioCtxRef.current?.close().catch(() => {});
  audioCtxRef.current = null;
  const ws = wsRef.current;
  if (ws && ws.readyState <= WebSocket.OPEN) {
    ws.close();
  }
  wsRef.current = null;
}
