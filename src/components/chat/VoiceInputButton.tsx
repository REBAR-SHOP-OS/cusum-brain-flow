import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface VoiceInputButtonProps {
  isListening: boolean;
  isSupported: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function VoiceInputButton({ isListening, isSupported, onToggle, disabled }: VoiceInputButtonProps) {
  if (!isSupported) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          className={cn(
            "p-2 rounded-md transition-all",
            isListening
              ? "text-destructive bg-destructive/10 animate-pulse"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          title={isListening ? "Stop recording" : "Voice input"}
        >
          {isListening ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {isListening ? "Stop voice input" : "Voice input"}
      </TooltipContent>
    </Tooltip>
  );
}
