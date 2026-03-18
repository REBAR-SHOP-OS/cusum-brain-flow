import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageIcon, Loader2, Sparkles, Download, RotateCcw, CheckCircle2, Search, Stamp, Bird, Building2, HardHat, Landmark, TreePine, Users, Bot, Package, Smartphone, Upload, X, type LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const VISUAL_THEMES: { id: string; label: string; icon: LucideIcon; promptTag: string }[] = [
  { id: "bird", label: "Birds", icon: Bird, promptTag: "birds in the sky" },
  { id: "building", label: "Building", icon: Building2, promptTag: "building structure" },
  { id: "construction", label: "Construction", icon: HardHat, promptTag: "construction project site" },
  { id: "city", label: "City", icon: Landmark, promptTag: "urban cityscape" },
  { id: "nature", label: "Nature", icon: TreePine, promptTag: "natural landscape" },
  { id: "workers", label: "Workers", icon: Users, promptTag: "construction workers at work" },
  { id: "ai", label: "AI & Build", icon: Bot, promptTag: "AI technology in construction" },
  { id: "products", label: "Our Products", icon: Package, promptTag: "rebar stirrups, ties, and accessories" },
  { id: "logo", label: "Logo", icon: Stamp, promptTag: "with company branding" },
];
import { supabase } from "@/integrations/supabase/client";
import { useBrandKit } from "@/hooks/useBrandKit";
import { useSeoSuggestions } from "@/hooks/useSeoSuggestions";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { applyLogoToImage, ensureSquare, ensurePortrait } from "@/lib/imageWatermark";

interface ImageGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageReady?: (imageUrl: string) => void;
  storyMode?: boolean;
}

type Status = "idle" | "searching" | "generating" | "branding" | "completed" | "failed";

const GEMINI_MODEL = "google/gemini-3-pro-image-preview";
const CHATGPT_MODEL = "gpt-image-1";

