import { Mic, MicOff, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

interface LangOption {
  name: string;
  flag: string;
}

interface VoiceInputButtonProps {
  isListening: boolean;
  isSupported: boolean;
  onToggle: () => void;
  disabled?: boolean;
  lang?: string;
  onLangChange?: (lang: string) => void;
  languages?: Record<string, LangOption>;
}

const DEFAULT_LANGUAGES: Record<string, LangOption> = {
  en: { name: "English", flag: "🇬🇧" },
  fa: { name: "فارسی", flag: "🇮🇷" },
  ar: { name: "العربية", flag: "🇸🇦" },
  es: { name: "Español", flag: "🇪🇸" },
  fr: { name: "Français", flag: "🇫🇷" },
  hi: { name: "हिन्दी", flag: "🇮🇳" },
  zh: { name: "中文", flag: "🇨🇳" },
  de: { name: "Deutsch", flag: "🇩🇪" },
  tr: { name: "Türkçe", flag: "🇹🇷" },
  pt: { name: "Português", flag: "🇧🇷" },
  ru: { name: "Русский", flag: "🇷🇺" },
  ko: { name: "한국어", flag: "🇰🇷" },
  ja: { name: "日本語", flag: "🇯🇵" },
  ur: { name: "اردو", flag: "🇵🇰" },
};

export function VoiceInputButton({
  isListening,
  isSupported,
  onToggle,
  disabled,
  lang = "en",
  onLangChange,
  languages,
}: VoiceInputButtonProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const langs = languages || DEFAULT_LANGUAGES;
  const current = langs[lang] || { name: lang, flag: "🌐" };
  const isDisabled = disabled || !isSupported;

  return (
    <div className="flex items-center">
      {/* Language selector */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isDisabled}
            className={cn(
              "flex items-center gap-0.5 px-1.5 py-1 rounded-l-md text-xs transition-all",
              "border border-r-0 border-border",
              isListening
                ? "bg-destructive/10 border-destructive/30"
                : "bg-muted/40 hover:bg-muted/70",
              isDisabled && "opacity-50 cursor-not-allowed"
            )}
            title="Select language"
          >
            <span className="text-sm leading-none">{current.flag}</span>
            <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="w-48 p-1 max-h-64 overflow-y-auto"
        >
          {Object.entries(langs).map(([code, info]) => (
            <button
              key={code}
              onClick={() => {
                onLangChange?.(code);
                setPopoverOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                code === lang
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted/60 text-foreground"
              )}
            >
              <span className="text-base leading-none">{info.flag}</span>
              <span className="truncate">{info.name}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Mic toggle */}
      <button
        type="button"
        onClick={isSupported ? onToggle : undefined}
        disabled={isDisabled}
        aria-label={isListening ? "Stop voice input" : "Voice input"}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-r-md transition-all",
          "border border-border",
          isListening
            ? "bg-destructive/10 text-destructive border-destructive/30 animate-pulse"
            : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/70",
          isDisabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {isListening ? (
          <>
            <MicOff className="w-4 h-4" />
            <span className="text-[10px] font-medium hidden md:inline">
              {current.flag} Listening...
            </span>
          </>
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}
