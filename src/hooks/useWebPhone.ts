import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WebPhoneState {
  status: "idle" | "registering" | "ready" | "calling" | "in_call" | "error";
  callerId: string;
  callerIds: string[];
  error: string | null;
}

export interface WebPhoneActions {
  initialize: () => Promise<boolean>;
  call: (phoneNumber: string, contactName?: string) => Promise<boolean>;
  hangup: () => void;
  dispose: () => void;
}

export function useWebPhone(): [WebPhoneState, WebPhoneActions] {
  const [state, setState] = useState<WebPhoneState>({
    status: "idle",
    callerId: "",
    callerIds: [],
    error: null,
  });

  const webPhoneRef = useRef<any>(null);
  const callSessionRef = useRef<any>(null);

  const initialize = useCallback(async (): Promise<boolean> => {
    try {
      setState((s) => ({ ...s, status: "registering", error: null }));

      // Get SIP info from edge function
      const { data, error } = await supabase.functions.invoke("ringcentral-sip-provision");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { sipInfo, callerIds } = data;
      if (!sipInfo) throw new Error("No SIP info received");

      // Dynamically import to avoid SSR issues
      const { default: WebPhone } = await import("ringcentral-web-phone");

      const webPhone = new WebPhone({ sipInfo });
      await webPhone.start();

      webPhoneRef.current = webPhone;

      // Listen for inbound calls (optional, but good to handle)
      webPhone.on("inboundCall", (session: any) => {
        console.log("Inbound WebRTC call:", session);
        // For now, auto-answer inbound calls
        // session.answer();
      });

      setState({
        status: "ready",
        callerId: callerIds?.[0] || "",
        callerIds: callerIds || [],
        error: null,
      });

      console.log("WebPhone registered successfully");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "WebPhone init failed";
      console.error("WebPhone init error:", err);
      setState((s) => ({ ...s, status: "error", error: msg }));
      return false;
    }
  }, []);

  const call = useCallback(async (phoneNumber: string, contactName?: string): Promise<boolean> => {
    const wp = webPhoneRef.current;
    if (!wp) {
      toast.error("WebPhone not initialized");
      return false;
    }

    try {
      setState((s) => ({ ...s, status: "calling" }));

      // Detect internal extension dialing (ext:101 format or short 3-digit numbers)
      const isExtension = phoneNumber.startsWith("ext:");
      const extensionNumber = isExtension ? phoneNumber.slice(4) : null;

      let callSession;
      if (isExtension && extensionNumber) {
        // Dial internal extension directly
        console.log("Dialing internal extension:", extensionNumber);
        callSession = await wp.call(extensionNumber);
      } else {
        // Clean phone number - remove non-digits except leading +
        const cleaned = phoneNumber.replace(/[^\d+]/g, "");
        const callee = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
        callSession = await wp.call(callee, state.callerId.replace("+", ""));
      }
      callSessionRef.current = callSession;

      // Listen for call events
      callSession.on("disposed", () => {
        callSessionRef.current = null;
        setState((s) => ({ ...s, status: "ready" }));
        toast.info(`Call with ${contactName || phoneNumber} ended`);
      });

      setState((s) => ({ ...s, status: "in_call" }));
      toast.success(`Calling ${contactName || phoneNumber}...`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Call failed";
      console.error("WebPhone call error:", err);
      setState((s) => ({ ...s, status: "ready", error: msg }));
      toast.error(`Call failed: ${msg}`);
      return false;
    }
  }, [state.callerId]);

  const hangup = useCallback(() => {
    const session = callSessionRef.current;
    if (session) {
      try {
        session.dispose();
      } catch (e) {
        console.warn("Hangup error:", e);
      }
      callSessionRef.current = null;
      setState((s) => ({ ...s, status: "ready" }));
    }
  }, []);

  const dispose = useCallback(() => {
    hangup();
    const wp = webPhoneRef.current;
    if (wp) {
      try {
        wp.dispose();
      } catch (e) {
        console.warn("WebPhone dispose error:", e);
      }
      webPhoneRef.current = null;
    }
    setState({ status: "idle", callerId: "", callerIds: [], error: null });
  }, [hangup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const wp = webPhoneRef.current;
      if (wp) {
        try { wp.dispose(); } catch {}
        webPhoneRef.current = null;
      }
    };
  }, []);

  return [state, { initialize, call, hangup, dispose }];
}