export function ImageGeneratorDialog({ open, onOpenChange, onImageReady, storyMode = false }: ImageGeneratorDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState(GEMINI_MODEL);
  const [status, setStatus] = useState<Status>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);
  const [pexelsInspired, setPexelsInspired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { brandKit, saveBrandKit } = useBrandKit();
  const currentModelLabel = selectedModel === CHATGPT_MODEL ? "ChatGPT Image" : "Gemini Pro Image";

  const [selectedThemes, setSelectedThemes] = useState<Set<string>>(new Set());
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const toggleTheme = (id: string) => {
    setSelectedThemes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ext = file.name.split(".").pop() || "png";
      const fileName = `${user.id}/logo-${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("brand-assets")
        .upload(fileName, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data: publicData } = supabase.storage.from("brand-assets").getPublicUrl(fileName);
      saveBrandKit.mutate({
        business_name: brandKit?.business_name || "",
        logo_url: publicData.publicUrl,
        brand_voice: brandKit?.brand_voice || "",
        description: brandKit?.description || "",
        value_prop: brandKit?.value_prop || "",
        colors: brandKit?.colors || { primary: "#000", secondary: "#fff", tertiary: "#888" },
        media_urls: brandKit?.media_urls || [],
      } as any);
      // Auto-select logo theme
      setSelectedThemes((prev) => new Set(prev).add("logo"));
    } catch (err: any) {
      console.error("Logo upload failed:", err);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleClose = () => {
    if (status === "searching" || status === "generating" || status === "branding") return;
    onOpenChange(false);
    setTimeout(() => {
      setPrompt("");
      setSelectedModel("google/gemini-3-pro-image-preview");
      setSelectedThemes(new Set());
      setStatus("idle");
      setImageUrl(null);
      setRevisedPrompt(null);
      setPexelsInspired(false);
      setError(null);
    }, 300);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setStatus("searching");
    setError(null);
    setImageUrl(null);
    setRevisedPrompt(null);
    setPexelsInspired(false);

    // Brief delay to show "Finding inspiration" step
    await new Promise((r) => setTimeout(r, 800));
    setStatus("generating");

    try {
      // Build final prompt with selected themes
      const themePromptTags = VISUAL_THEMES.filter((t) => selectedThemes.has(t.id)).map((t) => t.promptTag);
      const finalPrompt = themePromptTags.length > 0
        ? `${prompt.trim()}. Include: ${themePromptTags.join(", ")}`
        : prompt.trim();

      const { data, error: fnError } = await supabase.functions.invoke("generate-image", {
        body: {
          prompt: finalPrompt,
          model: selectedModel,
          aspectRatio: storyMode ? "9:16" : "1:1",
          logoUrl: brandKit?.logo_url || undefined,
          brandContext: {
            business_name: brandKit?.business_name || undefined,
            description: brandKit?.description || undefined,
            value_prop: brandKit?.value_prop || undefined,
            tagline: (brandKit as any)?.tagline || undefined,
          },
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        setError(data.error);
        setStatus("failed");
        return;
      }

      let finalImageUrl = data.imageUrl;

      // Ensure correct aspect ratio
      try {
        finalImageUrl = storyMode ? await ensurePortrait(finalImageUrl) : await ensureSquare(finalImageUrl);
      } catch (e) {
        console.warn("Aspect ratio crop failed, using original:", e);
      }

      // Apply brand logo overlay only when user selected the Logo theme
      if (brandKit?.logo_url && finalImageUrl && selectedThemes.has("logo")) {
        try {
          setStatus("branding");
          finalImageUrl = await applyLogoToImage(finalImageUrl, brandKit.logo_url);
        } catch (logoErr) {
          console.warn("Logo overlay failed, using image without logo:", logoErr);
        }
      }

      setImageUrl(finalImageUrl);
      setRevisedPrompt(data.revisedPrompt);
      setPexelsInspired(!!data.pexelsInspired);
      setStatus("completed");
    } catch (err) {
      console.error("Image generation error:", err);
      setError("Failed to generate image. Please try again.");
      setStatus("failed");
    }
  };

  const handleReset = () => {
    setStatus("idle");
    setImageUrl(null);
    setRevisedPrompt(null);
    setPexelsInspired(false);
    setSelectedThemes(new Set());
    setError(null);
  };

  const handleUseImage = () => {
    if (imageUrl) {
      onImageReady?.(imageUrl);
      handleClose();
    }
  };

  const { suggestions: promptSuggestions, isLoading: suggestionsLoading } = useSeoSuggestions("image");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${storyMode ? "from-violet-500 to-fuchsia-500" : "from-emerald-500 to-cyan-500"} flex items-center justify-center`}>
              {storyMode ? <Smartphone className="w-4 h-4 text-white" /> : <ImageIcon className="w-4 h-4 text-white" />}
            </div>
            {storyMode ? "AI Story Generator (9:16)" : "AI Ad Image Generator"}
            <Badge variant="secondary" className="text-[10px] gap-1 ml-auto">
              <Search className="w-3 h-3" />
              Pexels-powered
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Idle — input form */}
          {status === "idle" && (
            <>
              {/* Model selector */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">
                    {selectedModel === CHATGPT_MODEL ? "ChatGPT Image" : "Gemini Pro Image"}
                  </span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setSelectedModel(prev => prev === CHATGPT_MODEL ? GEMINI_MODEL : CHATGPT_MODEL)}
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all text-xs font-bold",
                          selectedModel === CHATGPT_MODEL
                            ? "border-green-500 bg-green-500/15 text-green-600 ring-2 ring-green-500/30"
                            : "border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/60"
                        )}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.612-1.5z" />
                        </svg>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p className="text-xs">{selectedModel === CHATGPT_MODEL ? "Switch to Gemini" : "Generate with ChatGPT"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Prompt */}
              <div className="space-y-1.5">
                <Label className="text-sm">Describe your advertising image</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A professional product showcase for social media ads..."
                  className="min-h-[100px] resize-none"
                />
                <p className="text-[10px] text-muted-foreground">
                  The AI will search Pexels for visual inspiration, then generate a unique ad image using your brand context.
                </p>
              </div>

              {/* Visual Themes */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Visual Themes</Label>
                <div className="flex flex-wrap gap-1.5">
                  {VISUAL_THEMES.map((theme) => {
                    const Icon = theme.icon;
                    const isActive = selectedThemes.has(theme.id);
                    const isLogo = theme.id === "logo";

                    return (
                      <button
                        key={theme.id}
                        onClick={() => toggleTheme(theme.id)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${
                          isActive
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "bg-card hover:bg-muted text-muted-foreground"
                        }`}
                      >
                        {isLogo && brandKit?.logo_url ? (
                          <img src={brandKit.logo_url} alt="Logo" className="w-4 h-4 object-contain rounded-sm" />
                        ) : (
                          <Icon className="w-3.5 h-3.5" />
                        )}
                        {theme.label}
                        {isActive && <CheckCircle2 className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Company Logo Upload */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Company Logo</Label>
                <div className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/30">
                  {brandKit?.logo_url ? (
                    <>
                      <img src={brandKit.logo_url} alt="Logo" className="h-8 w-auto rounded border border-border/30 object-contain" />
                      <span className="text-xs text-muted-foreground flex-1 truncate">Logo uploaded</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          saveBrandKit.mutate({
                            business_name: brandKit?.business_name || "",
                            logo_url: null,
                            brand_voice: brandKit?.brand_voice || "",
                            description: brandKit?.description || "",
                            value_prop: brandKit?.value_prop || "",
                            colors: brandKit?.colors || { primary: "#000", secondary: "#fff", tertiary: "#888" },
                            media_urls: brandKit?.media_urls || [],
                          } as any);
                        }}
                      >
                        <X className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="dialog-logo-upload"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
                      />
                      <label
                        htmlFor="dialog-logo-upload"
                        className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {uploadingLogo ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        <span>{uploadingLogo ? "Uploading…" : "Upload logo for AI to use in image generation"}</span>
                      </label>
                    </>
                  )}
                </div>
              </div>

              {/* Suggestions */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Try a suggestion</Label>
                <div className="flex flex-wrap gap-1.5">
                  {suggestionsLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-7 w-36 rounded-full" />
                    ))
                  ) : (
                    promptSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setPrompt(s)}
                        className="text-xs px-2.5 py-1.5 rounded-full border bg-card hover:bg-muted transition-colors text-left leading-tight"
                      >
                        {s.slice(0, 50)}…
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Generate */}
              <Button
                className="w-full gap-2"
                disabled={!prompt.trim()}
                onClick={handleGenerate}
              >
                <Sparkles className="w-4 h-4" />
                Generate Ad Image with {currentModelLabel}
              </Button>
            </>
          )}

          {/* Searching Pexels */}
          {status === "searching" && (
            <div className="flex flex-col items-center text-center gap-3 py-10">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                <Search className="w-7 h-7 animate-pulse text-primary" />
              </div>
              <p className="font-medium">Finding visual inspiration…</p>
              <p className="text-sm text-muted-foreground">Searching Pexels for the best reference photos.</p>
            </div>
          )}

          {/* Generating */}
          {status === "generating" && (
            <div className="flex flex-col items-center text-center gap-3 py-10">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
              <p className="font-medium">Generating your ad image…</p>
              <p className="text-sm text-muted-foreground">Combining brand context with visual inspiration. This takes 10-30 seconds.</p>
            </div>
          )}

          {/* Branding */}
          {status === "branding" && (
            <div className="flex flex-col items-center text-center gap-3 py-10">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                <Stamp className="w-7 h-7 animate-pulse text-primary" />
              </div>
              <p className="font-medium">Applying brand logo…</p>
              <p className="text-sm text-muted-foreground">Adding your company logo to the image.</p>
            </div>
          )}

          {/* Completed */}
          {status === "completed" && imageUrl && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Ad image generated!</span>
                <div className="flex gap-1 ml-auto">
                  {brandKit?.logo_url && selectedThemes.has("logo") && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Stamp className="w-3 h-3" />
                      Branded
                    </Badge>
                  )}
                  {pexelsInspired && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Search className="w-3 h-3" />
                      Pexels-inspired
                    </Badge>
                  )}
                </div>
              </div>

              <div className="rounded-lg overflow-hidden border">
                <img
                  src={imageUrl}
                  alt="Generated advertising image"
                  className="w-full object-contain max-h-[400px]"
                />
              </div>

              {revisedPrompt && (
                <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">AI notes:</span> {revisedPrompt}
                </div>
              )}

              <div className="flex gap-2">
                <Button className="flex-1 gap-2" onClick={handleUseImage}>
                  <ImageIcon className="w-4 h-4" />
                  Use in Post
                </Button>
                <Button variant="outline" asChild>
                  <a href={imageUrl} download target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4" />
                  </a>
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {status === "failed" && (
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" />
                Try Again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
