import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InterpreterTranscript {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
}

export type InterpreterState = "idle" | "connecting" | "connected" | "error";

const CONNECTION_TIMEOUT_MS = 15_000;
const OPENAI_REALTIME_URL = "https://api.openai.com/v1/realtime";

export function useAzinVoiceInterpreter() {
  const [state, setState] = useState<InterpreterState>("idle");
  const [transcripts, setTranscripts] = useState<InterpreterTranscript[]>([]);
  const [mode, setMode] = useState<"speaking" | "listening" | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const idCounter = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const agentTextRef = useRef("");

  const clearTimeout_ = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const cleanup = useCallback(() => {
    clearTimeout_();
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
  }, []);

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "session.created":
        case "session.updated":
          clearTimeout_();
          setState("connected");
          setMode("listening");
          if (navigator.vibrate) navigator.vibrate(50);
          break;

        case "conversation.item.input_audio_transcription.completed": {
          const text = msg.transcript?.trim();
          if (text) {
            setTranscripts(prev => [
              ...prev,
              { id: String(++idCounter.current), role: "user", text, timestamp: Date.now() },
            ]);
          }
          break;
        }

        case "response.audio_transcript.delta": {
          agentTextRef.current += msg.delta || "";
          break;
        }

        case "response.audio_transcript.done": {
          const text = (msg.transcript || agentTextRef.current).trim();
          agentTextRef.current = "";
          if (text) {
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

  const startSession = useCallback(async () => {
    setState("connecting");
    setTranscripts([]);
    setMode(null);
    setIsSpeaking(false);
    agentTextRef.current = "";

    timeoutRef.current = setTimeout(() => {
      console.warn("AZIN interpreter connection timeout");
      setState("error");
      toast.error("Connection timed out. Please try again.");
      cleanup();
    }, CONNECTION_TIMEOUT_MS);

    try {
      // 1. Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2. Get ephemeral token
      const { data, error } = await supabase.functions.invoke("elevenlabs-azin-token");
      if (error || !data?.client_secret) {
        throw new Error(error?.message || "No ephemeral token received");
      }

      // 3. Create RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 4. Set up audio output — remote track plays automatically
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      // 5. Add mic track
      stream.getTracks().forEach(track => pc.addTransceiver(track, { direction: "sendrecv" }));

      // 6. Create data channel for events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = handleDataChannelMessage;
      dc.onopen = () => {
        console.log("AZIN data channel open");
      };

      // 7. Create and set local SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 8. Send SDP to OpenAI Realtime
      const sdpResponse = await fetch(`${OPENAI_REALTIME_URL}?model=gpt-4o-mini-realtime-preview`, {
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

      // Connection state monitoring
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          clearTimeout_();
          setState("idle");
          setMode(null);
          setIsSpeaking(false);
          cleanup();
        }
      };

    } catch (err: any) {
      clearTimeout_();
      console.error("Failed to start AZIN interpreter:", err);
      setState("error");
      cleanup();
      if (err?.name === "NotAllowedError") {
        toast.error("Microphone access is required.");
      } else {
        toast.error("Could not connect. Try again.");
      }
    }
  }, [cleanup, handleDataChannelMessage]);

  const endSession = useCallback(async () => {
    cleanup();
    setState("idle");
    setMode(null);
    setIsSpeaking(false);
  }, [cleanup]);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return {
    state,
    transcripts,
    isSpeaking,
    mode,
    startSession,
    endSession,
  };
}
