import { useState, useRef } from "react";
import {
  Video, Image, Music, Zap, Film, Crown, Sparkles, Loader2,
  ChevronDown, Eye, EyeOff, Gauge, Upload, X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type GenerationMode = "fast" | "balanced" | "premium";

interface ModeOption {
  id: GenerationMode;
  label: string;
  icon: React.ReactNode;
  badge: string;
}

const modes: ModeOption[] = [
  { id: "fast", label: "Fast", icon: <Zap className="w-3.5 h-3.5" />, badge: "~2 min" },
  { id: "balanced", label: "Balanced", icon: <Film className="w-3.5 h-3.5" />, badge: "~3 min" },
  { id: "premium", label: "Premium", icon: <Crown className="w-3.5 h-3.5" />, badge: "~5 min" },
];

const aspectOptions = [
  { value: "16:9", label: "16:9", icon: "🖥️" },
  { value: "9:16", label: "9:16", icon: "📱" },
  { value: "1:1", label: "1:1", icon: "⬜" },
];

const durationOptionsMap: Record<GenerationMode, { value: string; label: string }[]> = {
  fast: [{ value: "4", label: "4s" }, { value: "8", label: "8s" }, { value: "12", label: "12s" }],
  balanced: [{ value: "4", label: "4s" }, { value: "6", label: "6s" }, { value: "8", label: "8s" }],
  premium: [{ value: "4", label: "4s" }, { value: "8", label: "8s" }, { value: "12", label: "12s" }],
};

const suggestions = [
  "drone shot of a construction site at golden hour",
  "machine cutting steel bars fast with sparks",
  "workers installing rebar cages on a bridge",
  "premium product showcase with cinematic lighting",
];

interface VideoStudioPromptBarProps {
  rawPrompt: string;
  onPromptChange: (val: string) => void;
  mode: GenerationMode;
  onModeChange: (m: GenerationMode) => void;
  duration: string;
  onDurationChange: (d: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (ar: string) => void;
  showEngineered: boolean;
  onToggleEngineered: () => void;
  engineeredPrompt?: string | null;
  intent?: string | null;
  isConstructionRelated?: boolean;
  creditCost: number;
  remaining: number;
  canGenerate: boolean;
  isGenerating: boolean;
  isTransforming: boolean;
  onGenerate: () => void;
  referenceImage?: string | null;
  onReferenceImageChange?: (url: string | null) => void;
}

export function VideoStudioPromptBar({
  rawPrompt, onPromptChange, mode, onModeChange,
  duration, onDurationChange, aspectRatio, onAspectRatioChange,
  showEngineered, onToggleEngineered, engineeredPrompt, intent,
  isConstructionRelated, creditCost, remaining, canGenerate,
  isGenerating, isTransforming, onGenerate, referenceImage, onReferenceImageChange,
}: VideoStudioPromptBarProps) {
  const [modeOpen, setModeOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const [aspectOpen, setAspectOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentMode = modes.find(m => m.id === mode) || modes[1];
  const currentAspect = aspectOptions.find(a => a.value === aspectRatio) || aspectOptions[0];
  const currentDuration = durationOptionsMap[mode].find(d => d.value === duration) || durationOptionsMap[mode][0];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onReferenceImageChange?.(url);
  };

  return (
    <div className="w-full">
      {/* Suggestion chips - shown when prompt is empty */}
      {!rawPrompt.trim() && (
        <div className="flex flex-wrap gap-2 mb-3 px-1">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onPromptChange(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-border/50 bg-card/50 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Main prompt bar */}
      <div className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-lg overflow-hidden">
        {/* Top: Textarea row */}
        <div className="flex items-start gap-0">
          {/* Left icon strip */}
          <div className="flex flex-col gap-1 p-3 pr-0">
            <button className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/50 text-muted-foreground/50 cursor-default" title="Image mode (coming soon)">
              <Image className="w-4 h-4" />
            </button>
            <button className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/15 text-primary ring-1 ring-primary/30" title="Video mode">
              <Video className="w-4 h-4" />
            </button>
            <button className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/50 text-muted-foreground/50 cursor-default" title="Audio mode (coming soon)">
              <Music className="w-4 h-4" />
            </button>
          </div>

          {/* Textarea */}
          <div className="flex-1 py-3 px-3">
            <textarea
              value={rawPrompt}
              onChange={(e) => onPromptChange(e.target.value)}
              placeholder="Describe the video you want to create..."
              disabled={isGenerating || isTransforming}
              rows={3}
              className="w-full bg-transparent text-foreground text-sm placeholder:text-muted-foreground/60 resize-none outline-none border-none focus:ring-0 leading-relaxed"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onGenerate();
                }
              }}
            />
            {/* Reference image preview */}
            {referenceImage && (
              <div className="flex items-center gap-2 mt-1">
                <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border/50">
                  <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                  <button
                    onClick={() => onReferenceImageChange?.(null)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground">Reference image</span>
              </div>
            )}
          </div>

          {/* Right: Generate button */}
          <div className="flex flex-col items-center justify-center p-3 pl-0 gap-2">
            <button
              onClick={onGenerate}
              disabled={!rawPrompt.trim() || isGenerating || isTransforming || !canGenerate}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all",
                "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground",
                "hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02]",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
              )}
            >
              {isGenerating || isTransforming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isTransforming ? "Engineering..." : isGenerating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>

        {/* Bottom: Pill chips row */}
        <div className="flex items-center gap-2 px-3 pb-3 pt-0 flex-wrap">
          {/* Mode pill */}
          <Popover open={modeOpen} onOpenChange={setModeOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground border border-border/30 transition-colors">
                {currentMode.icon}
                {currentMode.label}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-1" align="start">
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { onModeChange(m.id); setModeOpen(false); }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors",
                    mode === m.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  )}
                >
                  {m.icon}
                  <span className="flex-1 text-left">{m.label}</span>
                  <span className="text-[10px] text-muted-foreground">{m.badge}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Aspect ratio pill */}
          <Popover open={aspectOpen} onOpenChange={setAspectOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground border border-border/30 transition-colors">
                <span>{currentAspect.icon}</span>
                {currentAspect.label}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-36 p-1" align="start">
              {aspectOptions.map((a) => (
                <button
                  key={a.value}
                  onClick={() => { onAspectRatioChange(a.value); setAspectOpen(false); }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors",
                    aspectRatio === a.value ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  )}
                >
                  <span>{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Duration pill */}
          <Popover open={durationOpen} onOpenChange={setDurationOpen}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground border border-border/30 transition-colors">
                ⏱ {currentDuration.label}
                <ChevronDown className="w-3 h-3 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-32 p-1" align="start">
              {durationOptionsMap[mode].map((d) => (
                <button
                  key={d.value}
                  onClick={() => { onDurationChange(d.value); setDurationOpen(false); }}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors",
                    duration === d.value ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Reference image upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground border border-border/30 transition-colors"
          >
            <Upload className="w-3 h-3" />
            {referenceImage ? "Change ref" : "Ref image"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Engineered prompt toggle */}
          {engineeredPrompt && (
            <button
              onClick={onToggleEngineered}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground border border-border/30 transition-colors"
            >
              {showEngineered ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              Prompt
            </button>
          )}

          {/* Intent badge */}
          {intent && intent !== "cinematic_broll" && (
            <Badge variant="outline" className="text-[10px] h-5 px-2 bg-primary/10 text-primary border-primary/20 rounded-full">
              {intent.replace(/_/g, " ")}
            </Badge>
          )}
          {isConstructionRelated && (
            <Badge variant="outline" className="text-[10px] h-5 px-2 bg-warning/10 text-warning border-warning/20 rounded-full">
              Construction
            </Badge>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Credits indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-muted/40 text-muted-foreground border border-border/20">
            <Gauge className="w-3 h-3" />
            <span>{remaining}s</span>
            {rawPrompt.trim() && (
              <span className="text-[10px] opacity-70">• Cost: {creditCost}s</span>
            )}
          </div>
        </div>

        {/* Engineered prompt preview */}
        {showEngineered && engineeredPrompt && (
          <div className="px-3 pb-3">
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30 text-xs text-muted-foreground leading-relaxed">
              {engineeredPrompt}
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-center text-muted-foreground/50 mt-2">
        ⌘+Enter to generate • Powered by Google Veo 3.1 &amp; OpenAI Sora
      </p>
    </div>
  );
}
