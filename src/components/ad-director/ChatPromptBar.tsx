import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Send, X, ImagePlus, UserRound, ChevronDown, Hash, Paintbrush, RatioIcon, Timer, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera, Building2, HardHat, Cpu, TreePine, Megaphone, Flame, Smile, Clapperboard, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FiberglassIcon, StirrupIcon, CageIcon, HookIcon,
  DowelIcon, WireMeshIcon, StraightRebarIcon,
} from "@/components/chat/ProductIcons";

const VIDEO_MODELS = [
  { key: "wan2.6-t2v", provider: "wan", label: "Wan T2V", description: "Text to Video - 1080P" },
  { key: "wan2.6-i2v", provider: "wan", label: "Wan I2V", description: "Image to Video" },
  { key: "wan2.6-i2v-flash", provider: "wan", label: "Wan I2V Flash", description: "Fast Image to Video" },
  { key: "veo-3.1-generate-preview", provider: "veo", label: "Veo 3.1", description: "Google Video Gen" },
  { key: "sora-2", provider: "sora", label: "Sora 2", description: "OpenAI Video Gen" },
] as const;

const RATIOS = ["16:9", "9:16", "1:1", "4:3"] as const;
const DURATIONS = [
  { label: "15s", value: "15" },
  { label: "30s", value: "30" },
  { label: "1min", value: "60" },
] as const;

const IMAGE_STYLES = [
  { key: "realism", label: "Realism", icon: Camera, color: "#10b981" },
  { key: "urban", label: "Urban", icon: Building2, color: "#6366f1" },
  { key: "construction", label: "Construction", icon: HardHat, color: "#f59e0b" },
  { key: "ai_modern", label: "AI & Modern", icon: Cpu, color: "#06b6d4" },
  { key: "nature", label: "Nature", icon: TreePine, color: "#22c55e" },
  { key: "advertising", label: "Advertising", icon: Megaphone, color: "#ec4899" },
  { key: "inspirational", label: "Inspirational", icon: Flame, color: "#f97316" },
  { key: "cartoon", label: "Cartoon", icon: Smile, color: "#a855f7" },
  { key: "animation", label: "Animation", icon: Clapperboard, color: "#8b5cf6" },
  { key: "painting", label: "Painting", icon: Palette, color: "#e11d48" },
] as const;

const PRODUCT_ICONS = [
  { key: "fiberglass", label: "Fiberglass", icon: FiberglassIcon, color: "#22c55e", shape: "rounded-full" },
  { key: "stirrups", label: "Stirrups", icon: StirrupIcon, color: "#f97316", shape: "rounded-none" },
  { key: "cages", label: "Cages", icon: CageIcon, color: "#3b82f6", shape: "rounded-lg" },
  { key: "hooks", label: "Hooks", icon: HookIcon, color: "#eab308", shape: "rounded-full" },
  { key: "dowels", label: "Dowels", icon: DowelIcon, color: "#ef4444", shape: "rounded-md" },
  { key: "wire_mesh", label: "Wire Mesh", icon: WireMeshIcon, color: "#a855f7", shape: "rounded-none" },
  { key: "straight", label: "Rebar Straight", icon: StraightRebarIcon, color: "#6b7280", shape: "rounded-xl" },
] as const;

interface ChatPromptBarProps {
  onSubmit: (
    prompt: string,
    ratio: string,
    images: File[],
    introImage: File | null,
    outroImage: File | null,
    duration: string,
    characterImage: File | null,
    selectedProducts?: string[],
    selectedStyles?: string[],
    videoModel?: string,
    videoProvider?: string,
  ) => void;
  disabled?: boolean;
}

