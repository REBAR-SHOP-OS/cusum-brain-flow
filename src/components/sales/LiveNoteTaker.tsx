import { useCallback, useEffect, useRef } from "react";
import { Mic, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSalesLeadActivities } from "@/hooks/useSalesLeadActivities";
import { toast } from "sonner";

interface LiveNoteTakerProps {
  salesLeadId: string;
  companyId: string;
}

export function LiveNoteTaker({ salesLeadId, companyId }: LiveNoteTakerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { create } = useSalesLeadActivities(salesLeadId);

  const handleStop = useCallback(() => {
    // handled in effect below after speech stops
  }, []);

  const {
    isListening,
    transcripts,
    interimText,
    fullTranscript,
    start,
    stop,
    isSupported,
  } = useSpeechRecognition({ lang: "en-US" });

  const prevListeningRef = useRef(isListening);

  // Auto-save transcript as activity when recording stops
  useEffect(() => {
    if (prevListeningRef.current && !isListening && fullTranscript.trim()) {
      create.mutate({
        sales_lead_id: salesLeadId,
        company_id: companyId,
        activity_type: "note",
        subject: "📝 Live Note",
        body: fullTranscript.trim(),
      });
    }
    prevListeningRef.current = isListening;
  }, [isListening, fullTranscript, salesLeadId, companyId, create]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts, interimText]);

  if (!isSupported) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          Speech recognition is not supported in this browser. Use Chrome or Edge.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          {isListening && (
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          )}
          <span className="text-xs font-medium text-foreground">
            {isListening ? "Recording…" : "Live Note-Taker"}
          </span>
        </div>
        <Button
          size="sm"
          variant={isListening ? "destructive" : "default"}
          className="h-7 text-xs gap-1.5"
          onClick={isListening ? stop : start}
        >
          {isListening ? (
            <>
              <Square className="w-3 h-3" />
              Stop
            </>
          ) : (
            <>
              <Mic className="w-3 h-3" />
              Start
            </>
          )}
        </Button>
      </div>

      {/* Transcript area */}
      <ScrollArea className="h-32">
        <div ref={scrollRef} className="p-3 space-y-1.5">
          {transcripts.length === 0 && !interimText && (
            <p className="text-xs text-muted-foreground italic">
              {isListening
                ? "Listening… speak now."
                : "Click Start to begin live note-taking."}
            </p>
          )}

          {transcripts.map((entry) => (
            <p key={entry.id} className="text-sm text-foreground">
              {entry.text}
            </p>
          ))}

          {interimText && (
            <p className="text-sm text-muted-foreground italic animate-pulse">
              {interimText}
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
