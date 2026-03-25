import { useState, useCallback, useRef, useEffect } from "react";
import { useRealtimeTranscribe } from "@/hooks/useRealtimeTranscribe";
import { Trash2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NilaVoiceAssistant } from "@/components/nila/NilaVoiceAssistant";
import { LanguageMicButton } from "@/components/azin/LanguageMicButton";
import { AnimatePresence } from "framer-motion";
import azinAvatar from "@/assets/helpers/azin-helper.png";
import { primeMobileAudio } from "@/lib/audioPlayer";

export default function AzinInterpreter() {
  const navigate = useNavigate();
  const [showVoiceChat, setShowVoiceChat] = useState(false);
  const enBottomRef = useRef<HTMLDivElement>(null);
  const faBottomRef = useRef<HTMLDivElement>(null);
  const {
    isConnected,
    isConnecting,
    partialText,
    committedTranscripts,
    sourceLang,
    setSourceLang,
    connect,
    disconnect,
    clearTranscripts,
  } = useRealtimeTranscribe();

  // Auto-scroll both columns
  useEffect(() => {
    enBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    faBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [committedTranscripts, partialText]);

  const handleLangToggle = useCallback(async (lang: "en" | "fa") => {
    if (isConnected && sourceLang === lang) {
      disconnect();
    } else if (isConnected && sourceLang !== lang) {
      disconnect();
      setSourceLang(lang);
      connect();
    } else {
      setSourceLang(lang);
      connect();
    }
  }, [isConnected, sourceLang, connect, disconnect, setSourceLang]);


  const statusLabel = isConnecting
    ? "Connecting..."
    : isConnected
    ? `Listening (${sourceLang === "en" ? "English" : sourceLang === "fa" ? "فارسی" : "Auto"})...`
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
            <h1 className="text-lg font-bold text-foreground">Nila — Real-Time Interpreter</h1>
            <p className={cn("text-sm font-medium", statusColor)}>{statusLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Split columns */}
      <div className="flex-1 grid grid-cols-2 divide-x divide-border overflow-hidden min-h-0">
        {/* English column */}
        <div className="flex flex-col min-h-0">
          <div className="px-4 py-2 border-b border-border bg-muted/30">
            <span className="text-sm font-semibold text-foreground">English</span>
          </div>
          <ScrollArea className="flex-1 px-4 py-2">
            <div className="space-y-4">
              {committedTranscripts.map((t) => (
                  <div key={t.id} className="text-base text-foreground leading-relaxed">
                    {t.isTranslating ? (
                      <span className="text-muted-foreground italic">translating...</span>
                    ) : (
                      <span>{t.englishText || t.translatedText || t.text}</span>
                    )}
                  </div>
                ))}
              {partialText && sourceLang !== "fa" && (
                <div className="text-base text-muted-foreground italic leading-relaxed">{partialText}</div>
              )}
              <div ref={enBottomRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Farsi column */}
        <div className="flex flex-col min-h-0">
          <div className="px-4 py-2 border-b border-border bg-muted/30 text-right">
            <span className="text-sm font-semibold text-foreground">فارسی</span>
          </div>
          <ScrollArea className="flex-1 px-4 py-2">
            <div className="space-y-4" dir="rtl">
              {committedTranscripts.map((t) => (
                  <div key={t.id} className="text-base text-foreground leading-relaxed" style={{ fontFamily: '"Vazirmatn", "Tahoma", sans-serif' }}>
                    {t.isTranslating ? (
                      <span className="text-muted-foreground italic">در حال ترجمه...</span>
                    ) : (
                      <span>{t.farsiText || t.originalCleanText || t.text}</span>
                    )}
                  </div>
                ))}
              {partialText && sourceLang === "fa" && (
                <div className="text-base text-muted-foreground italic leading-relaxed" style={{ fontFamily: '"Vazirmatn", "Tahoma", sans-serif' }}>{partialText}</div>
              )}
              <div ref={faBottomRef} />
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Bottom bar: EN mic + AZIN avatar + FA mic */}
      <div className="flex items-center justify-center gap-6 py-6 border-t border-border">
        {/* EN Record Button */}
        <LanguageMicButton
          lang="en"
          label="EN"
          isActive={isConnected && sourceLang === "en"}
          isConnecting={isConnecting && sourceLang === "en"}
          disabled={isConnecting && sourceLang !== "en"}
          onToggle={() => handleLangToggle("en")}
        />

        {/* AZIN Voice Interpreter Button */}
        <button
          onClick={() => {
            primeMobileAudio();
            setShowVoiceChat(true);
          }}
          className="relative w-14 h-14 rounded-full focus:outline-none group"
          aria-label="Start voice interpreter with Nila"
        >
          <div className="w-14 h-14 rounded-full overflow-hidden ring-2 ring-primary/50 group-hover:ring-primary transition-all shadow-lg">
            <img src={azinAvatar} alt="Nila" className="w-full h-full object-cover" draggable={false} />
          </div>
        </button>

        {/* FA Record Button */}
        <LanguageMicButton
          lang="fa"
          label="فا"
          isActive={isConnected && sourceLang === "fa"}
          isConnecting={isConnecting && sourceLang === "fa"}
          disabled={isConnecting && sourceLang !== "fa"}
          onToggle={() => handleLangToggle("fa")}
        />
      </div>

      {/* Voice Chat Overlay */}
      <AnimatePresence>
        {showVoiceChat && (
          <NilaVoiceAssistant onClose={() => setShowVoiceChat(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
