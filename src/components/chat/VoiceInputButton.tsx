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
  const isDisabled = disabled || !isSupported;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={isSupported ? onToggle : undefined}
          disabled={isDisabled}
          aria-label={isListening ? "Stop voice input" : "Voice input"}
          className={cn(
            "p-2 rounded-md transition-all",
            isListening
              ? "text-destructive bg-destructive/10 animate-pulse"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            isDisabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {isListening ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {!isSupported ? "Voice not supported in this browser" : isListening ? "Stop voice input" : "Voice input"}
      </TooltipContent>
    </Tooltip>
  );
}
