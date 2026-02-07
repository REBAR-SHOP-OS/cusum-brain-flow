import { useState } from "react";
import { X, Sparkles, MessageSquare, Globe, Pencil, Search, ToggleLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface AgentSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  agentImage: string;
}

const vibeOptions = [
  { value: "professional", label: "Professional", emoji: "💼" },
  { value: "business-casual", label: "Business Casual", emoji: "👔" },
  { value: "casual", label: "Casual", emoji: "😎" },
  { value: "friendly", label: "Friendly", emoji: "🤗" },
  { value: "technical", label: "Technical", emoji: "🔧" },
];

const messageLengthOptions = ["Short", "Medium", "Long"];

const languageOptions = [
  { value: "basic", label: "Basic", icon: Globe },
  { value: "casual", label: "Casual", icon: Pencil },
  { value: "expert", label: "Expert", icon: Sparkles },
];

export function AgentSettingsDialog({
  open,
  onOpenChange,
  agentName,
  agentImage,
}: AgentSettingsDialogProps) {
  const [vibe, setVibe] = useState("business-casual");
  const [messageLength, setMessageLength] = useState("Medium");
  const [language, setLanguage] = useState("casual");
  const [searchGoogle, setSearchGoogle] = useState(true);
  const [writingStyle, setWritingStyle] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  if (!open) return null;

  const vibeIndex = vibeOptions.findIndex((v) => v.value === vibe);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => onOpenChange(false)}>
      <div
        className="w-full max-w-md max-h-[90vh] bg-card rounded-2xl shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex-1" />
          <div className="text-center">
            <h2 className="font-semibold">{agentName}</h2>
            <p className="text-xs text-muted-foreground">Conversation Settings</p>
          </div>
          <div className="flex-1 flex justify-end">
            <button
              onClick={() => onOpenChange(false)}
              className="p-1 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Vibe */}
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Vibe</span>
            <p className="font-semibold flex items-center gap-2">
              {vibeOptions.find((v) => v.value === vibe)?.label}{" "}
              {vibeOptions.find((v) => v.value === vibe)?.emoji}
            </p>
            <div className="relative h-10 bg-gradient-to-r from-primary to-accent rounded-full flex items-center px-1">
              {vibeOptions.map((opt, i) => (
                <button
                  key={opt.value}
                  onClick={() => setVibe(opt.value)}
                  className="flex-1 h-full relative z-10"
                  title={opt.label}
                >
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full mx-auto transition-all",
                      vibe === opt.value ? "bg-transparent" : "bg-primary-foreground/40"
                    )}
                  />
                </button>
              ))}
              {/* Thumb */}
              <div
                className="absolute w-8 h-8 rounded-full bg-card border-2 border-primary shadow-lg transition-all duration-200"
                style={{
                  left: `calc(${(vibeIndex / (vibeOptions.length - 1)) * 100}% - ${vibeIndex === 0 ? 4 : vibeIndex === vibeOptions.length - 1 ? 28 : 16}px)`,
                  top: "4px",
                }}
              />
            </div>
          </div>

          {/* Message Length */}
          <div className="space-y-2">
            <span className="font-semibold">Message Length</span>
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {messageLengthOptions.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setMessageLength(opt)}
                  className={cn(
                    "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
                    messageLength === opt
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="space-y-2">
            <span className="font-semibold">Language</span>
            <div className="grid grid-cols-3 gap-2">
              {languageOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLanguage(opt.value)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-colors",
                    language === opt.value
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  <opt.icon className="w-6 h-6" />
                  <span className="text-sm font-medium">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Traits */}
          <div className="space-y-3">
            <span className="font-semibold">Traits</span>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">Search Google</span>
                <Switch checked={searchGoogle} onCheckedChange={setSearchGoogle} />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm">Writing Style</span>
                <Switch checked={writingStyle} onCheckedChange={setWritingStyle} />
              </div>
            </div>
          </div>

          {/* Custom Instructions */}
          <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <span className="font-semibold">Custom Instructions</span>
              <ChevronDown
                className={cn(
                  "w-5 h-5 text-muted-foreground transition-transform",
                  instructionsOpen && "rotate-180"
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder={`Tell ${agentName} how to respond...`}
                className="min-h-[100px] resize-none"
              />
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
