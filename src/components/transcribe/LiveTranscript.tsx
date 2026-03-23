import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CommittedTranscript {
  id: string;
  text: string;
  timestamp: number;
  translatedText?: string;
  originalCleanText?: string;
  englishText?: string;
  farsiText?: string;
  isTranslating?: boolean;
}

function formatTimestamp(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function LiveTranscript({
  committed,
  partial,
  isActive,
}: {
  committed: CommittedTranscript[];
  partial: string;
  isActive: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [committed, partial]);

  if (committed.length === 0 && !partial && !isActive) return null;

  return (
    <TooltipProvider delayDuration={300}>
      <ScrollArea className="max-h-80 rounded-lg border border-border bg-muted/30 p-4">
        <div className="space-y-2">
          {committed.map((t) => (
            <div key={t.id} className="flex gap-2 items-start">
              <span className="text-[10px] font-mono text-muted-foreground shrink-0 pt-0.5 min-w-[3rem]">
                {formatTimestamp(t.timestamp)}
              </span>
              <div className="flex flex-col gap-0.5">
                {t.isTranslating ? (
                  <span className="text-xs text-muted-foreground italic animate-pulse">translating…</span>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-sm text-foreground cursor-help">
                        {t.translatedText || ""}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-xs font-mono text-muted-foreground">Raw: {t.text}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
          {partial && (
            <div className="flex gap-2 items-start">
              <span className="text-[10px] font-mono text-muted-foreground shrink-0 pt-0.5 min-w-[3rem]">
                …
              </span>
              <span className="text-sm text-muted-foreground italic animate-pulse">
                Listening…
              </span>
            </div>
          )}
          {isActive && committed.length === 0 && !partial && (
            <p className="text-sm text-muted-foreground italic">Listening… speak now</p>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </TooltipProvider>
  );
}
