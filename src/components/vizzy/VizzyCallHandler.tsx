/**
 * VizzyCallHandler — Invisible component that auto-answers inbound calls
 * and connects to OpenAI Realtime for AI conversation.
 *
 * Extension 101 → Personal assistant mode (gatekeeper for Sattar)
 * All other extensions → Sales agent mode (product knowledge, RFQ capture)
 *
 * On call end: summarizes, saves to vizzy_memory, notifies CEO,
 * creates RFQ approval notifications and callback tasks.
 */
import { useEffect, useRef, useCallback } from "react";
import { useWebPhone } from "@/hooks/useWebPhone";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

const CEO_EXTENSION = "101";

export function VizzyCallHandler() {
  const { user } = useAuth();
  const [phoneState, phoneActions] = useWebPhone();
  const initAttempted = useRef(false);
  const activeRealtimeSession = useRef<RTCPeerConnection | null>(null);
  const transcriptRef = useRef<string[]>([]);
  const callerInfoRef = useRef<{
    from: string;
    contactName?: string;
    targetExtension?: string;
    callMode?: "personal_assistant" | "sales_agent";
  }>({ from: "Unknown" });

  // Initialize WebPhone once on mount
  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    (async () => {
      try {
        const ok = await phoneActions.initialize();
        if (ok) {
          console.log("[VizzyCallHandler] WebPhone initialized, listening for calls on ALL extensions");
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

  // Handle call end — summarize, save, and create RFQ/callback actions
  const handleCallEnd = useCallback(async () => {
    const transcript = transcriptRef.current.join("\n");
    transcriptRef.current = [];

    const { from: fromNumber, contactName, callMode, targetExtension } = callerInfoRef.current;

    if (!transcript || transcript.trim().length < 10) {
      console.log("[VizzyCallHandler] Call too short to summarize");
      return;
    }

    try {
      // Summarize the call with mode info
      const { data: summary, error } = await supabase.functions.invoke("summarize-call", {
        body: {
          transcript,
          fromNumber,
          toNumber: `ext:${targetExtension || "unknown"}`,
          callMode: callMode || "unknown",
        },
      });

      if (error) {
        console.error("[VizzyCallHandler] Summarize error:", error);
        return;
      }

      const summaryText = summary?.summary || "Call completed (no summary available)";
      const tasks = summary?.tasks || [];
      const rfqDetails = summary?.rfq_details || null;
      const callbackRequested = summary?.callback_requested || null;
      const leadInfo = summary?.lead_info || null;

      // Save to vizzy_memory
      const { error: memErr } = await supabase.from("vizzy_memory" as any).insert({
        user_id: user?.id,
        category: "call_summary",
        content: `Call from ${contactName || fromNumber} (${callMode || "unknown"} mode): ${summaryText}`,
        metadata: {
          from_number: fromNumber,
          contact_name: contactName || null,
          call_mode: callMode,
          target_extension: targetExtension,
          tasks,
          rfq_details: rfqDetails,
          callback_requested: callbackRequested,
          lead_info: leadInfo,
          transcript_length: transcript.length,
          auto_answered: true,
          timestamp: new Date().toISOString(),
        },
        company_id: null,
      } as any);

      if (memErr) console.error("[VizzyCallHandler] Save memory error:", memErr);

      // Build notification description
      const modeLabel = callMode === "sales_agent" ? "🛒 Sales" : "📞 Personal";
      const taskList = tasks.length > 0
        ? `\nAction items: ${tasks.map((t: any) => t.title).join(", ")}`
        : "";
      const rfqNote = rfqDetails
        ? `\n💰 RFQ Captured: ${rfqDetails.bar_sizes?.join(", ") || "details in metadata"} — ${rfqDetails.project_type || "project"}`
        : "";
      const callbackNote = callbackRequested
        ? `\n🔄 Callback requested for: ${callbackRequested}`
        : "";

      // Create main notification for CEO
      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: user?.id,
        title: `${modeLabel} Vizzy took a call from ${contactName || fromNumber}`,
        description: `${summaryText}${taskList}${rfqNote}${callbackNote}`.slice(0, 500),
        type: "call_summary",
        link_to: "/communications",
        metadata: {
          from_number: fromNumber,
          contact_name: contactName,
          call_mode: callMode,
          tasks,
          rfq_details: rfqDetails,
          callback_requested: callbackRequested,
          lead_info: leadInfo,
          auto_answered: true,
        },
      } as any);

      if (notifErr) console.error("[VizzyCallHandler] Notification error:", notifErr);
      else toast.info(`Vizzy summarized call from ${contactName || fromNumber}`);

      // If RFQ captured in sales mode, create approval notification
      if (rfqDetails && callMode === "sales_agent") {
        const rfqDesc = [
          leadInfo?.name ? `From: ${leadInfo.name}` : null,
          leadInfo?.company ? `Company: ${leadInfo.company}` : null,
          rfqDetails.bar_sizes?.length ? `Sizes: ${rfqDetails.bar_sizes.join(", ")}` : null,
          rfqDetails.quantities ? `Qty: ${rfqDetails.quantities}` : null,
          rfqDetails.timeline ? `Timeline: ${rfqDetails.timeline}` : null,
        ].filter(Boolean).join(" | ");

        await supabase.from("notifications").insert({
          user_id: user?.id,
          title: `💰 Approve RFQ from ${contactName || leadInfo?.name || fromNumber}`,
          description: `Vizzy captured an RFQ during a sales call. ${rfqDesc}`.slice(0, 500),
          type: "rfq_approval",
          link_to: "/leads",
          metadata: {
            action_required: "approve_rfq",
            rfq_details: rfqDetails,
            lead_info: leadInfo,
            from_number: fromNumber,
            contact_name: contactName,
          },
        } as any);
      }

      // If callback requested, create a task for the team member
      if (callbackRequested) {
        await supabase.from("notifications").insert({
          user_id: user?.id,
          title: `🔄 ${callbackRequested}: Call back ${contactName || fromNumber}`,
          description: `Caller asked to speak with ${callbackRequested}. Reason: ${summaryText}`.slice(0, 500),
          type: "callback_request",
          link_to: "/communications",
          metadata: {
            callback_for: callbackRequested,
            from_number: fromNumber,
            contact_name: contactName,
            reason: summaryText,
          },
        } as any);
      }

    } catch (err) {
      console.error("[VizzyCallHandler] Post-call processing error:", err);
    }
  }, [user]);

  // Connect to OpenAI Realtime for AI conversation
  const startRealtimeConversation = useCallback(async (
    callSession: any,
    fromNumber: string,
    targetExtension: string
  ) => {
    try {
      // Get prompt based on extension (personal assistant vs sales agent)
      const { data: receptionistData, error: recErr } = await supabase.functions.invoke(
        "vizzy-call-receptionist",
        { body: { callerNumber: fromNumber, targetExtension } }
      );

      if (recErr) {
        console.error("[VizzyCallHandler] Receptionist prompt error:", recErr);
        return;
      }

      const instructions = receptionistData?.instructions || "You are Vizzy, a professional phone manager.";
      const contactName = receptionistData?.contactName;
      const callMode = receptionistData?.mode || (targetExtension === CEO_EXTENSION ? "personal_assistant" : "sales_agent");

      callerInfoRef.current = { from: fromNumber, contactName, targetExtension, callMode };

      console.log(`[VizzyCallHandler] Mode: ${callMode} for ext ${targetExtension}, caller: ${fromNumber}`);

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
          const audioCtx = new AudioContext();
          const source = audioCtx.createMediaStreamSource(aiStream);
          const dest = audioCtx.createMediaStreamDestination();
          source.connect(dest);

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

      const sdpResp = await fetch("https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17", {
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

      console.log(`[VizzyCallHandler] OpenAI Realtime connected (${callMode}) for call from`, fromNumber);

    } catch (err) {
      console.error("[VizzyCallHandler] Realtime setup error:", err);
    }
  }, []);

  // Monitor WebPhone for inbound calls on ANY extension and auto-answer
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const session = phoneActions.getCallSession();
      if (session && phoneState.status === "in_call" && !activeRealtimeSession.current) {
        // Detect which extension was called
        const calledExt = (session as any).toExtension
          || (session as any)._toExtension
          || (session as any).request?.to?.uri?.user
          || "unknown";
        const from = (session as any).remoteIdentity?.uri?.user
          || (session as any)._remoteIdentity?.uri?.user
          || callerInfoRef.current.from
          || "Unknown";

        console.log(`[VizzyCallHandler] Inbound call on ext ${calledExt} from ${from}`);
        startRealtimeConversation(session, from, String(calledExt));
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

  return null;
}
