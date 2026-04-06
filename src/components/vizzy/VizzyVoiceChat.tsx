import { useEffect, useRef, useState, useCallback } from "react";
import { X, Mic, MicOff, Loader2, Copy, Check } from "lucide-react";
import { useVizzyVoiceEngine } from "@/hooks/useVizzyVoiceEngine";
import type { VizzyVoiceTranscript } from "@/hooks/useVizzyVoiceEngine";
import { cn } from "@/lib/utils";
import vizzyAvatar from "@/assets/vizzy-avatar.png";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Renders LOVABLE COMMAND blocks with a copy button */
function LovableCommandRenderer({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const cleanText = text.replace(/\[VIZZY-ACTION\][\s\S]*?\[\/VIZZY-ACTION\]/g, "").trim();
  const cmdMatch = cleanText.match(/(LOVABLE COMMAND:[\s\S]*?DO NOT TOUCH:[^\n]*)/);

  if (!cmdMatch) return <>{cleanText}</>;

  const before = cleanText.slice(0, cleanText.indexOf(cmdMatch[0])).trim();
  const command = cmdMatch[1].trim();
  const after = cleanText.slice(cleanText.indexOf(cmdMatch[0]) + cmdMatch[0].length).trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    toast.success("Lovable command copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {before && <p className="mb-2">{before}</p>}
      <div
        className="relative my-2 p-3 rounded-lg text-xs font-mono whitespace-pre-wrap"
        style={{
          background: "hsl(172 66% 50% / 0.08)",
          border: "1px solid hsl(172 66% 50% / 0.25)",
        }}
      >
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md transition-colors"
          style={{
            background: copied ? "hsl(152 69% 40%)" : "hsl(0 0% 100% / 0.1)",
            color: copied ? "white" : "hsl(172 66% 65%)",
          }}
          aria-label="Copy Lovable command"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
        {command}
      </div>
      {after && <p className="mt-2">{after}</p>}
    </>
  );
}

interface VizzyVoiceChatProps {
  onClose: () => void;
}

export function VizzyVoiceChat({ onClose }: VizzyVoiceChatProps) {
  const {
    state: voiceState,
    transcripts,
    isSpeaking,
    isMuted,
    mode,
    startSession,
    endSession,
    toggleMute,
    contextLoading,
    outputAudioBlocked,
    retryOutputAudio,
  } = useVizzyVoiceEngine();

  const bottomRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const autoRetryCountRef = useRef(0);
  const autoRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_AUTO_RETRIES = 2;

  // Auto-start
  useEffect(() => {
    startSession();
    return () => {
      endSession();
      if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll + parse VIZZY-ACTION tags from transcripts
  const processedActionsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

    // Parse ALL VIZZY-ACTION tags from agent transcripts and batch-execute
    const pendingActions: { actionData: any; transcriptId: string }[] = [];

    for (const t of transcripts) {
      if (t.role !== "agent" || processedActionsRef.current.has(t.id)) continue;
      
      // Find ALL action tags in this transcript (supports multiple per message)
      const actionRegex = /\[VIZZY-ACTION\]([\s\S]*?)\[\/VIZZY-ACTION\]/g;
      let match;
      let foundAny = false;
      while ((match = actionRegex.exec(t.text)) !== null) {
        foundAny = true;
        try {
          const actionData = JSON.parse(match[1]);
          pendingActions.push({ actionData, transcriptId: t.id });
        } catch (e) {
          console.warn("Failed to parse VIZZY-ACTION from voice transcript:", e);
        }
      }
      if (foundAny) processedActionsRef.current.add(t.id);
    }

    if (pendingActions.length === 0) return;

    // Execute all actions and show summary toast
    (async () => {
      const results = { tasks: 0, emails: 0, calls: 0, other: 0, errors: 0 };

      for (const { actionData } of pendingActions) {
        try {
          const { data, error } = await supabase.functions.invoke("vizzy-erp-action", {
            body: { action: actionData.type, params: actionData },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          if (actionData.type === "create_task") {
            results.tasks++;
          } else if (actionData.type === "batch_create_tasks") {
            results.tasks += data?.created_count || actionData.tasks?.length || 0;
          } else if (actionData.type === "create_notifications") {
            results.tasks += actionData.items?.length || 1;
          } else if (actionData.type === "send_email") {
            results.emails++;
          } else if (actionData.type === "rc_send_sms") {
            results.emails++;
          } else if (actionData.type === "rc_make_call") {
            if (data?.browser_action === "webrtc_call" && data?.phone) {
              window.dispatchEvent(new CustomEvent("rc-webrtc-call", { detail: { phone: data.phone } }));
            }
            results.calls++;
          } else if (actionData.type === "rc_send_fax") {
            results.calls++;
          } else {
            results.other++;
          }
        } catch (err) {
          console.error("Vizzy voice action failed:", err);
          results.errors++;
        }
      }

      // Build summary toast
      const parts: string[] = [];
      if (results.tasks > 0) parts.push(`${results.tasks} task${results.tasks > 1 ? "s" : ""} created`);
      if (results.emails > 0) parts.push(`${results.emails} message${results.emails > 1 ? "s" : ""} sent`);
      if (results.calls > 0) parts.push(`${results.calls} call${results.calls > 1 ? "s" : ""} placed`);
      if (results.other > 0) parts.push(`${results.other} action${results.other > 1 ? "s" : ""} executed`);
      
      if (parts.length > 0) {
        toast.success(`Vizzy auto-${parts.join(" and ")}`);
      }
      if (results.errors > 0) {
        toast.error(`${results.errors} action${results.errors > 1 ? "s" : ""} failed`);
      }
    })();
  }, [transcripts]);

  // Connecting timer
  useEffect(() => {
    let iv: ReturnType<typeof setInterval>;
    if (voiceState === "connecting" || contextLoading) {
      setElapsed(0);
      iv = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(iv);
  }, [voiceState, contextLoading]);

  const handleClose = useCallback(() => {
    endSession();
    onClose();
  }, [endSession, onClose]);

  const isActive = mode === "speaking" || isSpeaking;
  const isConnecting = voiceState === "connecting" || contextLoading;
  const isConnected = voiceState === "connected";
  const isError = voiceState === "error";
  const isAutoRetrying = isError && autoRetryCountRef.current < MAX_AUTO_RETRIES;

  // Auto-retry on error (up to MAX_AUTO_RETRIES times)
  useEffect(() => {
    if (voiceState === "error" && autoRetryCountRef.current < MAX_AUTO_RETRIES) {
      autoRetryCountRef.current += 1;
      console.log(`[VizzyVoiceChat] Auto-retry ${autoRetryCountRef.current}/${MAX_AUTO_RETRIES}`);
      autoRetryTimerRef.current = setTimeout(() => {
        startSession();
      }, 3000);
      return () => {
        if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
      };
    }
  }, [voiceState, startSession]);

  // Reset auto-retry counter on successful connection
  useEffect(() => {
    if (voiceState === "connected") {
      autoRetryCountRef.current = 0;
    }
  }, [voiceState]);

  const statusText = isConnecting
    ? elapsed >= 8
      ? "Loading ERP intelligence..."
      : "Initializing Vizzy..."
    : isAutoRetrying
    ? "Reconnecting..."
    : isError
    ? "Connection failed"
    : isActive
    ? "Vizzy is speaking..."
    : isConnected
    ? (isMuted ? "Muted" : "Listening...")
    : "";

  // Orbit animation handled via CSS keyframes instead of RAF state updates

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 flex flex-col items-center justify-between"
      style={{
      zIndex: 100000,
      pointerEvents: "auto",
      background: "radial-gradient(ellipse at center, hsl(200 25% 10%) 0%, hsl(210 30% 6%) 100%)",
      }}
    >
      {/* Top bar */}
      <div className="w-full flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: isConnected
                ? "hsl(152 69% 53%)"
                : isConnecting
                ? "hsl(45 93% 58%)"
                : "hsl(0 84% 60%)",
              boxShadow: isConnected
                ? "0 0 8px hsl(152 69% 53% / 0.6)"
                : "none",
            }}
          />
          <span className="text-xs font-medium" style={{ color: "hsl(172 30% 70%)" }}>
            {isConnected ? "LIVE SESSION" : isConnecting ? "CONNECTING" : "OFFLINE"}
          </span>
        </div>
        <button
          onClick={handleClose}
          className="p-2 rounded-full transition-colors hover:bg-white/10"
          aria-label="End session"
        >
          <X className="w-5 h-5" style={{ color: "hsl(0 0% 70%)" }} />
        </button>
      </div>

      {/* Center orb */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <div className="relative" style={{ width: 180, height: 180 }}>
          {/* Outer glow ring */}
          <div
            className="absolute rounded-full transition-all duration-500"
            style={{
              inset: -8,
              border: `2px solid hsl(172 66% 50% / ${isActive ? 0.7 : isConnected ? 0.35 : 0.15})`,
              boxShadow: isActive
                ? "0 0 40px 8px hsl(172 66% 50% / 0.25), inset 0 0 30px hsl(172 66% 50% / 0.08)"
                : "none",
            }}
          />

          {/* Second ring */}
          <div
            className="absolute rounded-full transition-all duration-500"
            style={{
              inset: -20,
              border: `1.5px solid hsl(172 66% 50% / ${isActive ? 0.4 : isConnected ? 0.15 : 0.08})`,
            }}
          />

          {/* Orbiting dot — CSS animation */}
          {isConnected && (
            <div
              className="absolute w-3 h-3 rounded-full"
              style={{
                left: "50%",
                top: "50%",
                marginLeft: -6,
                marginTop: -6,
                background: "hsl(172 66% 55%)",
                boxShadow: "0 0 12px 3px hsl(172 66% 50% / 0.6)",
                animation: "vizzy-orbit 5s linear infinite",
              }}
            />
          )}

          {/* Avatar */}
          <div
            className="absolute inset-0 rounded-full overflow-hidden transition-all duration-300"
            style={{
              border: `3px solid hsl(172 66% 50% / ${isActive ? 0.9 : isConnected ? 0.5 : 0.25})`,
              transform: `scale(${isActive ? 1.05 : 1})`,
              boxShadow: isActive
                ? "0 0 50px 12px hsl(172 66% 50% / 0.35)"
                : isConnected
                ? "0 0 20px 4px hsl(172 66% 50% / 0.15)"
                : "none",
            }}
          >
            <img
              src={vizzyAvatar}
              alt="Vizzy"
              className="w-full h-full object-cover"
              style={{ transform: "scale(1.8)", objectPosition: "center 38%" }}
              draggable={false}
            />
            {/* Connecting overlay */}
            {isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-full">
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: "hsl(172 66% 55%)" }} />
              </div>
            )}
          </div>
        </div>

        {/* Status text */}
        <div className="flex flex-col items-center gap-3">
          <p
            className={cn("text-sm font-medium tracking-wide transition-colors")}
            style={{
              color: isError
                ? "hsl(0 84% 60%)"
                : isActive
                ? "hsl(172 66% 65%)"
                : "hsl(0 0% 55%)",
            }}
          >
            {statusText}
          </p>

          {/* Audio wave indicator when connected */}
          {isConnected && !isActive && !isMuted && (
            <div className="flex items-center gap-1 h-4">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-0.5 rounded-full"
                  style={{ background: "hsl(172 66% 50%)" }}
                  animate={{
                    height: [4, 12 + Math.random() * 8, 4],
                  }}
                  transition={{
                    duration: 0.8 + Math.random() * 0.4,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
          )}

          {isError && (
            <button
              onClick={startSession}
              className="px-5 py-2 rounded-full text-sm font-medium transition-colors"
              style={{
                background: "hsl(172 66% 50%)",
                color: "hsl(210 30% 6%)",
              }}
            >
              Retry Connection
            </button>
          )}

          {isConnected && outputAudioBlocked && (
            <button
              type="button"
              onClick={retryOutputAudio}
              className="px-5 py-2 rounded-full text-sm font-medium transition-colors animate-pulse"
              style={{
                background: "hsl(45 93% 48%)",
                color: "hsl(210 30% 8%)",
              }}
            >
              Enable sound (tap here)
            </button>
          )}

          {isConnecting && elapsed >= 12 && (
            <button
              onClick={handleClose}
              className="px-4 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                background: "hsl(0 0% 20%)",
                color: "hsl(0 0% 70%)",
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Transcript area */}
      <div className="w-full max-w-lg px-4 pb-2 max-h-[28vh] overflow-y-auto scrollbar-thin">
        <AnimatePresence>
          {transcripts.slice(-8).map((t: VizzyVoiceTranscript) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "mb-2 px-4 py-2.5 rounded-2xl text-sm max-w-[85%]",
                t.role === "user" ? "ml-auto" : "mr-auto"
              )}
              style={{
                background:
                  t.role === "user"
                    ? "hsl(172 66% 50% / 0.12)"
                    : "hsl(0 0% 100% / 0.06)",
                color: "hsl(0 0% 88%)",
                border: `1px solid ${
                  t.role === "user"
                    ? "hsl(172 66% 50% / 0.2)"
                    : "hsl(0 0% 100% / 0.08)"
                }`,
              }}
            >
              <span
                className="text-[10px] font-semibold tracking-wider block mb-0.5"
                style={{
                  color:
                    t.role === "user"
                      ? "hsl(172 66% 60%)"
                      : "hsl(0 0% 50%)",
                }}
              >
                {t.role === "user" ? "YOU" : "VIZZY"}
              </span>
              {/* Detect LOVABLE COMMAND blocks and render with copy button */}
              {t.text.includes("LOVABLE COMMAND:") ? (
                <LovableCommandRenderer text={t.text} />
              ) : (
                t.text.replace(/\[VIZZY-ACTION\][\s\S]*?\[\/VIZZY-ACTION\]/g, "").trim()
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Bottom controls */}
      <div className="pb-8 pt-2 flex flex-col items-center gap-3">
        {isConnected && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "hsl(0 0% 45%)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live ERP Data Connected
          </div>
        )}
        <div className="flex items-center gap-3">
          {isConnected && (
            <button
              onClick={toggleMute}
              className="flex items-center justify-center w-14 h-14 rounded-full font-medium shadow-lg transition-all hover:scale-105 active:scale-95"
              style={{
                background: isMuted
                  ? "hsl(0 0% 20%)"
                  : "hsl(172 66% 50% / 0.15)",
                border: `2px solid ${isMuted ? "hsl(0 0% 35%)" : "hsl(172 66% 50% / 0.4)"}`,
                color: isMuted ? "hsl(0 0% 50%)" : "hsl(172 66% 65%)",
              }}
              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <button
            onClick={handleClose}
            className="flex items-center gap-2.5 px-8 py-3.5 rounded-full font-medium shadow-lg transition-all hover:scale-105 active:scale-95"
            style={{
              background: "linear-gradient(135deg, hsl(0 75% 50%), hsl(0 75% 42%))",
              color: "white",
              boxShadow: "0 4px 20px hsl(0 75% 50% / 0.3)",
            }}
          >
            <MicOff className="w-5 h-5" />
            End Session
          </button>
        </div>
      </div>
    </motion.div>
  );
}
