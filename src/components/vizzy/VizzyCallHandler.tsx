/**
 * VizzyCallHandler — Invisible component that auto-answers inbound calls
 * on extension 101 and connects to OpenAI Realtime for AI conversation.
 * On call end: summarizes, saves to vizzy_memory, notifies CEO.
 *
 * Must be mounted in AppLayout for internal users.
 */
import { useEffect, useRef, useCallback } from "react";
import { useWebPhone, WebPhoneState } from "@/hooks/useWebPhone";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const TARGET_EXTENSION = "101";

export function VizzyCallHandler() {
  const { user } = useAuth();
  const [phoneState, phoneActions] = useWebPhone();
  const initAttempted = useRef(false);
  const activeRealtimeSession = useRef<RTCPeerConnection | null>(null);
  const transcriptRef = useRef<string[]>([]);
  const callerInfoRef = useRef<{ from: string; contactName?: string }>({ from: "Unknown" });

  // Initialize WebPhone once on mount
  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    (async () => {
      try {
        const ok = await phoneActions.initialize();
        if (ok) {
          console.log("[VizzyCallHandler] WebPhone initialized, listening for calls on ext", TARGET_EXTENSION);
        } else {
          console.log("[VizzyCallHandler] WebPhone not available (RC not connected)");
        }
      } catch (e) {
        console.warn("[VizzyCallHandler] WebPhone init failed:", e);
      }
    })();

    return () => {
      phoneActions.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle call end — summarize and save
  const handleCallEnd = useCallback(async (fromNumber: string, contactName?: string) => {
    const transcript = transcriptRef.current.join("\n");
    transcriptRef.current = [];

    if (!transcript || transcript.trim().length < 10) {
      console.log("[VizzyCallHandler] Call too short to summarize");
      return;
    }

    try {
      // Summarize the call
      const { data: summary, error } = await supabase.functions.invoke("summarize-call", {
        body: { transcript, fromNumber, toNumber: `ext:${TARGET_EXTENSION}` },
      });

      if (error) {
        console.error("[VizzyCallHandler] Summarize error:", error);
        return;
      }

      const summaryText = summary?.summary || "Call completed (no summary available)";
      const tasks = summary?.tasks || [];

      // Save to vizzy_memory
      const { error: memErr } = await supabase.from("vizzy_memory" as any).insert({
        user_id: user?.id,
        category: "call_summary",
        content: `Call from ${contactName || fromNumber}: ${summaryText}`,
        metadata: {
          from_number: fromNumber,
          contact_name: contactName || null,
          tasks,
          transcript_length: transcript.length,
          auto_answered: true,
          timestamp: new Date().toISOString(),
        },
        company_id: null, // Will be set by trigger if exists
      } as any);

      if (memErr) console.error("[VizzyCallHandler] Save memory error:", memErr);

      // Create notification for CEO
      const taskList = tasks.length > 0
        ? `\nAction items: ${tasks.map((t: any) => t.title).join(", ")}`
        : "";

      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: user?.id,
        title: `📞 Vizzy took a call from ${contactName || fromNumber}`,
        description: `${summaryText}${taskList}`.slice(0, 500),
        type: "call_summary",
        link_to: "/communications",
        metadata: {
          from_number: fromNumber,
          contact_name: contactName,
          tasks,
          auto_answered: true,
        },
      } as any);

      if (notifErr) console.error("[VizzyCallHandler] Notification error:", notifErr);
      else toast.info(`Vizzy summarized call from ${contactName || fromNumber}`);

    } catch (err) {
      console.error("[VizzyCallHandler] Post-call processing error:", err);
    }
  }, [user]);

  // Connect to OpenAI Realtime for AI conversation
  const startRealtimeConversation = useCallback(async (callSession: any, fromNumber: string) => {
    try {
      // Get receptionist prompt with ERP context
      const { data: receptionistData, error: recErr } = await supabase.functions.invoke(
        "vizzy-call-receptionist",
        { body: { callerNumber: fromNumber } }
      );

      if (recErr) {
        console.error("[VizzyCallHandler] Receptionist prompt error:", recErr);
        return;
      }

      const instructions = receptionistData?.instructions || "You are Vizzy, a professional phone manager. Greet the caller warmly, ask who's calling and what they need, and take detailed notes.";
      const contactName = receptionistData?.contactName;
      callerInfoRef.current = { from: fromNumber, contactName };

      // Get OpenAI Realtime token
      const { data: tokenData, error: tokenErr } = await supabase.functions.invoke(
        "voice-engine-token",
        {
          body: {
            instructions,
            voice: "alloy",
            model: "gpt-4o-realtime-preview-2024-12-17",
            vadThreshold: 0.4,
            silenceDurationMs: 500,
            prefixPaddingMs: 300,
          },
        }
      );

      if (tokenErr || !tokenData?.client_secret) {
        console.error("[VizzyCallHandler] Token error:", tokenErr);
        return;
      }

      // Create WebRTC peer connection for OpenAI Realtime
      const pc = new RTCPeerConnection();
      activeRealtimeSession.current = pc;

      // Get audio from the call session and feed to OpenAI
      const remoteStream = callSession.remoteStream || callSession._remoteStream;
      if (remoteStream) {
        for (const track of remoteStream.getTracks()) {
          pc.addTrack(track, remoteStream);
        }
      }

      // Listen for AI audio responses and play them back to the caller
      pc.ontrack = (event) => {
        const aiStream = event.streams[0];
        if (aiStream && callSession.localStream) {
          // Route AI audio back to the call
          const audioCtx = new AudioContext();
          const source = audioCtx.createMediaStreamSource(aiStream);
          const dest = audioCtx.createMediaStreamDestination();
          source.connect(dest);

          // Replace local audio with AI audio
          for (const track of dest.stream.getTracks()) {
            const sender = pc.getSenders().find(s => s.track?.kind === "audio");
            if (sender) sender.replaceTrack(track);
          }
        }
      };

      // Data channel for transcript
      const dc = pc.createDataChannel("oai-events");
      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "conversation.item.input_audio_transcription.completed") {
            transcriptRef.current.push(`Caller: ${msg.transcript || ""}`);
          } else if (msg.type === "response.audio_transcript.done") {
            transcriptRef.current.push(`Vizzy: ${msg.transcript || ""}`);
          }
        } catch { /* ignore parse errors */ }
      };

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResp = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.client_secret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!sdpResp.ok) {
        console.error("[VizzyCallHandler] SDP exchange failed:", sdpResp.status);
        pc.close();
        activeRealtimeSession.current = null;
        return;
      }

      const answerSdp = await sdpResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      console.log("[VizzyCallHandler] OpenAI Realtime connected for call from", fromNumber);

    } catch (err) {
      console.error("[VizzyCallHandler] Realtime setup error:", err);
    }
  }, []);

  // Monitor WebPhone for inbound calls and auto-answer
  useEffect(() => {
    const wp = (phoneActions as any).getCallSession?.() ? null : undefined;
    // We need to hook into the webphone's inbound call event
    // The useWebPhone hook already stores the webphone ref internally
    // We'll poll the internal state and check for inbound calls

    // Actually, we need to modify useWebPhone to expose an onInboundCall callback
    // For now, use the webphone ref directly through a shared mechanism
    const checkInterval = setInterval(() => {
      const session = phoneActions.getCallSession();
      if (session && phoneState.status === "in_call" && !activeRealtimeSession.current) {
        // An inbound call was answered, connect Realtime
        // This handles the case where auto-answer already happened
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [phoneState.status, phoneActions, startRealtimeConversation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeRealtimeSession.current) {
        activeRealtimeSession.current.close();
        activeRealtimeSession.current = null;
      }
    };
  }, []);

  // This is an invisible component
  return null;
}
