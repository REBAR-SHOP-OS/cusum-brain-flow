import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ImageIcon, Loader2, Sparkles, Download, RotateCcw, CheckCircle2, Search, Stamp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBrandKit } from "@/hooks/useBrandKit";
import { useSeoSuggestions } from "@/hooks/useSeoSuggestions";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { applyLogoToImage } from "@/lib/imageWatermark";

interface ImageGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageReady?: (imageUrl: string) => void;
}

type Status = "idle" | "searching" | "generating" | "branding" | "completed" | "failed";

interface ModelOption {
  id: string;
  label: string;
  description: string;
}

const modelOptions: ModelOption[] = [
  {
    id: "google/gemini-3-pro-image-preview",
    label: "Gemini Pro Image",
    description: "Highest quality — best for detailed, professional images",
  },
  {
    id: "google/gemini-3.1-flash-image-preview",
    label: "Gemini Flash Image",
    description: "Fast generation with pro-level quality",
  },
];

export function ImageGeneratorDialog({ open, onOpenChange, onImageReady }: ImageGeneratorDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("google/gemini-3-pro-image-preview");
  const [status, setStatus] = useState<Status>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);
  const [pexelsInspired, setPexelsInspired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { brandKit } = useBrandKit();
  const currentModel = modelOptions.find((m) => m.id === selectedModel) || modelOptions[0];

  const handleClose = () => {
    if (status === "searching" || status === "generating" || status === "branding") return;
    onOpenChange(false);
    setTimeout(() => {
      setPrompt("");
      setSelectedModel("google/gemini-3-pro-image-preview");
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
      const { data, error: fnError } = await supabase.functions.invoke("generate-image", {
        body: {
          prompt: prompt.trim(),
          model: selectedModel,
          brandContext: {
            business_name: brandKit?.business_name || undefined,
            description: brandKit?.description || undefined,
            value_prop: brandKit?.value_prop || undefined,
            tagline: undefined,
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

      // Apply brand logo overlay if available
      if (brandKit?.logo_url && finalImageUrl) {
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-white" />
            </div>
            AI Ad Image Generator
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
              <div className="space-y-1.5">
                <Label className="text-sm">Model</Label>
                <div className="grid gap-2">
                  {modelOptions.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                        selectedModel === m.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{m.label}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          selectedModel === m.id ? "border-primary" : "border-muted-foreground/30"
                        }`}
                      >
                        {selectedModel === m.id && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
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
                Generate Ad Image with {currentModel.label}
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
                  {brandKit?.logo_url && (
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
