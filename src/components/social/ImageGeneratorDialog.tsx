import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageIcon, Loader2, Sparkles, Download, RotateCcw, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ImageGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageReady?: (imageUrl: string) => void;
}

type Status = "idle" | "generating" | "completed" | "failed";

interface ModelOption {
  id: string;
  label: string;
  description: string;
  sizes: { value: string; label: string }[];
}

const modelOptions: ModelOption[] = [
  {
    id: "gpt-image-1",
    label: "GPT Image 1",
    description: "OpenAI's latest — highest quality, best prompt following",
    sizes: [
      { value: "1024x1024", label: "Square (1024×1024)" },
      { value: "1536x1024", label: "Landscape (1536×1024)" },
      { value: "1024x1536", label: "Portrait (1024×1536)" },
    ],
  },
  {
    id: "dall-e-3",
    label: "DALL·E 3",
    description: "Creative and artistic, great for stylized content",
    sizes: [
      { value: "1024x1024", label: "Square (1024×1024)" },
      { value: "1792x1024", label: "Landscape (1792×1024)" },
      { value: "1024x1792", label: "Portrait (1024×1792)" },
    ],
  },
];

export function ImageGeneratorDialog({ open, onOpenChange, onImageReady }: ImageGeneratorDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-image-1");
  const [size, setSize] = useState("1536x1024");
  const [status, setStatus] = useState<Status>("idle");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentModel = modelOptions.find((m) => m.id === selectedModel) || modelOptions[0];

  const handleClose = () => {
    if (status === "generating") return;
    onOpenChange(false);
    setTimeout(() => {
      setPrompt("");
      setSelectedModel("gpt-image-1");
      setSize("1536x1024");
      setStatus("idle");
      setImageUrl(null);
      setRevisedPrompt(null);
      setError(null);
    }, 300);
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    const model = modelOptions.find((m) => m.id === modelId);
    if (model) {
      // Reset to first landscape size
      const landscape = model.sizes.find((s) => s.label.includes("Landscape")) || model.sizes[0];
      setSize(landscape.value);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setStatus("generating");
    setError(null);
    setImageUrl(null);
    setRevisedPrompt(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-image", {
        body: {
          prompt: prompt.trim(),
          model: selectedModel,
          size,
          quality: selectedModel === "gpt-image-1" ? "high" : "hd",
          style: selectedModel === "dall-e-3" ? "vivid" : undefined,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        setError(data.error);
        setStatus("failed");
        return;
      }

      setImageUrl(data.imageUrl);
      setRevisedPrompt(data.revisedPrompt);
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
    setError(null);
  };

  const handleUseImage = () => {
    if (imageUrl) {
      onImageReady?.(imageUrl);
      handleClose();
    }
  };

  const promptSuggestions = [
    "Professional social media banner for a construction company, modern geometric design, steel blue tones",
    "Flat illustration of a team working together in an office, warm colors, friendly atmosphere",
    "Product photography style shot of steel rebar bundles, dramatic studio lighting, clean background",
    "Minimalist infographic background with abstract shapes, gradient from navy to teal, corporate feel",
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-white" />
            </div>
            AI Image Generator
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
                      onClick={() => handleModelChange(m.id)}
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
                <Label className="text-sm">Describe your image</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A professional social media banner with modern design..."
                  className="min-h-[100px] resize-none"
                />
              </div>

              {/* Suggestions */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Try a suggestion</Label>
                <div className="flex flex-wrap gap-1.5">
                  {promptSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setPrompt(s)}
                      className="text-xs px-2.5 py-1.5 rounded-full border bg-card hover:bg-muted transition-colors text-left leading-tight"
                    >
                      {s.slice(0, 50)}…
                    </button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div className="space-y-1.5">
                <Label className="text-sm">Size</Label>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentModel.sizes.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Generate */}
              <Button
                className="w-full gap-2"
                disabled={!prompt.trim()}
                onClick={handleGenerate}
              >
                <Sparkles className="w-4 h-4" />
                Generate with {currentModel.label}
              </Button>
            </>
          )}

          {/* Generating */}
          {status === "generating" && (
            <div className="flex flex-col items-center text-center gap-3 py-10">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-primary" />
              </div>
              <p className="font-medium">Generating your image…</p>
              <p className="text-sm text-muted-foreground">This usually takes 10-30 seconds.</p>
            </div>
          )}

          {/* Completed */}
          {status === "completed" && imageUrl && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Image generated!</span>
              </div>

              <div className="rounded-lg overflow-hidden border">
                <img
                  src={imageUrl}
                  alt="Generated image"
                  className="w-full object-contain max-h-[400px]"
                />
              </div>

              {revisedPrompt && (
                <div className="p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Revised prompt:</span> {revisedPrompt}
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
