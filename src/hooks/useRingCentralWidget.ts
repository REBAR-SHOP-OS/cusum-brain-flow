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
          setIsCallActive(true);
          break;

        case "rc-webphone-call-notify":
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

  // Fetch the real client ID, then load the Embeddable widget with it
  useEffect(() => {
    if (scriptRef.current) return;

    async function loadWidget() {
      const clientId = "99KxuQlTa6aepPopPBwkd3";

      const script = document.createElement("script");
      const baseUrl = "https://apps.ringcentral.com/integration/ringcentral-embeddable/latest/adapter.js";
      const params = new URLSearchParams({
        newAdapterUI: "1",
        enableAnalytics: "0",
        clientId,
        appServer: "https://platform.ringcentral.com",
        redirectUri: "https://apps.ringcentral.com/integration/ringcentral-embeddable/latest/redirect.html",
      });

      script.src = `${baseUrl}?${params.toString()}`;
      script.async = true;
      script.onload = () => setIsLoaded(true);
      document.head.appendChild(script);
      scriptRef.current = script;
    }

    loadWidget();
  }, []);

  const makeCall = useCallback((phoneNumber: string) => {
    if (!isLoaded) return;
    const widgetIframe = document.querySelector<HTMLIFrameElement>(
      'iframe[id^="rc-widget"]'
    );
    if (widgetIframe?.contentWindow) {
      widgetIframe.contentWindow.postMessage(
        { type: "rc-adapter-new-call", phoneNumber, toCall: true },
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