export function ChatPromptBar({ onSubmit, disabled }: ChatPromptBarProps) {
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<string>("16:9");
  const [duration, setDuration] = useState<string>("15");
  const [introImage, setIntroImage] = useState<File | null>(null);
  const [outroImage, setOutroImage] = useState<File | null>(null);
  const [characterImage, setCharacterImage] = useState<File | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedVideoModel, setSelectedVideoModel] = useState(VIDEO_MODELS[0]);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const introRef = useRef<HTMLInputElement>(null);
  const outroRef = useRef<HTMLInputElement>(null);
  const characterRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const canAutoGenerate = selectedStyles.length > 0 && selectedProducts.length > 0;

  const handleAutoGenerate = async () => {
    if (!canAutoGenerate || isAutoGenerating) return;
    setIsAutoGenerating(true);
    try {
      const productLabels = selectedProducts.map(k => PRODUCT_ICONS.find(p => p.key === k)?.label || k).join(", ");
      const styleLabels = selectedStyles.map(k => IMAGE_STYLES.find(s => s.key === k)?.label || k).join(", ");
      const dur = DURATIONS.find(d => d.value === duration)?.label || duration + "s";

      const { data, error } = await supabase.functions.invoke("ai-generic", {
        body: {
          prompt: `Products: ${productLabels}\nStyles: ${styleLabels}\nDuration: ${dur}\nAspect Ratio: ${ratio}`,
          systemPrompt: "You are a cinematic video ad prompt writer for a construction/rebar company. Write a single concise, vivid video prompt (2-3 sentences) for the given parameters. Return ONLY the prompt text, no quotes or extra formatting.",
          model: "google/gemini-2.5-flash",
        },
      });

      if (error) throw error;
      const result = data?.result || data?.text || "";
      if (result) {
        setPrompt(result.trim());
        toast({ title: "✨ پرامپت آماده شد", description: "بررسی کنید و در صورت نیاز ویرایش کنید." });
      }
    } catch (err: any) {
      console.error("Auto-generate prompt error:", err);
      toast({ title: "خطا در تولید پرامپت", description: err.message || "لطفاً دوباره تلاش کنید", variant: "destructive" });
    } finally {
      setIsAutoGenerating(false);
    }
  };

  const handleSubmit = () => {
    if (!prompt.trim() || disabled) return;
    onSubmit(prompt.trim(), ratio, [], introImage, outroImage, duration, characterImage, selectedProducts, selectedStyles);
    setPrompt("");
    setIntroImage(null);
    setOutroImage(null);
    setCharacterImage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleIntroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setIntroImage(e.target.files[0]);
    e.target.value = "";
  };

  const handleOutroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setOutroImage(e.target.files[0]);
    e.target.value = "";
  };

  const handleCharacterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setCharacterImage(e.target.files[0]);
    e.target.value = "";
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      {/* Intro / Character / Outro upload boxes */}
      <div className="flex gap-4 justify-center">
        {/* Intro */}
        <input ref={introRef} type="file" accept="image/*" hidden onChange={handleIntroChange} />
        <button
          onClick={() => introRef.current?.click()}
          disabled={disabled}
          className={cn(
            "relative w-28 h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all",
            "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]",
            introImage ? "border-primary/40 bg-primary/5" : "border-border/40 bg-muted/10",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {introImage ? (
            <>
              <img src={URL.createObjectURL(introImage)} alt="Intro" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
              <div className="absolute inset-0 bg-background/40 rounded-xl" />
              <button onClick={(e) => { e.stopPropagation(); setIntroImage(null); }} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center z-10 hover:bg-destructive/20">
                <X className="w-3 h-3" />
              </button>
              <span className="relative z-10 text-[10px] font-medium text-foreground">Intro</span>
            </>
          ) : (
            <>
              <ImagePlus className="w-7 h-7 text-muted-foreground/60" />
              <span className="text-[10px] font-medium text-muted-foreground">Intro Image</span>
            </>
          )}
        </button>

        {/* Character */}
        <input ref={characterRef} type="file" accept="image/*" hidden onChange={handleCharacterChange} />
        <button
          onClick={() => characterRef.current?.click()}
          disabled={disabled}
          className={cn(
            "relative w-28 h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all",
            "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]",
            characterImage ? "border-primary/40 bg-primary/5" : "border-border/40 bg-muted/10",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {characterImage ? (
            <>
              <img src={URL.createObjectURL(characterImage)} alt="Character" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
              <div className="absolute inset-0 bg-background/40 rounded-xl" />
              <button onClick={(e) => { e.stopPropagation(); setCharacterImage(null); }} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center z-10 hover:bg-destructive/20">
                <X className="w-3 h-3" />
              </button>
              <span className="relative z-10 text-[10px] font-medium text-foreground">Character</span>
            </>
          ) : (
            <>
              <UserRound className="w-7 h-7 text-muted-foreground/60" />
              <span className="text-[10px] font-medium text-muted-foreground">Character 👤</span>
            </>
          )}
        </button>

        {/* Outro */}
        <input ref={outroRef} type="file" accept="image/*" hidden onChange={handleOutroChange} />
        <button
          onClick={() => outroRef.current?.click()}
          disabled={disabled}
          className={cn(
            "relative w-28 h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all",
            "hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]",
            outroImage ? "border-primary/40 bg-primary/5" : "border-border/40 bg-muted/10",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {outroImage ? (
            <>
              <img src={URL.createObjectURL(outroImage)} alt="Outro" className="absolute inset-0 w-full h-full object-cover rounded-xl" />
              <div className="absolute inset-0 bg-background/40 rounded-xl" />
              <button onClick={(e) => { e.stopPropagation(); setOutroImage(null); }} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 flex items-center justify-center z-10 hover:bg-destructive/20">
                <X className="w-3 h-3" />
              </button>
              <span className="relative z-10 text-[10px] font-medium text-foreground">Outro</span>
            </>
          ) : (
            <>
              <ImagePlus className="w-7 h-7 text-muted-foreground/60" />
              <span className="text-[10px] font-medium text-muted-foreground">Outro Image</span>
            </>
          )}
        </button>
      </div>

      {/* Main input area */}
      <div className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-sm shadow-lg overflow-hidden transition-shadow focus-within:shadow-xl focus-within:border-border/50">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your video idea..."
          disabled={disabled}
          rows={2}
          className="w-full resize-none bg-transparent px-4 pt-4 pb-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
        />

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Ratio Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border",
                    ratio !== "16:9"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <RatioIcon className="w-3.5 h-3.5" />
                  {ratio}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-auto p-2">
                <div className="grid grid-cols-4 gap-1">
                  {RATIOS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRatio(r)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        ratio === r
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Duration Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border",
                    duration !== "15"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Timer className="w-3.5 h-3.5" />
                  {DURATIONS.find(d => d.value === duration)?.label || "15s"}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-auto p-2">
                <div className="flex gap-1">
                  {DURATIONS.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setDuration(d.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                        duration === d.value
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Style Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border",
                    selectedStyles.length > 0
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  Style
                  {selectedStyles.length > 0 && (
                    <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                      {selectedStyles.length}
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-auto p-2">
                <div className="grid grid-cols-5 gap-1">
                  {IMAGE_STYLES.map((style) => {
                    const active = selectedStyles.includes(style.key);
                    const Icon = style.icon;
                    return (
                      <Tooltip key={style.key}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStyles(prev =>
                                active ? prev.filter(s => s !== style.key) : [...prev, style.key]
                              );
                            }}
                            className={cn(
                              "p-2 rounded-lg transition-all border-2",
                              active ? "border-current shadow-md scale-110" : "border-transparent hover:scale-105"
                            )}
                            style={{
                              color: style.color,
                              backgroundColor: active ? `${style.color}25` : `${style.color}10`,
                            }}
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">{style.label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {/* Products Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border",
                    selectedProducts.length > 0
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Hash className="w-3.5 h-3.5" />
                  Products
                  {selectedProducts.length > 0 && (
                    <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                      {selectedProducts.length}
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-auto p-2">
                <div className="grid grid-cols-4 gap-1">
                  {PRODUCT_ICONS.map((prod) => {
                    const active = selectedProducts.includes(prod.key);
                    const ProdIcon = prod.icon;
                    return (
                      <Tooltip key={prod.key}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProducts(prev =>
                                active ? prev.filter(p => p !== prod.key) : [...prev, prod.key]
                              );
                            }}
                            className={cn(
                              "p-2 transition-all border-2",
                              prod.shape,
                              active ? "border-current shadow-lg scale-110" : "border-transparent hover:scale-105"
                            )}
                            style={{
                              color: prod.color,
                              backgroundColor: active ? `${prod.color}25` : `${prod.color}10`,
                            }}
                          >
                            <ProdIcon className="w-5 h-5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">{prod.label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Auto-generate prompt */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleAutoGenerate}
                  disabled={!canAutoGenerate || isAutoGenerating || disabled}
                  className={cn(
                    "h-8 w-8 rounded-xl flex items-center justify-center transition-all border",
                    canAutoGenerate && !isAutoGenerating
                      ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 hover:scale-105"
                      : "bg-muted/40 border-border text-muted-foreground opacity-40 cursor-not-allowed"
                  )}
                >
                  {isAutoGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {canAutoGenerate ? "تولید خودکار پرامپت" : "ابتدا استایل و محصول را انتخاب کنید"}
              </TooltipContent>
            </Tooltip>

            {/* Send */}
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!prompt.trim() || disabled}
              className="h-8 w-8 rounded-xl p-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
