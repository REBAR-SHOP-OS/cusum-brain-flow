import { NILA_VOICES } from "@/hooks/useNilaVoiceAssistant";
import { cn } from "@/lib/utils";

interface Props {
  selectedVoice: string;
  onSelect: (voiceId: string) => void;
}

export function NilaVoiceSelector({ selectedVoice, onSelect }: Props) {
  return (
    <div className="w-full px-4 py-2 animate-[nila-fade-up_0.2s_ease-out]">
      <div className="flex gap-2 overflow-x-auto pb-1 nila-scrollbar">
        {NILA_VOICES.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              selectedVoice === v.id
                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg"
                : "bg-white/10 text-gray-400 hover:bg-white/15 border border-white/10"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
