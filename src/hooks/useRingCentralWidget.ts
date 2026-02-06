import { useEffect, useRef, useState, useCallback } from "react";

interface ActiveCallInfo {
  telephonySessionId?: string;
  fromNumber?: string;
  toNumber?: string;
  direction?: string;
  startTime?: Date;
}

interface UseRingCentralWidgetReturn {
  isLoaded: boolean;
  isCallActive: boolean;
  activeCall: ActiveCallInfo | null;
  makeCall: (phoneNumber: string) => void;
  minimizeWidget: () => void;
  showWidget: () => void;
}

export function useRingCentralWidget(): UseRingCentralWidgetReturn {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [activeCall, setActiveCall] = useState<ActiveCallInfo | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const onCallEndRef = useRef<((call: ActiveCallInfo | null) => void) | null>(null);

  // Listen for call events from the Embeddable widget
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;

      const { type, telephonySessionId, direction, call } = event.data;

      switch (type) {
        case "rc-login-status-notify":
          // Widget login status changed
          break;

        case "rc-active-call-notify":
          if (call) {
            setIsCallActive(true);
            setActiveCall({
              telephonySessionId: call.telephonySessionId || telephonySessionId,
              fromNumber: call.from?.phoneNumber,
              toNumber: call.to?.phoneNumber,
              direction: call.direction || direction,
              startTime: new Date(),
            });
          }
          break;

        case "rc-call-end-notify":
          setIsCallActive(false);
          if (onCallEndRef.current) {
            onCallEndRef.current(activeCall);
          }
          setActiveCall(null);
          break;

        case "rc-ringout-call-notify":
          // RingOut call started
          setIsCallActive(true);
          break;

        case "rc-webphone-call-notify":
          // WebRTC call event
          if (event.data.call?.telephonyStatus === "Ringing" || event.data.call?.telephonyStatus === "CallConnected") {
            setIsCallActive(true);
            setActiveCall({
              telephonySessionId: event.data.call.telephonySessionId,
              fromNumber: event.data.call.from?.phoneNumber,
              toNumber: event.data.call.to?.phoneNumber,
              direction: event.data.call.direction,
              startTime: new Date(),
            });
          }
          if (event.data.call?.telephonyStatus === "NoCall") {
            setIsCallActive(false);
            if (onCallEndRef.current) {
              onCallEndRef.current(activeCall);
            }
            setActiveCall(null);
          }
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [activeCall]);

  // Load the RingCentral Embeddable adapter script
  useEffect(() => {
    if (scriptRef.current) return;

    const script = document.createElement("script");
    script.src =
      "https://ringcentral.github.io/ringcentral-embeddable/adapter.js?newAdapterUI=1&enableAnalytics=0";
    script.async = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);
    scriptRef.current = script;

    return () => {
      // Don't remove on unmount — the widget persists across navigations
    };
  }, []);

  const makeCall = useCallback((phoneNumber: string) => {
    if (!isLoaded) return;
    // Send a message to the Embeddable widget to initiate a call
    const widgetIframe = document.querySelector<HTMLIFrameElement>(
      'iframe[id^="rc-widget"]'
    );
    if (widgetIframe?.contentWindow) {
      widgetIframe.contentWindow.postMessage(
        {
          type: "rc-adapter-new-call",
          phoneNumber,
          toCall: true,
        },
        "*"
      );
    }
  }, [isLoaded]);

  const minimizeWidget = useCallback(() => {
    const widgetIframe = document.querySelector<HTMLIFrameElement>(
      'iframe[id^="rc-widget"]'
    );
    if (widgetIframe?.contentWindow) {
      widgetIframe.contentWindow.postMessage({ type: "rc-adapter-minimize" }, "*");
    }
  }, []);

  const showWidget = useCallback(() => {
    const widgetIframe = document.querySelector<HTMLIFrameElement>(
      'iframe[id^="rc-widget"]'
    );
    if (widgetIframe?.contentWindow) {
      widgetIframe.contentWindow.postMessage({ type: "rc-adapter-show" }, "*");
    }
  }, []);

  return {
    isLoaded,
    isCallActive,
    activeCall,
    makeCall,
    minimizeWidget,
    showWidget,
  };
}
