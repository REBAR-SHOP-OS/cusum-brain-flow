import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, X, ImagePlus, UserRound, ChevronDown, Hash, Paintbrush, RatioIcon, Timer, Sparkles, Loader2, Wand2, CheckCircle2 } from "lucide-react";
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

const VIDEO_MODELS: { key: string; provider: string; label: string; description: string }[] = [
  { key: "wan2.6-t2v", provider: "wan", label: "Wan T2V", description: "Text to Video - 1080P" },
  { key: "wan2.6-i2v", provider: "wan", label: "Wan I2V", description: "Image to Video" },
  { key: "wan2.6-i2v-flash", provider: "wan", label: "Wan I2V Flash", description: "Fast Image to Video" },
  { key: "veo-3.1-generate-preview", provider: "veo", label: "Veo 3.1", description: "Google Video Gen" },
  { key: "sora-2", provider: "sora", label: "Sora 2", description: "OpenAI Video Gen" },
];

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

const PROMPT_STARTERS = [
  "Show the biggest pain point in the first 3 seconds, then reveal the product advantage.",
  "Make it feel premium, fast-moving, and built for B2B buyers who need confidence quickly.",
  "Close with a clear action the viewer should take after seeing the ad.",
] as const;

function useObjectUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url;
}

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
  const introPreview = useObjectUrl(introImage);
  const characterPreview = useObjectUrl(characterImage);
  const outroPreview = useObjectUrl(outroImage);

  const hasImages = !!(introImage || outroImage || characterImage);
  const canAutoGenerate = (selectedStyles.length > 0 && selectedProducts.length > 0) || hasImages;
  const selectedStyleLabels = selectedStyles.map((key) => IMAGE_STYLES.find((style) => style.key === key)?.label || key);
  const selectedProductLabels = selectedProducts.map((key) => PRODUCT_ICONS.find((product) => product.key === key)?.label || key);
  const selectedDurationLabel = DURATIONS.find((item) => item.value === duration)?.label || `${duration}s`;
  const selectionSummary = [
    `Format ${ratio}`,
    `Length ${selectedDurationLabel}`,
    selectedStyleLabels.length > 0 ? `Styles ${selectedStyleLabels.join(", ")}` : null,
    selectedProductLabels.length > 0 ? `Products ${selectedProductLabels.join(", ")}` : null,
    hasImages ? "Reference frames added" : null,
    `Model ${selectedVideoModel.label}`,
  ].filter(Boolean) as string[];

  const handleAutoGenerate = async () => {
    if (!canAutoGenerate || isAutoGenerating) return;
    setIsAutoGenerating(true);
    try {
      const productLabels = selectedProducts.map(k => PRODUCT_ICONS.find(p => p.key === k)?.label || k).join(", ");
      const styleLabels = selectedStyles.map(k => IMAGE_STYLES.find(s => s.key === k)?.label || k).join(", ");
      const dur = DURATIONS.find(d => d.value === duration)?.label || duration + "s";

      // Build context lines
      const contextLines: string[] = [];
      if (selectedProducts.length > 0) contextLines.push(`Products: ${productLabels}`);
      if (selectedStyles.length > 0) contextLines.push(`Styles: ${styleLabels}`);
      contextLines.push(`Duration: ${dur}`);
      contextLines.push(`Aspect Ratio: ${ratio}`);
      if (introImage) contextLines.push("Intro Image: YES — use as opening reference frame, start the video matching this image");
      if (characterImage) contextLines.push("Character Image: YES — maintain this person as the consistent narrator/subject across ALL scenes");
      if (outroImage) contextLines.push("Outro Image: YES — use as closing reference frame, end the video transitioning to match this image");

      const sceneCount = Math.max(1, Math.floor(parseInt(duration) / 15));
      contextLines.push(`Scene count: ${sceneCount} (each scene is exactly 15 seconds)`);

      const systemLines = [
        "You are a cinematic video ad prompt writer for a construction/rebar company.",
        `Write exactly ${sceneCount} scene(s) for a ${dur} video ad.`,
        "Each scene is exactly 15 seconds.",
        "Format each scene EXACTLY as follows:",
        "",
        "Scene X – Ys to Zs",
        "[Visual prompt: 1-2 sentences, cinematic, vivid, specific camera/lighting details]",
        "Voiceover:",
        "\"[Persuasive advertising copy, 1-2 sentences, suitable for text-to-speech]\"",
        "",
        "Separate scenes with a blank line.",
        "Return ONLY the formatted scenes. No extra text, no markdown, no explanations.",
      ];
      if (introImage) systemLines.push("An Intro Image is provided — Scene 1 must visually match and continue from the uploaded reference image.");
      if (characterImage) systemLines.push("A Character Image is provided — feature that person consistently as the narrator and main subject across ALL scenes. Describe their appearance for continuity.");
      if (outroImage) systemLines.push(`An Outro Image is provided — Scene ${sceneCount} must visually transition into and match the uploaded closing reference image.`);

      const { data, error } = await supabase.functions.invoke("ai-generic", {
        body: {
          prompt: contextLines.join("\n"),
          systemPrompt: systemLines.join("\n"),
          model: "google/gemini-2.5-flash",
        },
      });

      if (error) throw error;
      const rawResult = data?.result || data?.text || "";
      if (rawResult) {
        setPrompt(rawResult.trim());
        toast({ title: "✨ Prompt ready", description: `${sceneCount} scenes with voiceover generated. Review and edit.` });
      }
    } catch (err: unknown) {
      console.error("Auto-generate prompt error:", err);
      const message = err instanceof Error ? err.message : "Please try again";
      toast({ title: "Prompt generation failed", description: message, variant: "destructive" });
    } finally {
      setIsAutoGenerating(false);
    }
  };

  const handleSubmit = () => {
    if (!prompt.trim() || disabled) return;
    onSubmit(prompt.trim(), ratio, [], introImage, outroImage, duration, characterImage, selectedProducts, selectedStyles, selectedVideoModel.key, selectedVideoModel.provider);
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

  const referenceSlots = [
    {
      key: "intro",
      title: "Intro frame",
      description: "Anchor the opening shot.",
      emptyLabel: "Add intro image",
      icon: ImagePlus,
      file: introImage,
      previewUrl: introPreview,
      openPicker: () => introRef.current?.click(),
      clear: () => setIntroImage(null),
    },
    {
      key: "character",
      title: "Character",
      description: "Keep one person consistent.",
      emptyLabel: "Add character image",
      icon: UserRound,
      file: characterImage,
      previewUrl: characterPreview,
      openPicker: () => characterRef.current?.click(),
      clear: () => setCharacterImage(null),
    },
    {
      key: "outro",
      title: "Outro frame",
      description: "Guide the closing scene.",
      emptyLabel: "Add outro image",
      icon: ImagePlus,
      file: outroImage,
      previewUrl: outroPreview,
      openPicker: () => outroRef.current?.click(),
      clear: () => setOutroImage(null),
    },
  ] as const;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5">
      <input ref={introRef} type="file" accept="image/*" hidden onChange={handleIntroChange} />
      <input ref={characterRef} type="file" accept="image/*" hidden onChange={handleCharacterChange} />
      <input ref={outroRef} type="file" accept="image/*" hidden onChange={handleOutroChange} />

      <div className="grid gap-3 md:grid-cols-3">
        {referenceSlots.map((slot) => {
          const Icon = slot.icon;

          return (
            <div
              key={slot.key}
              role="button"
              tabIndex={disabled ? -1 : 0}
              onClick={() => !disabled && slot.openPicker()}
              onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  slot.openPicker();
                }
              }}
              className={cn(
                "group relative min-h-[168px] overflow-hidden rounded-[24px] border border-white/10 bg-white/5 p-4 text-left transition-all duration-200",
                "hover:border-white/25 hover:bg-white/[0.08] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary/40",
                slot.file && "border-primary/40 bg-primary/10 shadow-[0_18px_60px_-36px_hsl(var(--primary))]",
                disabled && "cursor-not-allowed opacity-40"
              )}
            >
              {slot.previewUrl && (
                <>
                  <img src={slot.previewUrl} alt={slot.title} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-br from-black/15 via-black/40 to-black/70" />
                </>
              )}

              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md">
                    <Icon className="h-5 w-5 text-white/85" />
                  </div>
                  {slot.file && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        slot.clear();
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 transition-colors hover:bg-destructive/20 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-auto space-y-1">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/55">
                    {slot.file ? "Reference locked" : "Optional input"}
                  </p>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white">{slot.title}</h3>
                    {slot.file && <CheckCircle2 className="h-4 w-4 text-emerald-300" />}
                  </div>
                  <p className="text-sm leading-relaxed text-white/70">
                    {slot.file ? slot.file.name : slot.description}
                  </p>
                  {!slot.file && (
                    <p className="text-xs text-white/45">{slot.emptyLabel}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[30px] border border-white/12 bg-black/45 shadow-[0_28px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-shadow focus-within:shadow-[0_32px_90px_-36px_rgba(10,214,196,0.32)]">
        <div className="border-b border-white/10 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-white/45">Idea brief</p>
              <div className="space-y-1">
                <h3 className="text-xl font-semibold text-white">Shape the concept before you render</h3>
                <p className="max-w-2xl text-sm leading-relaxed text-white/65">
                  Describe the hook, audience, proof point, and CTA. The goal stays the same: generate a polished video ad from your idea.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={handleAutoGenerate}
              disabled={!canAutoGenerate || isAutoGenerating || disabled}
              className="h-10 rounded-full border border-primary/25 bg-primary/10 px-4 text-primary hover:bg-primary/15 disabled:bg-white/5 disabled:text-white/40"
            >
              {isAutoGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Draft from selections
            </Button>
          </div>
        </div>

        <div className="px-5 pt-5 sm:px-6">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your video idea, the customer pain, the proof, and the final action..."
            disabled={disabled}
            rows={7}
            className="min-h-[200px] w-full resize-none rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-4 text-sm leading-7 text-white placeholder:text-white/35 focus:outline-none disabled:opacity-50"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            {PROMPT_STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                disabled={disabled}
                onClick={() => setPrompt((current) => (current.trim() ? `${current.trim()}\n${starter}` : starter))}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-left text-xs text-white/72 transition-colors hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-50"
              >
                {starter}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Ratio Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-all",
                    ratio !== "16:9"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-white/[0.06] border-white/12 text-white/80 hover:bg-white/10"
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
                    "flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-all",
                    duration !== "15"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-white/[0.06] border-white/12 text-white/80 hover:bg-white/10"
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
                    "flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-all",
                    selectedStyles.length > 0
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-white/[0.06] border-white/12 text-white/80 hover:bg-white/10"
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
                    "flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-all",
                    selectedProducts.length > 0
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-white/[0.06] border-white/12 text-white/80 hover:bg-white/10"
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

            {/* Video Model Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-all",
                    selectedVideoModel.key !== "wan2.6-t2v"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-white/[0.06] border-white/12 text-white/80 hover:bg-white/10"
                  )}
                >
                  <Clapperboard className="w-3.5 h-3.5" />
                  {selectedVideoModel.label}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-56 p-2">
                <div className="space-y-1">
                  {VIDEO_MODELS.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelectedVideoModel(m)}
                      className={cn(
                        "w-full flex flex-col items-start px-3 py-2 rounded-lg text-xs transition-all",
                        selectedVideoModel.key === m.key
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span className="font-medium">{m.label}</span>
                      <span className={cn("text-[10px]", selectedVideoModel.key === m.key ? "text-primary-foreground/70" : "opacity-60")}>{m.description}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {selectionSummary.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/68"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="inline-flex cursor-help items-center gap-1 text-xs text-white/46">
                    <Sparkles className="h-3.5 w-3.5" />
                    {canAutoGenerate ? "Auto-draft is ready." : "Add styles + products or upload a reference to unlock auto-draft."}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {canAutoGenerate ? "Selections will be turned into a multi-scene prompt." : "Auto-draft needs product/style context or at least one reference frame."}
                </TooltipContent>
              </Tooltip>
            </div>

            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={!prompt.trim() || disabled}
              className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
            >
              Generate video plan
              <Send className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
