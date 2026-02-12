import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Loader2, Bot, BotOff, CheckCircle, XCircle, Voicemail, PhoneMissed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CallAiBridgeState } from "@/hooks/useCallAiBridge";
import type { CallTaskOutcome } from "@/hooks/useCallTask";

export interface PennyCallData {
  phone: string;
  contact_name: string;
  reason: string;
  details?: string;
  lead_id?: string;
  contact_id?: string;
}

interface PennyCallCardProps {
  data: PennyCallData;
  callStatus: "idle" | "registering" | "ready" | "calling" | "in_call" | "error";
  onCall: (phone: string, contactName: string) => void;
  onHangup: () => void;
  /** AI voice bridge controls */
  bridgeState?: CallAiBridgeState;
  onStartAiBridge?: (callData: PennyCallData) => void;
  onStopAiBridge?: () => void;
  /** Call task lifecycle */
  taskStatus?: string;
  attemptCount?: number;
  onOutcome?: (outcome: CallTaskOutcome) => void;
  showOutcome?: boolean;
}

export function PennyCallCard({
  data,
  callStatus,
  onCall,
  onHangup,
  bridgeState,
  onStartAiBridge,
  onStopAiBridge,
  taskStatus,
  attemptCount,
  onOutcome,
  showOutcome,
}: PennyCallCardProps) {
  const isActive = callStatus === "calling" || callStatus === "in_call";
  const isDialing = callStatus === "calling";
  const aiActive = bridgeState?.active ?? false;
  const aiConnecting = bridgeState?.status === "connecting";
  const autoTriggeredRef = useRef(false);
  const ringGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [waitingForAnswer, setWaitingForAnswer] = useState(false);

  // Auto-activate AI bridge with ring guard delay (wait for caller to answer)
  useEffect(() => {
    if (
      callStatus === "in_call" &&
      !aiActive &&
      bridgeState?.status === "idle" &&
      !autoTriggeredRef.current &&
      onStartAiBridge
    ) {
      autoTriggeredRef.current = true;
      setWaitingForAnswer(true);
      // Delay 8 seconds to allow phone to ring and be answered
      ringGuardTimerRef.current = setTimeout(() => {
        ringGuardTimerRef.current = null;
        setWaitingForAnswer(false);
        onStartAiBridge(data);
      }, 8000);
    }
    if (callStatus !== "in_call" && callStatus !== "calling") {
      autoTriggeredRef.current = false;
      setWaitingForAnswer(false);
      if (ringGuardTimerRef.current) {
        clearTimeout(ringGuardTimerRef.current);
        ringGuardTimerRef.current = null;
      }
    }
  }, [callStatus, aiActive, bridgeState?.status, onStartAiBridge]);

  // Cleanup ring guard timer on unmount
  useEffect(() => {
    return () => {
      if (ringGuardTimerRef.current) {
        clearTimeout(ringGuardTimerRef.current);
      }
    };
  }, []);

  const outcomeButtons: { outcome: CallTaskOutcome; label: string; icon: React.ReactNode }[] = [
    { outcome: "answered", label: "Answered", icon: <CheckCircle className="w-3.5 h-3.5" /> },
    { outcome: "no_answer", label: "No Answer", icon: <PhoneMissed className="w-3.5 h-3.5" /> },
    { outcome: "voicemail", label: "Voicemail", icon: <Voicemail className="w-3.5 h-3.5" /> },
    { outcome: "wrong_number", label: "Wrong #", icon: <XCircle className="w-3.5 h-3.5" /> },
  ];

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm">{data.contact_name}</p>
            <p className="text-xs text-muted-foreground">
              {data.phone.startsWith("ext:") ? `Ext. ${data.phone.slice(4)}` : data.phone}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{data.reason}</p>
            {attemptCount != null && attemptCount > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Attempt #{attemptCount}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* AI Talk toggle */}
            {isActive && onStartAiBridge && onStopAiBridge && (
              <Button
                size="sm"
                variant={aiActive ? "secondary" : "outline"}
                className="gap-1.5"
                onClick={aiActive ? onStopAiBridge : () => onStartAiBridge(data)}
                disabled={aiConnecting}
              >
                {aiConnecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : aiActive ? (
                  <BotOff className="w-3.5 h-3.5" />
                ) : (
                  <Bot className="w-3.5 h-3.5" />
                )}
                {aiActive ? "Stop AI" : "AI Talk"}
              </Button>
            )}

            {isActive ? (
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                onClick={onHangup}
              >
                <PhoneOff className="w-3.5 h-3.5" />
                {isDialing ? "Cancel" : "Hang up"}
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => onCall(data.phone, data.contact_name)}
                disabled={callStatus === "registering" || showOutcome}
              >
                {callStatus === "registering" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Phone className="w-3.5 h-3.5" />
                )}
                Call Now
              </Button>
            )}
          </div>
        </div>

        {/* Call status indicator */}
        {isActive && (
          <div className="flex items-center gap-2 text-xs">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${aiActive ? "bg-violet-400" : "bg-green-400"}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${aiActive ? "bg-violet-500" : "bg-green-500"}`} />
            </span>
            <span className="text-muted-foreground">
              {aiActive
                ? "AI is talking"
                : waitingForAnswer
                  ? "Waiting for answer..."
                  : isDialing
                    ? "Dialing..."
                    : "On call"}
            </span>
          </div>
        )}

        {/* Live AI transcript */}
        {aiActive && bridgeState && bridgeState.transcript.length > 0 && (
          <div className="mt-2 max-h-32 overflow-y-auto space-y-1 text-xs border-t pt-2">
            {bridgeState.transcript.map((entry, i) => (
              <p key={i} className={entry.role === "ai" ? "text-primary" : "text-muted-foreground"}>
                <span className="font-medium">{entry.role === "ai" ? "AI" : "Caller"}:</span>{" "}
                {entry.text}
              </p>
            ))}
          </div>
        )}

        {/* Outcome buttons — shown after call ends */}
        {showOutcome && onOutcome && (
          <div className="border-t pt-2 mt-2">
            <p className="text-xs text-muted-foreground mb-1.5">How did the call go?</p>
            <div className="flex flex-wrap gap-1.5">
              {outcomeButtons.map((btn) => (
                <Button
                  key={btn.outcome}
                  size="sm"
                  variant="outline"
                  className="gap-1 text-xs h-7"
                  onClick={() => onOutcome(btn.outcome)}
                >
                  {btn.icon}
                  {btn.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Parse [PENNY-CALL]{...}[/PENNY-CALL] tags from agent response text */
export function parsePennyCalls(text: string): { cleanText: string; calls: PennyCallData[] } {
  const calls: PennyCallData[] = [];
  const cleanText = text.replace(
    /\[PENNY-CALL\]([\s\S]*?)\[\/PENNY-CALL\]/g,
    (_, json) => {
      try {
        const data = JSON.parse(json.trim());
        if (data.phone && data.contact_name) {
          calls.push({
            phone: data.phone,
            contact_name: data.contact_name,
            reason: data.reason || "",
            details: data.details,
            lead_id: data.lead_id,
            contact_id: data.contact_id,
          });
        }
      } catch (e) {
        console.warn("Failed to parse PENNY-CALL:", e);
      }
      return "";
    }
  );
  return { cleanText: cleanText.trim(), calls };
}
