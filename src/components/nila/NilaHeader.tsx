import { Globe, Volume2, FileText, X } from "lucide-react";
import { NilaMode, NilaStatus } from "@/hooks/useNilaVoiceAssistant";
import { NilaLang, getNilaT } from "@/lib/nilaI18n";
import { cn } from "@/lib/utils";

interface Props {
  status: NilaStatus;
  mode: NilaMode;
  lang: NilaLang;
  onToggleLang: () => void;
  onToggleVoiceSelector: () => void;
  onDownloadPdf: () => void;
  onClose: () => void;
  hasMessages: boolean;
}

const statusDotColor: Record<NilaStatus, string> = {
  ready: "bg-gray-400",
  listening: "bg-blue-400 animate-pulse",
  processing: "bg-yellow-400 animate-pulse",
  speaking: "bg-purple-400 animate-pulse",
};

export function NilaHeader({ status, mode, lang, onToggleLang, onToggleVoiceSelector, onDownloadPdf, onClose, hasMessages }: Props) {
  const t = getNilaT(lang);
  const modeLabels: Record<NilaMode, string> = {
    normal: t.modeNormal,
    silent: t.modeSilent,
    translate: t.modeTranslate,
  };
  const statusLabels: Record<NilaStatus, string> = {
    ready: t.ready,
    listening: t.listening,
    processing: t.processing,
    speaking: t.speaking,
  };

  return (
    <div className="w-full flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold nila-gradient-text">{t.title}</h1>
        <div className="flex items-center gap-1.5">
          <span className={cn("w-2 h-2 rounded-full", statusDotColor[status])} />
          <span className="text-xs text-gray-400">{statusLabels[status]}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-gray-300 border border-white/10">
          {modeLabels[mode]}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={onToggleVoiceSelector} className="p-2 rounded-full hover:bg-white/10 transition-colors" aria-label={t.selectVoice}>
          <Volume2 className="w-4 h-4 text-gray-400" />
        </button>
        <button onClick={onToggleLang} className="p-2 rounded-full hover:bg-white/10 transition-colors" aria-label="Toggle language">
          <Globe className="w-4 h-4 text-gray-400" />
        </button>
        {hasMessages && (
          <button onClick={onDownloadPdf} className="p-2 rounded-full hover:bg-white/10 transition-colors" aria-label={t.downloadPdf}>
            <FileText className="w-4 h-4 text-gray-400" />
          </button>
        )}
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors" aria-label="Close">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>
    </div>
  );
}
