import { useEffect, useRef, useState } from "react";
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
  starterPrompt?: string;
  starterPromptSeed?: number;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function usePreviewUrl(file: File | null) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  return previewUrl;
}

interface ReferenceUploadCardProps {
  label: string;
  hint: string;
  file: File | null;
  previewUrl: string | null;
  icon: typeof ImagePlus;
  disabled?: boolean;
  onPick: () => void;
  onClear: () => void;
}

function ReferenceUploadCard({
  label,
  hint,
  file,
  previewUrl,
  icon: Icon,
  disabled,
  onPick,
  onClear,
}: ReferenceUploadCardProps) {
  return (
    <div
      className={cn(
        "group relative min-h-[132px] flex-1 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] p-4 text-left transition-all",
        "hover:border-white/25 hover:bg-white/[0.08] hover:-translate-y-0.5",
        "disabled:opacity-40 disabled:cursor-not-allowed"
      )}
    >
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className="absolute inset-0 z-0"
        aria-label={`Upload ${label}`}
      />
      {file && previewUrl ? (
        <>
          <img src={previewUrl} alt={label} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15" />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white transition-colors hover:bg-black/70"
            aria-label={`Remove ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="relative z-10 flex h-full flex-col justify-end gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
              {label}
            </span>
            <span className="line-clamp-2 text-sm font-medium text-white">
              {file.name}
            </span>
          </div>
        </>
      ) : (
        <div className="relative z-10 flex h-full flex-col justify-between gap-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-white/80">
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-white">{label}</div>
            <div className="text-xs leading-5 text-white/55">{hint}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChatPromptBar({ onSubmit, disabled, starterPrompt, starterPromptSeed }: ChatPromptBarProps) {
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
  const introPreviewUrl = usePreviewUrl(introImage);
  const characterPreviewUrl = usePreviewUrl(characterImage);
  const outroPreviewUrl = usePreviewUrl(outroImage);

  const hasImages = !!(introImage || outroImage || characterImage);
  const canAutoGenerate = (selectedStyles.length > 0 && selectedProducts.length > 0) || hasImages;
  const selectedStyleLabels = selectedStyles
    .map((key) => IMAGE_STYLES.find((style) => style.key === key)?.label)
    .filter(Boolean) as string[];
  const selectedProductLabels = selectedProducts
    .map((key) => PRODUCT_ICONS.find((product) => product.key === key)?.label)
    .filter(Boolean) as string[];

  useEffect(() => {
    if (starterPrompt?.trim()) {
      setPrompt(starterPrompt.trim());
    }
  }, [starterPrompt, starterPromptSeed]);

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
        "If source footage is provided, structure the ad as an AI-edited post-ready sequence built around those uploaded clips.",
        "Make the ad feel polished and social-ready, with motion-design transitions, a strong intro beat, and a branded outro.",
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
      toast({
        title: "Prompt generation failed",
        description: getErrorMessage(err, "Please try again"),
        variant: "destructive",
      });
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




  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <input ref={introRef} type="file" accept="image/*" hidden onChange={handleIntroChange} />
        <ReferenceUploadCard
          label="Intro reference"
          hint="Set the opening frame, visual setting, or product reveal."
          file={introImage}
          previewUrl={introPreviewUrl}
          icon={ImagePlus}
          disabled={disabled}
          onPick={() => introRef.current?.click()}
          onClear={() => setIntroImage(null)}
        />

        <input ref={characterRef} type="file" accept="image/*" hidden onChange={handleCharacterChange} />
        <ReferenceUploadCard
          label="Character reference"
          hint="Keep a narrator or spokesperson consistent across scenes."
          file={characterImage}
          previewUrl={characterPreviewUrl}
          icon={UserRound}
          disabled={disabled}
          onPick={() => characterRef.current?.click()}
          onClear={() => setCharacterImage(null)}
        />

        <input ref={outroRef} type="file" accept="image/*" hidden onChange={handleOutroChange} />
        <ReferenceUploadCard
          label="Outro reference"
          hint="Anchor the final frame, CTA, or branded closing shot."
          file={outroImage}
          previewUrl={outroPreviewUrl}
          icon={ImagePlus}
          disabled={disabled}
          onPick={() => outroRef.current?.click()}
          onClear={() => setOutroImage(null)}
        />
      </div>




      <div className="flex flex-wrap gap-2">
        {selectedStyleLabels.map((label) => (
          <span
            key={`style-${label}`}
            className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-100"
          >
            Style: {label}
          </span>
        ))}
        {selectedProductLabels.map((label) => (
          <span
            key={`product-${label}`}
            className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-50"
          >
            Product: {label}
          </span>
        ))}
        {!selectedStyleLabels.length && !selectedProductLabels.length && !hasImages && (
          <p className="px-1 text-xs text-white/45">
            Add references, source clips, or pick styles and products to guide the generated draft.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-sm transition-colors focus-within:border-white/15">
        <div className="px-4 pt-3 pb-1">
          <p className="text-sm font-medium text-white/80">Describe the ad or how AI should edit your footage</p>
        </div>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Example: Edit these uploaded jobsite clips into a 30 second contractor ad with an energetic intro, After Effects-style transitions, clear product proof, and a strong closing CTA to request a quote."
          disabled={disabled}
          rows={6}
          className="w-full resize-none bg-transparent px-4 pt-4 text-sm leading-6 text-white placeholder:text-white/35 focus:outline-none disabled:opacity-50"
        />

        <div className="space-y-3 px-3 pb-3 pt-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border",
                    ratio !== "16:9"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-white/10 border-white/20 text-white/80 hover:bg-white/20"
                  )}
                >
                  <RatioIcon className="w-3.5 h-3.5" />
                  {ratio}
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
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border",
                    duration !== "15"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-white/10 border-white/20 text-white/80 hover:bg-white/20"
                  )}
                >
                  <Timer className="w-3.5 h-3.5" />
                  {DURATIONS.find(d => d.value === duration)?.label || "15s"}
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
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border",
                    selectedStyles.length > 0
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-white/10 border-white/20 text-white/80 hover:bg-white/20"
                  )}
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                  Style
                  {selectedStyles.length > 0 && (
                    <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                      {selectedStyles.length}
                    </span>
                  )}
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
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border",
                    selectedProducts.length > 0
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-white/10 border-white/20 text-white/80 hover:bg-white/20"
                  )}
                >
                  <Hash className="w-3.5 h-3.5" />
                  Products
                  {selectedProducts.length > 0 && (
                    <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                      {selectedProducts.length}
                    </span>
                  )}
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
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all border",
                    selectedVideoModel.key !== "wan2.6-t2v"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-white/10 border-white/20 text-white/80 hover:bg-white/20"
                  )}
                >
                  <Clapperboard className="w-3.5 h-3.5" />
                  {selectedVideoModel.label}
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

          <div className="flex items-center justify-end gap-2">

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleAutoGenerate}
                    disabled={!canAutoGenerate || isAutoGenerating || disabled}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-all",
                      canAutoGenerate && !isAutoGenerating
                        ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                        : "cursor-not-allowed border-white/10 bg-white/[0.04] text-white/40"
                    )}
                  >
                    {isAutoGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Draft with AI
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {canAutoGenerate ? "Build a structured ad brief from your references" : "Select a style and product or upload an image"}
                </TooltipContent>
              </Tooltip>

              <Button
                onClick={handleSubmit}
                disabled={!prompt.trim() || disabled}
                className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950 hover:bg-white/90"
              >
                Create video
                <Send className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
