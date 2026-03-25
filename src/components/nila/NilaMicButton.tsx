import { Mic, MicOff } from "lucide-react";
import { NilaStatus } from "@/hooks/useNilaVoiceAssistant";
import { cn } from "@/lib/utils";

interface Props {
  isRecognizing: boolean;
  status: NilaStatus;
  onToggle: () => void;
}

export function NilaMicButton({ isRecognizing, status, onToggle }: Props) {
  const isListening = status === "listening";
  const isSpeaking = status === "speaking";

  return (
    <div className="relative flex items-center justify-center">
      {/* Pulse rings */}
      {isListening && (
        <>
          <span className="absolute w-[88px] h-[88px] rounded-full border-2 border-blue-400/40 animate-[nila-pulse-ring_2s_ease-out_infinite]" />
          <span className="absolute w-[88px] h-[88px] rounded-full border-2 border-blue-400/20 animate-[nila-pulse-ring_2s_ease-out_infinite_0.5s]" />
        </>
      )}
      {isSpeaking && (
        <>
          <span className="absolute w-[88px] h-[88px] rounded-full border-2 border-purple-400/40 animate-[nila-pulse-ring_2s_ease-out_infinite]" />
          <span className="absolute w-[88px] h-[88px] rounded-full border-2 border-purple-400/20 animate-[nila-pulse-ring_2s_ease-out_infinite_0.5s]" />
        </>
      )}
      <button
        onClick={onToggle}
        className={cn(
          "relative z-10 w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-300",
          isRecognizing
            ? "bg-gradient-to-br from-blue-500 to-purple-600 shadow-[0_0_30px_rgba(99,102,241,0.5)]"
            : "bg-white/10 hover:bg-white/15 border border-white/20"
        )}
        aria-label={isRecognizing ? "Stop microphone" : "Start microphone"}
      >
        {isRecognizing ? (
          <Mic className="w-7 h-7 text-white" />
        ) : (
          <MicOff className="w-7 h-7 text-gray-400" />
        )}
      </button>
    </div>
  );
}
