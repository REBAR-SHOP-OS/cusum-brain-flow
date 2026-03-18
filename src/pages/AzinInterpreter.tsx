import { useState, useCallback, useRef } from "react";
import { useRealtimeTranscribe } from "@/hooks/useRealtimeTranscribe";
import { Mic, MicOff, Trash2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AzinVoiceChatButton } from "@/components/azin/AzinVoiceChatButton";
import { VizzyVoiceChat } from "@/components/vizzy/VizzyVoiceChat";
import { AnimatePresence } from "framer-motion";

export default function AzinInterpreter() {
  const navigate = useNavigate();
  const {
    isConnected,
    isConnecting,
    partialText,
    committedTranscripts,
    connect,
    disconnect,
    clearTranscripts,
  } = useRealtimeTranscribe();

  const enScrollRef = useRef<HTMLDivElement>(null);
  const faScrollRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  }, [isConnected, connect, disconnect]);

  const statusLabel = isConnecting
    ? "Connecting..."
    : isConnected
    ? "Listening..."
    : "Ready";

  const statusColor = isConnecting
    ? "text-yellow-400"
    : isConnected
    ? "text-green-400"
    : "text-muted-foreground";

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-foreground">AZIN — Real-Time Interpreter</h1>
            <p className={cn("text-sm font-medium", statusColor)}>{statusLabel}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={clearTranscripts}
          disabled={committedTranscripts.length === 0}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-5 h-5" />
        </Button>
      </div>

      {/* Split columns */}
      <div className="flex-1 grid grid-cols-2 divide-x divide-border overflow-hidden">
        {/* English column */}
        <div className="flex flex-col">
          <div className="px-4 py-2 border-b border-border bg-muted/30">
            <span className="text-sm font-semibold text-foreground">English</span>
          </div>
          <ScrollArea className="flex-1 px-4 py-2" ref={enScrollRef}>
            <div className="space-y-3">
              {committedTranscripts.map((t) => (
                <div key={t.id} className="text-sm text-foreground">
                  {t.isTranslating ? (
                    <span className="text-muted-foreground italic">translating...</span>
                  ) : (
                    <span>{t.translatedText || t.text}</span>
                  )}
                </div>
              ))}
              {partialText && (
                <div className="text-sm text-muted-foreground italic">{partialText}</div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Farsi column */}
        <div className="flex flex-col">
          <div className="px-4 py-2 border-b border-border bg-muted/30 text-right">
            <span className="text-sm font-semibold text-foreground">فارسی</span>
          </div>
          <ScrollArea className="flex-1 px-4 py-2" ref={faScrollRef}>
            <div className="space-y-3" dir="rtl">
              {committedTranscripts.map((t) => (
                <div key={t.id} className="text-sm text-foreground">
                  {t.isTranslating ? (
                    <span className="text-muted-foreground italic">در حال ترجمه...</span>
                  ) : (
                    <span>{t.originalCleanText || t.text}</span>
                  )}
                </div>
              ))}
              {partialText && (
                <div className="text-sm text-muted-foreground italic">{partialText}</div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Mic button */}
      <div className="flex items-center justify-center py-6 border-t border-border">
        <button
          onClick={handleToggle}
          disabled={isConnecting}
          className={cn(
            "relative w-20 h-20 rounded-full flex items-center justify-center transition-all",
            isConnected
              ? "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30"
              : "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:scale-105",
            isConnecting && "opacity-60 cursor-wait"
          )}
        >
          {isConnected && (
            <span className="absolute inset-0 rounded-full bg-destructive/40 animate-ping" />
          )}
          {isConnected ? (
            <MicOff className="w-8 h-8 relative z-10" />
          ) : (
            <Mic className="w-8 h-8 relative z-10" />
          )}
        </button>
      </div>
    </div>
  );
}
