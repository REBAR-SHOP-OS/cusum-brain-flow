import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useNilaVoiceAssistant, NilaMessage } from "@/hooks/useNilaVoiceAssistant";
import { NilaHeader } from "./NilaHeader";
import { NilaWaveVisualizer } from "./NilaWaveVisualizer";
import { NilaMicButton } from "./NilaMicButton";
import { NilaChatMessages } from "./NilaChatMessages";
import { NilaVoiceSelector } from "./NilaVoiceSelector";
import { NilaTextInput } from "./NilaTextInput";
import { addMarkdownToPdf } from "@/lib/pdfMarkdownRenderer";
import { primeMobileAudio } from "@/lib/audioPlayer";

const loadJsPDF = () => import("jspdf").then((m) => m.default);

interface Props {
  onClose: () => void;
}

export function NilaVoiceAssistant({ onClose }: Props) {
  const {
    mode, status, messages, clearMessages,
    interimText,
    selectedVoice, setSelectedVoice,
    isRecognizing, toggleRecognition, sendText,
  } = useNilaVoiceAssistant();

  const [showVoiceSelector, setShowVoiceSelector] = useState(false);

  const handleMicToggle = useCallback(() => {
    primeMobileAudio();
    toggleRecognition();
  }, [toggleRecognition]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleDownloadPdf = useCallback(async () => {
    if (messages.length === 0) return;
    const jsPDF = await loadJsPDF();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxWidth = pageWidth - margin * 2;

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

    let md = `# Nila Voice Assistant — Report\n\n`;
    md += `**Date:** ${dateStr} at ${timeStr}\n\n`;
    md += `**Mode:** ${mode} | **Messages:** ${messages.length}\n\n`;
    md += `## Conversation\n\n`;

    messages.forEach((m: NilaMessage) => {
      const roleLabel = m.role === "user" ? "User" : m.role === "assistant" ? "Nila" : "System";
      md += `- **${roleLabel}:** ${m.content}\n`;
    });

    addMarkdownToPdf(doc, md, { margin, maxWidth, pageHeight, startY: margin });
    doc.save(`nila-report-${now.toISOString().slice(0, 10)}.pdf`);
  }, [messages, mode]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col nila-bg"
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-blue-500/10 blur-[100px]" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-purple-500/10 blur-[100px]" />
      </div>

      {/* Header */}
      <NilaHeader
        status={status}
        mode={mode}
        onToggleVoiceSelector={() => setShowVoiceSelector((v) => !v)}
        onDownloadPdf={handleDownloadPdf}
        onClose={handleClose}
        hasMessages={messages.length > 0}
      />

      {/* Voice selector */}
      {showVoiceSelector && (
        <NilaVoiceSelector selectedVoice={selectedVoice} onSelect={(id) => { setSelectedVoice(id); setShowVoiceSelector(false); }} />
      )}

      {/* Wave visualizer */}
      <div className="px-4 py-2">
        <NilaWaveVisualizer status={status} />
      </div>

      {/* Chat messages */}
      <NilaChatMessages messages={messages} />

      {/* Mic button */}
      <div className="flex justify-center py-4">
        <NilaMicButton isRecognizing={isRecognizing} status={status} onToggle={handleMicToggle} />
      </div>

      {/* Text input */}
      <NilaTextInput interimText={interimText} onSend={sendText} />
    </motion.div>
  );
}
