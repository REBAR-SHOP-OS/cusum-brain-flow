import { useEffect, useRef } from "react";
import { Mic, MicOff, Phone, Clock, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

interface LiveCallPanelProps {
  fromNumber?: string;
  toNumber?: string;
  direction?: string;
  startTime?: Date;
  onCallEnd: (transcript: string) => void;
  isActive: boolean;
}

function formatElapsed(startTime: Date): string {
  const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function LiveCallPanel({
  fromNumber,
  toNumber,
  direction,
  startTime,
  onCallEnd,
  isActive,
}: LiveCallPanelProps) {
  const {
    isListening,
    transcripts,
    interimText,
    fullTranscript,
    start,
    stop,
    reset,
    isSupported,
  } = useSpeechRecognition();

  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<HTMLSpanElement>(null);

  // Auto-start transcription when call becomes active
  useEffect(() => {
    if (isActive && !isListening && isSupported) {
      start();
    }
  }, [isActive, isListening, isSupported, start]);

  // When call ends, stop transcription and send transcript
  useEffect(() => {
    if (!isActive && isListening) {
      stop();
      if (fullTranscript.trim()) {
        onCallEnd(fullTranscript);
      }
    }
  }, [isActive, isListening, stop, fullTranscript, onCallEnd]);

  // Timer display
  useEffect(() => {
    if (isActive && startTime) {
      timerRef.current = setInterval(() => {
        if (elapsedRef.current) {
          elapsedRef.current.textContent = formatElapsed(startTime);
        }
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, startTime]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, interimText]);

  if (!isActive && transcripts.length === 0) return null;

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Call Header */}
      <div className="p-4 border-b border-border bg-primary/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              {isActive && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card animate-pulse" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {direction === "outbound" ? toNumber : fromNumber || "Unknown"}
                </span>
                <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">
                  {isActive ? "Live" : "Ended"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span ref={elapsedRef}>
                  {startTime ? formatElapsed(startTime) : "00:00"}
                </span>
                <span>•</span>
                <span className="capitalize">{direction || "call"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isSupported && (
              <Button
                variant={isListening ? "default" : "outline"}
                size="sm"
                onClick={isListening ? stop : start}
                className="gap-1.5"
              >
                {isListening ? (
                  <>
                    <Radio className="w-3.5 h-3.5 animate-pulse" />
                    Transcribing
                  </>
                ) : (
                  <>
                    <MicOff className="w-3.5 h-3.5" />
                    Start Transcription
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Live Transcription */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Mic className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Live Transcription</span>
          {isListening && (
            <span className="flex items-center gap-1 text-[10px] text-green-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Listening
            </span>
          )}
        </div>

        <ScrollArea className="h-48">
          <div ref={scrollRef} className="space-y-2 pr-4">
            {!isSupported && (
              <p className="text-sm text-muted-foreground italic">
                Speech recognition is not supported in this browser. Please use Chrome or Edge.
              </p>
            )}

            {transcripts.length === 0 && !interimText && isSupported && (
              <p className="text-sm text-muted-foreground italic">
                {isListening
                  ? "Listening... Start speaking and your words will appear here."
                  : "Click 'Start Transcription' to begin live transcription."}
              </p>
            )}

            {transcripts.map((entry) => (
              <div key={entry.id} className="flex gap-2">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                  {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <p className="text-sm">{entry.text}</p>
              </div>
            ))}

            {interimText && (
              <div className="flex gap-2">
                <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">
                  {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <p className={cn("text-sm text-muted-foreground italic")}>{interimText}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
