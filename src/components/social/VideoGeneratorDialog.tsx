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

export function VideoGeneratorDialog({ open, onOpenChange, onVideoReady }: VideoGeneratorDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const operationRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const cleanup = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleClose = () => {
    if (status === "submitting" || status === "processing") return; // prevent closing during generation
    cleanup();
    onOpenChange(false);
    // Reset state after close animation
    setTimeout(() => {
      setPrompt("");
      setDuration("5");
      setStatus("idle");
      setProgress(0);
      setVideoUrl(null);
      setError(null);
      operationRef.current = null;
    }, 300);
  };

  const pollForResult = useCallback(async () => {
    if (!operationRef.current) return;

    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-video", {
        body: { action: "poll", operationName: operationRef.current },
      });

      if (fnError) throw fnError;

      if (data.status === "completed") {
        setStatus("completed");
        setProgress(100);
        if (data.videoUrl) {
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

      // Still processing — update progress and poll again
      if (data.progress) {
        setProgress(data.progress);
      } else {
        // Simulate progress
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

    try {
      const { data, error: fnError } = await supabase.functions.invoke("generate-video", {
        body: { action: "generate", prompt: prompt.trim(), duration: parseInt(duration) },
      });

      if (fnError) throw fnError;

      if (data.error) {
        setError(data.error);
        setStatus("failed");
        return;
      }

      operationRef.current = data.operationName;
      setStatus("processing");
      setProgress(5);
      // Start polling
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
    operationRef.current = null;
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
          {/* Prompt */}
          {status === "idle" && (
            <>
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
                    <SelectItem value="5">5 seconds</SelectItem>
                    <SelectItem value="8">8 seconds</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Veo 3 pricing: $0.75/second of generated video
                </p>
              </div>

              {/* Generate button */}
              <Button
                className="w-full gap-2"
                disabled={!prompt.trim()}
                onClick={handleGenerate}
              >
                <Sparkles className="w-4 h-4" />
                Generate Video
              </Button>
            </>
          )}

          {/* Progress */}
          {isGenerating && (
            <div className="space-y-4 py-6">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-violet-500 animate-spin" />
                </div>
                <div>
                  <p className="font-medium">
                    {status === "submitting" ? "Submitting request…" : "Generating your video…"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This typically takes 1-2 minutes. Please keep this window open.
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
                <span className="font-medium">Video generated successfully!</span>
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
