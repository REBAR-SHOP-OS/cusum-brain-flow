import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CommittedTranscript {
  id: string;
  text: string;
  timestamp: number;
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
    <ScrollArea className="max-h-80 rounded-lg border border-border bg-muted/30 p-4">
      <div className="space-y-2">
        {committed.map((t) => (
          <div key={t.id} className="flex gap-2 items-start">
            <span className="text-[10px] font-mono text-muted-foreground shrink-0 pt-0.5 min-w-[3rem]">
              {formatTimestamp(t.timestamp)}
            </span>
            <span className="text-sm text-foreground">{t.text}</span>
          </div>
        ))}
        {partial && (
          <div className="flex gap-2 items-start">
            <span className="text-[10px] font-mono text-muted-foreground shrink-0 pt-0.5 min-w-[3rem]">
              …
            </span>
            <span className="text-sm text-muted-foreground italic">
              {partial}
              <span className="animate-pulse">▊</span>
            </span>
          </div>
        )}
        {isActive && committed.length === 0 && !partial && (
          <p className="text-sm text-muted-foreground italic">Listening… speak now</p>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
