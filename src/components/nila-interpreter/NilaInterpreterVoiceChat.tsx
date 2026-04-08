import { useEffect, useRef, useState } from "react";
import { X, Mic, Loader2, FileText } from "lucide-react";
import { useNilaVoiceRelay, RelayTranscript } from "@/hooks/useNilaVoiceRelay";
import { cn } from "@/lib/utils";
import nilaAvatar from "@/assets/helpers/nila-helper.png";
import { motion, AnimatePresence } from "framer-motion";
import { detectRtl } from "@/utils/textDirection";
import { primeMobileAudio } from "@/lib/audioPlayer";
const loadJsPDF = () => import("jspdf").then(m => m.default);
import { addMarkdownToPdf } from "@/lib/pdfMarkdownRenderer";

interface Props {
  onClose: () => void;
}

export function NilaInterpreterVoiceChat({ onClose }: Props) {
  const {
    state, transcripts, partialText,
    startSession, endSession,
  } = useNilaVoiceRelay();

  const bottomRef = useRef<HTMLDivElement>(null);
  const [connectingElapsed, setConnectingElapsed] = useState(0);

  // Prime audio + auto-start session on mount
  useEffect(() => {
    primeMobileAudio();
    startSession();
    return () => { endSession(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcripts]);

  // Connecting timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (state === "connecting") {
      setConnectingElapsed(0);
      interval = setInterval(() => setConnectingElapsed((e) => e + 1), 1000);
    } else {
      setConnectingElapsed(0);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [state]);

  const handleClose = () => { endSession(); onClose(); };

  const generateConversationPdf = async () => {
    if (transcripts.length === 0) return;
    const jsPDF = await loadJsPDF();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    let md = `# Nila Interpreter — Conversation Report\n\n`;
    md += `**Date:** ${dateStr} at ${timeStr}\n\n`;
    md += `**Total exchanges:** ${transcripts.length}\n\n`;
    md += `## Conversation\n\n`;

    transcripts.forEach((t, i) => {
      const direction = t.sourceLang === "en" ? "English → Farsi" : "Farsi → English";
      const englishText = t.sourceLang === "en" ? t.original : t.translation;
      md += `- **${i + 1}. [${direction}]:** ${englishText || "(no translation)"}\n`;
    });

    addMarkdownToPdf(doc, md, { margin, maxWidth, pageHeight, startY: margin });

    const fileName = `nila-report-${now.toISOString().slice(0, 10)}.pdf`;
    doc.save(fileName);
  };

  const isSpeaking = transcripts.some((t) => t.isSpeaking);
  const isTranslating = transcripts.some((t) => t.isTranslating);

  const statusLabel =
    state === "connecting"
      ? connectingElapsed >= 10 ? "Taking longer than expected..." : "Connecting to Nila..."
      : state === "error" ? "Connection failed"
      : isSpeaking ? "Speaking..."
      : isTranslating ? "Translating..."
      : state === "connected" ? "Listening..."
      : "";

  const isActive = isSpeaking || isTranslating;
  const orbScale = isActive ? 1.15 : 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-background/95 backdrop-blur-xl"
    >
      {/* Close */}
      <div className="w-full flex justify-end p-4">
        <button onClick={handleClose} className="p-2 rounded-full bg-muted hover:bg-accent transition-colors" aria-label="End Nila interpreter">
          <X className="w-6 h-6 text-foreground" />
        </button>
      </div>

      {/* Orb */}
      <div className="flex flex-col items-center justify-center gap-4 py-4">
        <div className="relative">
          <div className="absolute rounded-full transition-all duration-300" style={{
            inset: "-24px", borderRadius: "50%",
            background: isActive
              ? "radial-gradient(circle, hsl(245 58% 55% / 0.3) 0%, transparent 70%)"
              : "radial-gradient(circle, hsl(245 58% 55% / 0.05) 0%, transparent 70%)",
            transform: `scale(${isActive ? 1.3 : 1})`,
          }} />
          <div className="absolute rounded-full border-2 transition-all duration-300" style={{
            inset: "-16px", borderRadius: "50%",
            borderColor: isActive ? "hsl(245 58% 55% / 0.7)" : "hsl(245 58% 55% / 0.3)",
            transform: `scale(${isActive ? 1.1 : 1})`,
          }} />
          {state === "connecting" && (
            <div className="absolute inset-0 rounded-full animate-ping" style={{ margin: "-14px", borderRadius: "50%", background: "hsl(245 58% 55% / 0.15)" }} />
          )}
          <div
            className={cn(
              "w-20 h-20 rounded-full overflow-hidden shadow-2xl transition-all duration-200",
              state === "connected" ? "ring-4 ring-indigo-500/60" :
              state === "connecting" ? "ring-4 ring-indigo-500/30" :
              state === "error" ? "ring-4 ring-destructive/50" : "ring-4 ring-muted"
            )}
            style={{
              transform: `scale(${state === "connected" ? orbScale : 1})`,
              boxShadow: state === "connected" && isActive
                ? "0 0 60px 15px hsl(245 58% 55% / 0.4)"
                : state === "error" ? "0 0 20px 5px hsl(var(--destructive) / 0.3)" : "none",
            }}
          >
            <img src={nilaAvatar} alt="Nila" className="w-full h-full object-cover" draggable={false} />
          </div>
          {state === "connecting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-full">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          )}
        </div>

        <p className={cn("text-sm font-medium transition-colors", state === "error" ? "text-destructive" : "text-muted-foreground")}>
          {statusLabel}
        </p>

        {state === "error" && (
          <button onClick={startSession} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            Try Again
          </button>
        )}
        {state === "connecting" && connectingElapsed >= 10 && (
          <button onClick={handleClose} className="px-4 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-accent transition-colors">
            Cancel
          </button>
        )}
      </div>

      {/* Transcripts */}
      <div className="w-full max-w-lg px-4 pb-2 flex-1 overflow-y-auto">
        <AnimatePresence>
          {transcripts.slice(-20).map((t: RelayTranscript) => {
            const origRtl = detectRtl(t.original);
            const transRtl = t.translation ? detectRtl(t.translation) : false;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-3"
              >
                {/* Original */}
                <div
                  dir={origRtl ? "rtl" : "ltr"}
                  lang={origRtl ? "fa" : "en"}
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm max-w-[85%]",
                    origRtl ? "mr-auto bg-primary/15 text-foreground text-right" : "ml-auto bg-primary/15 text-foreground"
                  )}
                  style={origRtl ? { fontFamily: '"Vazirmatn", "Tahoma", "Arial", sans-serif' } : undefined}
                >
                  <span className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                    🎙️ Original
                  </span>
                  {t.original}
                </div>

                {/* Translation */}
                {t.isTranslating ? (
                  <div className="mt-1 px-3 py-2 rounded-xl text-sm max-w-[85%] mr-auto bg-muted text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                    Translating...
                  </div>
                ) : t.translation ? (
                  <div
                    dir={transRtl ? "rtl" : "ltr"}
                    lang={transRtl ? "fa" : "en"}
                    className={cn(
                      "mt-1 px-3 py-2 rounded-xl text-sm max-w-[85%]",
                      transRtl ? "mr-auto bg-muted text-foreground text-right" : "mr-auto bg-muted text-foreground",
                      t.isSpeaking && "ring-2 ring-indigo-500/50"
                    )}
                    style={transRtl ? { fontFamily: '"Vazirmatn", "Tahoma", "Arial", sans-serif' } : undefined}
                  >
                    <span className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                      🔄 Translation {t.isSpeaking && "🔊"}
                    </span>
                    {t.translation}
                  </div>
                ) : null}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Partial text indicator */}
        {partialText && (
          <div className="mb-2 px-3 py-2 rounded-xl text-sm max-w-[85%] ml-auto bg-primary/10 text-muted-foreground italic">
            {partialText}...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* End Call */}
      <div className="pb-6 flex flex-col items-center gap-4">
        <div className="flex items-center gap-4">
          {transcripts.length > 0 && (
            <button
              onClick={generateConversationPdf}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Download conversation report"
            >
              <FileText className="w-5 h-5" />
            </button>
          )}
          <button onClick={handleClose} className="flex items-center gap-2 px-6 py-3 rounded-full bg-destructive text-destructive-foreground font-medium shadow-lg hover:bg-destructive/90 transition-colors">
            <Mic className="w-5 h-5" />
            End Call
          </button>
        </div>
      </div>
    </motion.div>
  );
}
