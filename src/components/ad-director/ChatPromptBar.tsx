import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, X, ImagePlus, UserRound, ChevronDown, Hash, Paintbrush, RatioIcon, Timer, Wand2, Loader2, UserSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { useToast } from "@/hooks/use-toast";
import { Camera, Building2, HardHat, Cpu, TreePine, Megaphone, Flame, Smile, Clapperboard, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FiberglassIcon, StirrupIcon, CageIcon, HookIcon,
  DowelIcon, WireMeshIcon, StraightRebarIcon,
} from "@/components/chat/ProductIcons";
import { AIPromptDialog } from "./AIPromptDialog";
import { CharacterPromptDialog } from "./CharacterPromptDialog";
import companyLogo from "@/assets/company-logo.png";

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
    characterPrompt?: string,
  ) => void;
  disabled?: boolean;
  starterPrompt?: string;
  starterPromptSeed?: number;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
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
  lockBadge?: string;
  /** Optional inline prompt button (e.g. for character direction). Shown only when an image is uploaded. */
  onPromptClick?: () => void;
  hasPrompt?: boolean;
  promptTooltip?: string;
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
  lockBadge,
  onPromptClick,
  hasPrompt,
  promptTooltip,
}: ReferenceUploadCardProps) {
  return (
    <div
      className={cn(
        "group relative min-h-[132px] flex-1 overflow-hidden rounded-2xl border border-white/10 bg-slate-800/60 p-4 text-left transition-all",
        "hover:border-white/20 hover:bg-slate-800/80 hover:-translate-y-0.5",
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
          <img src={previewUrl} alt={label} className="absolute inset-0 h-full w-full object-cover pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/15 pointer-events-none" />
          {onPromptClick && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onPromptClick();
              }}
              className={cn(
                "absolute left-3 top-3 z-10 pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur transition-colors",
                hasPrompt
                  ? "border-cyan-300/60 bg-cyan-500/40 text-white hover:bg-cyan-500/60"
                  : "border-white/30 bg-black/45 text-white hover:bg-black/70"
              )}
              aria-label={promptTooltip || `Edit ${label} prompt`}
              title={promptTooltip || `Edit ${label} prompt`}
            >
              <Wand2 className="h-3.5 w-3.5" />
              {hasPrompt && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan-200 ring-2 ring-slate-900" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            className="absolute right-3 top-3 z-10 pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white transition-colors hover:bg-black/70"
            aria-label={`Remove ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="relative z-10 pointer-events-none flex h-full flex-col justify-end gap-1">
            {lockBadge && (
              <span className="self-start mb-1 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-100 backdrop-blur-sm">
                🎬 {lockBadge}
              </span>
            )}
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
              {label}
            </span>
            <span className="line-clamp-2 text-sm font-medium text-white">
              {file.name}
            </span>
          </div>
        </>
      ) : (
        <div className="relative z-10 pointer-events-none flex h-full flex-col justify-between gap-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-700/60 text-white/80">
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
  const [aiWriting, setAiWriting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const [characterPrompt, setCharacterPrompt] = useState("");
  const [characterDialogOpen, setCharacterDialogOpen] = useState(false);
  const [characterDraft, setCharacterDraft] = useState("");
  
  const introRef = useRef<HTMLInputElement>(null);
  const outroRef = useRef<HTMLInputElement>(null);
  const characterRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const introPreviewUrl = usePreviewUrl(introImage);
  const characterPreviewUrl = usePreviewUrl(characterImage);
  const outroPreviewUrl = usePreviewUrl(outroImage);

  const hasImages = !!(introImage || outroImage || characterImage);
  
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

  const contextChips: string[] = [
    ...selectedStyleLabels.map((l) => `Style: ${l}`),
    ...selectedProductLabels.map((l) => `Product: ${l}`),
    `Duration: ${duration}s`,
    `Ratio: ${ratio}`,
    `Engine: ${selectedVideoModel.label}`,
  ];

  const buildContextString = () => {
    const brandBlock = [
      "BRAND: rebar.shop (industrial rebar fabrication & supply company)",
      "WEBSITE: https://rebar.shop",
      "CONTENT TYPE: Advertising / commercial video ad",
      "GOAL: Promote rebar.shop products and brand. Always use the name 'rebar.shop' explicitly — never use placeholders like 'Company', 'Brand', or 'Your Company'.",
      "TONE: Persuasive, cinematic, professional commercial advertisement for rebar.shop.",
    ].join("\n");

    const durationNum = Number(duration) || 15;
    const wordBudget = Math.round(durationNum * 2.5);
    const sceneCount = Math.max(1, Math.ceil(durationNum / 5));
    const durationBlock = [
      `DURATION CONSTRAINT (CRITICAL — MUST OBEY):`,
      `- Total video length: EXACTLY ${durationNum} seconds. Not ${durationNum - 5}s. Not ${durationNum + 5}s. EXACTLY ${durationNum}s.`,
      `- Do NOT write a script longer or shorter than ${durationNum}s.`,
      `- Do NOT mention any other duration in the output (e.g., never say "30-second ad" or "60-second spot" if the user picked ${durationNum}s).`,
      `- Pace visuals, voiceover, and scene count to fit within ${durationNum} seconds.`,
      `- Approximate spoken word budget: ~${wordBudget} words MAX for voiceover.`,
      `- Scene count guidance: ~1 scene per 5 seconds → target ~${sceneCount} scene${sceneCount === 1 ? "" : "s"} total.`,
      `- If you reference the duration in the script, you MUST say "${durationNum}-second" — no other number is allowed.`,
    ].join("\n");

    const parts: string[] = [];
    if (selectedStyleLabels.length) parts.push(`Style: ${selectedStyleLabels.join(", ")}`);
    if (selectedProductLabels.length) parts.push(`Products to feature: ${selectedProductLabels.join(", ")}`);
    parts.push(`Duration: ${duration}s (STRICT — see DURATION CONSTRAINT above)`);
    parts.push(`Ratio: ${ratio}`);
    parts.push(`Engine: ${selectedVideoModel.label}`);

    return `${brandBlock}\n\n${durationBlock}\n\nUSER SELECTIONS:\n${parts.join(". ")}.\n\nWrite a cinematic advertising prompt for a rebar.shop commercial video that is EXACTLY ${duration} seconds long, using the selections above. The output script must fit within the ${duration}-second duration constraint without exception.`;
  };

  const runAiWrite = async (): Promise<string | null> => {
    const contextString = buildContextString();
    const result = await invokeEdgeFunction<{ result?: { text?: string }; text?: string }>("ad-director-ai", {
      action: "write-script",
      input: contextString,
    });
    return result?.result?.text ?? result?.text ?? null;
  };

  const handleAiWrite = async () => {
    if (aiWriting || disabled) return;
    setAiWriting(true);
    setPreviewOpen(true);
    setPreviewText("");
    try {
      const text = await runAiWrite();
      if (text) {
        setPreviewText(text);
      } else {
        toast({ title: "No prompt returned", description: "Try again.", variant: "destructive" });
        setPreviewOpen(false);
      }
    } catch (err: any) {
      console.error("AI write error:", err);
      toast({ title: "AI prompt failed", description: err.message || "Try again", variant: "destructive" });
      setPreviewOpen(false);
    } finally {
      setAiWriting(false);
    }
  };

  const handleRegenerate = async () => {
    if (aiWriting) return;
    setAiWriting(true);
    try {
      const text = await runAiWrite();
      if (text) setPreviewText(text);
    } catch (err: any) {
      toast({ title: "Regenerate failed", description: err.message || "Try again", variant: "destructive" });
    } finally {
      setAiWriting(false);
    }
  };

  const handleUsePreview = () => {
    setPrompt(previewText.trim());
    setPreviewOpen(false);
    toast({ title: "✨ Prompt ready", description: "Review and create your video." });
  };


  const handleSubmit = () => {
    if (!prompt.trim() || disabled) return;
    onSubmit(
      prompt.trim(), ratio, [], introImage, outroImage, duration, characterImage,
      selectedProducts, selectedStyles, selectedVideoModel.key, selectedVideoModel.provider,
      characterPrompt.trim() || undefined,
    );
    setPrompt("");
    setIntroImage(null);
    setOutroImage(null);
    setCharacterImage(null);
    setCharacterPrompt("");
  };

  const openCharacterDialog = () => {
    setCharacterDraft(characterPrompt);
    setCharacterDialogOpen(true);
  };
  const handleSaveCharacterPrompt = () => {
    const trimmed = characterDraft.trim();
    setCharacterPrompt(trimmed);
    setCharacterDialogOpen(false);
    if (trimmed) {
      // Auto-fill main prompt so Create video activates and uses the character direction
      setPrompt((prev) => {
        const prevTrim = prev.trim();
        if (!prevTrim) return trimmed;
        if (prevTrim.includes(trimmed)) return prev;
        return `${prevTrim}\n\n${trimmed}`;
      });
      toast({ title: "✅ Character direction saved", description: "Added to your ad description — ready to generate." });
    }
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
      <div className="flex justify-center pb-1">
        <img
          src={companyLogo}
          alt="Company logo"
          className="h-16 w-16 md:h-20 md:w-20 object-contain drop-shadow-[0_0_20px_rgba(234,179,8,0.25)]"
        />
      </div>
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
          lockBadge="Locked to first scene"
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
          onPromptClick={openCharacterDialog}
          hasPrompt={!!characterPrompt}
          promptTooltip="Write what this character should say or do"
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
          lockBadge="Locked to final scene"
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

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-800/50 transition-colors focus-within:border-white/15">
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleAiWrite}
                  disabled={disabled || aiWriting}
                  className="h-10 rounded-xl border border-white/10 bg-slate-800/60 px-3 text-sm font-medium text-white/70 hover:bg-slate-700/80 hover:text-white gap-1.5"
                >
                  {aiWriting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {aiWriting ? "Writing..." : "AI Prompt"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Auto-write a cinematic prompt from your selections</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={openCharacterDialog}
                    disabled={disabled || !characterImage}
                    className={cn(
                      "h-10 rounded-xl border px-3 text-sm font-medium gap-1.5 relative",
                      characterPrompt
                        ? "border-primary/40 bg-primary/15 text-primary hover:bg-primary/20"
                        : "border-white/10 bg-slate-800/60 text-white/70 hover:bg-slate-700/80 hover:text-white",
                      (!characterImage || disabled) && "opacity-50"
                    )}
                  >
                    <UserSquare className="h-4 w-4" />
                    Character
                    {characterPrompt && (
                      <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {characterImage
                  ? "Write what this character should say or do"
                  : "Upload a character image first"}
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-2">
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

      <AIPromptDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        text={previewText}
        onTextChange={setPreviewText}
        onUse={handleUsePreview}
        onRegenerate={handleRegenerate}
        regenerating={aiWriting}
        contextChips={contextChips}
      />

      <CharacterPromptDialog
        open={characterDialogOpen}
        onClose={() => setCharacterDialogOpen(false)}
        text={characterDraft}
        onTextChange={setCharacterDraft}
        onSave={handleSaveCharacterPrompt}
        characterPreviewUrl={characterPreviewUrl}
        brandContext="rebar.shop — industrial rebar fabrication & supply. Persuasive cinematic ad."
        durationSec={Number(duration) || 15}
        productsContext={
          selectedProductLabels.length
            ? selectedProductLabels.join(", ")
            : "rebar fabrication, cut & bend service, fast quoting from drawings"
        }
      />
    </div>
  );
}
