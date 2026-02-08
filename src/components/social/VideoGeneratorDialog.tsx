import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Video, Loader2, Sparkles, Download, RotateCcw, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VideoGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVideoReady?: (videoUrl: string) => void;
}

type Status = "idle" | "submitting" | "processing" | "completed" | "failed";

type Provider = "veo" | "sora";

interface ModelOption {
  id: string;
  provider: Provider;
  label: string;
  description: string;
  pricing: string;
  maxDuration: number;
  durationOptions: { value: string; label: string }[];
}

const modelOptions: ModelOption[] = [
  {
    id: "veo-3",
    provider: "veo",
    label: "Google Veo 3",
    description: "High-quality cinematic video with native audio",
    pricing: "$0.75/sec",
    maxDuration: 8,
    durationOptions: [
      { value: "5", label: "5 seconds" },
      { value: "8", label: "8 seconds" },
    ],
  },
  {
    id: "sora-2",
    provider: "sora",
    label: "OpenAI Sora 2",
    description: "Fast iteration, great for social content",
    pricing: "Usage-based",
    maxDuration: 12,
    durationOptions: [
      { value: "4", label: "4 seconds" },
      { value: "8", label: "8 seconds" },
      { value: "12", label: "12 seconds" },
    ],
  },
  {
    id: "sora-2-pro",
    provider: "sora",
    label: "OpenAI Sora 2 Pro",
    description: "Production-quality, highest fidelity",
    pricing: "Premium",
    maxDuration: 12,
    durationOptions: [
      { value: "4", label: "4 seconds" },
      { value: "8", label: "8 seconds" },
      { value: "12", label: "12 seconds" },
    ],
  },
];

export function VideoGeneratorDialog({ open, onOpenChange, onVideoReady }: VideoGeneratorDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("veo-3");
  const [duration, setDuration] = useState("8");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const jobRef = useRef<{ id: string; provider: Provider } | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const currentModel = modelOptions.find((m) => m.id === selectedModel) || modelOptions[0];

  const cleanup = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Reset duration when model changes if current duration exceeds max
  useEffect(() => {
    const maxDur = currentModel.maxDuration;
    if (parseInt(duration) > maxDur) {
      setDuration(String(maxDur));
    }
  }, [selectedModel]);

  const handleClose = () => {
    if (status === "submitting" || status === "processing") return;
    cleanup();
    onOpenChange(false);
    setTimeout(() => {
      setPrompt("");
      setSelectedModel("veo-3");
      setDuration("5");
      setStatus("idle");
      setProgress(0);
      setVideoUrl(null);
      setError(null);
      jobRef.current = null;
    }, 300);
  };

  const pollForResult = useCallback(async () => {
    if (!jobRef.current) return;

    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-video", {
        body: {
          action: "poll",
          provider: jobRef.current.provider,
          jobId: jobRef.current.id,
        },
      });

      if (fnError) throw fnError;

      if (data.status === "completed") {
        setStatus("completed");
        setProgress(100);

        if (data.needsAuth && jobRef.current.provider === "sora") {
          // For Sora, we need to proxy the download through our edge function
          const downloadUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`;
          // We'll use a blob fetch approach
          try {
            const dlResp = await fetch(downloadUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                action: "download",
                provider: "sora",
                jobId: jobRef.current.id,
              }),
            });
            if (dlResp.ok) {
              const blob = await dlResp.blob();
              const blobUrl = URL.createObjectURL(blob);
              setVideoUrl(blobUrl);
            } else {
              setVideoUrl(data.videoUrl);
            }
          } catch {
            setVideoUrl(data.videoUrl);
          }
        } else if (data.videoUrl) {
          setVideoUrl(data.videoUrl);
        } else {
          setError("Video generated but no URL returned.");
          setStatus("failed");
        }
        return;
      }

      if (data.status === "failed") {
        setError(data.error || "Video generation failed.");
        setStatus("failed");
        return;
      }

      // Still processing
      if (data.progress != null) {
        setProgress(data.progress);
      } else {
        setProgress((prev) => Math.min(prev + 3, 90));
      }
      pollTimerRef.current = setTimeout(pollForResult, 5000);
    } catch (err) {
      console.error("Poll error:", err);
      setError("Failed to check video status. Please try again.");
      setStatus("failed");
    }
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setStatus("submitting");
    setProgress(0);
    setError(null);
    setVideoUrl(null);

    // Auto-inject branding: include company logo reference
    const brandedPrompt = `${prompt.trim()}. The video should feature a subtle gold circular coin logo watermark with a blue geometric "G" symbol in the bottom-right corner throughout.`;

    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-video", {
        body: {
          action: "generate",
          provider: currentModel.provider,
          prompt: brandedPrompt,
          duration: parseInt(duration),
          model: currentModel.id === "sora-2-pro" ? "sora-2-pro" : "sora-2",
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        setError(data.error);
        setStatus("failed");
        return;
      }

      jobRef.current = { id: data.jobId, provider: data.provider };
      setStatus("processing");
      setProgress(5);
      pollTimerRef.current = setTimeout(pollForResult, 5000);
    } catch (err) {
      console.error("Generate error:", err);
      setError("Failed to start video generation.");
      setStatus("failed");
    }
  };

  const handleReset = () => {
    cleanup();
    setStatus("idle");
    setProgress(0);
    setVideoUrl(null);
    setError(null);
    jobRef.current = null;
  };

  const handleUseVideo = () => {
    if (videoUrl) {
      onVideoReady?.(videoUrl);
      handleClose();
    }
  };

  const isGenerating = status === "submitting" || status === "processing";

  const promptSuggestions = [
    "A cinematic aerial shot of a construction site at golden hour, cranes moving steel beams",
    "Modern office timelapse with people working, natural lighting, professional atmosphere",
    "Close-up of steel rebar being bent by machinery in a workshop, industrial, sparks flying",
    "A drone shot over a completed building project, revealing the cityscape behind it",
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </div>
            AI Video Generator
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
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{m.label}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {m.pricing}
                          </span>
                        </div>
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
                <Label className="text-sm">Describe your video</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A cinematic drone shot over a modern construction site at sunset..."
                  className="min-h-[100px] resize-none"
                />
              </div>

              {/* Quick suggestions */}
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

              {/* Duration */}
              <div className="space-y-1.5">
                <Label className="text-sm">Duration</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentModel.durationOptions.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Generate button */}
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

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-4 py-6">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 animate-spin text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {status === "submitting" ? "Submitting request…" : `Generating with ${currentModel.label}…`}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This typically takes 1-3 minutes. Please keep this window open.
                  </p>
                </div>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">{Math.round(progress)}% complete</p>
            </div>
          )}

          {/* Completed */}
          {status === "completed" && videoUrl && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Video generated with {currentModel.label}!</span>
              </div>

              <div className="rounded-lg overflow-hidden border bg-black">
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  muted
                  className="w-full aspect-video"
                />
              </div>

              <div className="flex gap-2">
                <Button className="flex-1 gap-2" onClick={handleUseVideo}>
                  <Video className="w-4 h-4" />
                  Use in Post
                </Button>
                <Button variant="outline" asChild>
                  <a href={videoUrl} download target="_blank" rel="noopener noreferrer">
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
