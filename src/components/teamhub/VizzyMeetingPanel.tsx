import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain, X, Loader2, Mic, MicOff, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MeetingAiBridgeState } from "@/hooks/useMeetingAiBridge";

interface VizzyMeetingPanelProps {
  state: MeetingAiBridgeState;
  onSummon: () => void;
  onDismiss: () => void;
  onSendMessage: (text: string) => void;
}

export function VizzyMeetingPanel({
  state,
  onSummon,
  onDismiss,
  onSendMessage,
}: VizzyMeetingPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.transcript.length]);

  const handleSend = () => {
    const text = inputRef.current?.value?.trim();
    if (text) {
      onSendMessage(text);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (!state.active && state.status === "idle") {
    return (
      <div className="w-[320px] flex flex-col border-l border-border bg-card/50 backdrop-blur-sm">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Brain className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground">Summon Vizzy</h3>
            <p className="text-xs text-muted-foreground">
              Bring Vizzy into this meeting as your AI companion. Vizzy will listen and assist in real-time.
            </p>
          </div>
          <Button onClick={onSummon} className="gap-2">
            <Mic className="w-4 h-4" />
            Summon Vizzy
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[320px] flex flex-col border-l border-border bg-card/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Vizzy AI</span>
          {state.status === "connecting" && (
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
          )}
          {state.active && (
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0 gap-1",
                state.isSpeaking
                  ? "text-primary border-primary/30"
                  : "text-green-400 border-green-400/30"
              )}
            >
              {state.isSpeaking ? (
                <>
                  <Mic className="w-2.5 h-2.5" /> Speaking
                </>
              ) : (
                <>
                  <Mic className="w-2.5 h-2.5" /> Listening
                </>
              )}
            </Badge>
          )}
          {state.status === "error" && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
              Error
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onDismiss}
          title="Dismiss Vizzy"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </div>

      {/* Transcript */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {state.transcript.length === 0 && state.active && (
            <div className="text-center py-8">
              <Brain className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Vizzy is listening... Start talking and Vizzy will respond.
              </p>
            </div>
          )}

          {state.transcript.map((entry, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg px-3 py-2 text-xs",
                entry.role === "vizzy"
                  ? "bg-primary/10 border border-primary/20"
                  : "bg-muted/50 border border-border/50"
              )}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className={cn(
                    "text-[10px] font-bold",
                    entry.role === "vizzy" ? "text-primary" : "text-foreground"
                  )}
                >
                  {entry.role === "vizzy" ? "Vizzy" : "You"}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-foreground/90">{entry.text}</p>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Text input for Vizzy */}
      {state.active && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type to Vizzy..."
            className="flex-1 text-xs bg-muted/30 border border-border rounded-md px-2.5 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={handleSend}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Reconnect if error */}
      {state.status === "error" && (
        <div className="px-3 py-2 border-t border-border">
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={onSummon}>
            Reconnect Vizzy
          </Button>
        </div>
      )}
    </div>
  );
}
