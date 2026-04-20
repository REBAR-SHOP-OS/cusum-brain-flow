import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, Sparkles, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { extractKeyframes, cutVideoIntoSegments, type RawSceneCut } from "@/lib/rawVideoUtils";
import { stitchClips } from "@/lib/videoStitch";
import { AutoEditUploadStep } from "./AutoEditUploadStep";
import { AutoEditStoryboardStep, type SceneCut } from "./AutoEditStoryboardStep";

type Phase = "upload" | "analyzing" | "review" | "generating" | "done" | "error";

interface AutoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AutoEditDialog({ open, onOpenChange }: AutoEditDialogProps) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [scenes, setScenes] = useState<SceneCut[]>([]);
  const [summary, setSummary] = useState("");
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const finalUrlRef = useRef<string | null>(null);

  // Cleanup blob URL when dialog closes/unmounts
  useEffect(() => {
    finalUrlRef.current = finalUrl;
  }, [finalUrl]);

  useEffect(() => {
    if (!open) {
      // Reset on close
      const url = finalUrlRef.current;
      setTimeout(() => {
        if (url) URL.revokeObjectURL(url);
      }, 500);
      setPhase("upload");
      setFile(null);
      setVideoDuration(0);
      setProgress(0);
      setProgressMsg("");
      setScenes([]);
      setSummary("");
      setFinalUrl(null);
      setError(null);
    }
  }, [open]);

  const handleFileSelected = async (selected: File) => {
    setFile(selected);
    setPhase("analyzing");
    setError(null);
    setProgress(5);
    setProgressMsg("Reading video…");

    try {
      // 1) Extract keyframes locally
      const { frames, duration } = await extractKeyframes(selected, {
        intervalSec: 2,
        maxFrames: 24,
        targetWidth: 320,
        onProgress: (p) => {
          setProgress(5 + Math.round(p * 35));
          setProgressMsg(`Extracting keyframes… ${Math.round(p * 100)}%`);
        },
      });
      setVideoDuration(duration);

      // 2) Send to edge function for AI scene proposal
      setProgress(45);
      setProgressMsg("AI is watching your video…");

      const { data, error: fnErr } = await supabase.functions.invoke("auto-video-editor", {
        body: { action: "analyze", frames, videoDuration: duration },
      });

      if (fnErr) throw new Error(fnErr.message || "AI analysis failed");
      if (data?.error) throw new Error(data.error);
      if (!Array.isArray(data?.scenes) || data.scenes.length === 0) {
        throw new Error("AI returned no scenes");
      }

      const sceneList: SceneCut[] = data.scenes.map((s: RawSceneCut, i: number) => ({
        id: `s_${i}_${Math.random().toString(36).slice(2, 8)}`,
        start: s.start,
        end: s.end,
        description: s.description || `Scene ${i + 1}`,
      }));

      setScenes(sceneList);
      setSummary(data.summary || "");
      setProgress(100);
      setProgressMsg("Storyboard ready!");
      setTimeout(() => setPhase("review"), 250);
    } catch (e) {
      console.error("[AutoEdit] analyze failed:", e);
      const msg = e instanceof Error ? e.message : "Analysis failed";
      setError(msg);
      setPhase("error");
      toast({ title: "Auto-Edit failed", description: msg, variant: "destructive" });
    }
  };

  const handleGenerate = async () => {
    if (!file || scenes.length === 0) return;
    setPhase("generating");
    setError(null);
    setProgress(0);
    setProgressMsg("Cutting your scenes…");

    try {
      const cuts: RawSceneCut[] = scenes.map((s) => ({ start: s.start, end: s.end }));
      const segments = await cutVideoIntoSegments(file, cuts, ({ index, total }) => {
        const p = Math.round((index / total) * 60);
        setProgress(p);
        setProgressMsg(`Cutting scene ${index + 1} of ${total}…`);
      });

      // Stitch silent segments together (no audio overlays)
      setProgressMsg("Assembling final video…");
      setProgress(70);

      const stitchClipsInput = segments.map((seg) => ({
        videoUrl: seg.blobUrl,
        targetDuration: seg.duration,
      }));

      const result = await stitchClips(
        stitchClipsInput,
        {
          // SILENT: no audioUrl, no musicUrl, no endCard audio
        } as any,
        (p) => {
          setProgressMsg(p.message || "Assembling…");
          // Crawl progress from 70 → 98 during stitch
          setProgress((cur) => Math.min(98, Math.max(cur, cur + 1)));
        },
      );

      // Cleanup segment URLs
      segments.forEach((s) => URL.revokeObjectURL(s.blobUrl));

      setFinalUrl(result.blobUrl);
      setProgress(100);
      setProgressMsg("Done!");
      setPhase("done");
    } catch (e) {
      console.error("[AutoEdit] generate failed:", e);
      const msg = e instanceof Error ? e.message : "Generation failed";
      setError(msg);
      setPhase("error");
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    }
  };

  const handleDownload = () => {
    if (!finalUrl) return;
    const a = document.createElement("a");
    a.href = finalUrl;
    a.download = `auto-edit-${Date.now()}.webm`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col bg-slate-950 border-white/10 text-white p-0 gap-0">
        <DialogHeader className="border-b border-white/10 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-200">
              <Sparkles className="h-4 w-4" />
            </span>
            Auto-Edit from Raw Video
          </DialogTitle>
          <DialogDescription className="text-white/55">
            Upload a raw clip — AI proposes the best edit. Final export is silent (no audio).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6">
          {phase === "upload" && <AutoEditUploadStep onFileSelected={handleFileSelected} />}

          {(phase === "analyzing" || phase === "generating") && (
            <ProgressView
              title={phase === "analyzing" ? "Analyzing your video" : "Generating final video"}
              message={progressMsg}
              progress={progress}
            />
          )}

          {phase === "review" && (
            <AutoEditStoryboardStep
              scenes={scenes}
              summary={summary}
              videoDuration={videoDuration}
              onChange={setScenes}
              onGenerate={handleGenerate}
              onBack={() => setPhase("upload")}
            />
          )}

          {phase === "done" && finalUrl && (
            <div className="flex h-full flex-col items-center justify-center gap-5">
              <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-black">
                <video src={finalUrl} controls className="w-full" muted />
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleDownload} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2">
                  <Download className="h-4 w-4" /> Download Video
                </Button>
                <Button variant="ghost" onClick={() => setPhase("upload")} className="text-white/70 hover:text-white">
                  Edit another video
                </Button>
              </div>
              <p className="text-xs text-white/40">Silent .webm export · ready to share</p>
            </div>
          )}

          {phase === "error" && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <AlertCircle className="h-10 w-10 text-rose-400" />
              <div>
                <p className="text-base font-semibold text-white">Something went wrong</p>
                <p className="mt-1 max-w-md text-sm text-white/60">{error || "Unknown error"}</p>
              </div>
              <Button onClick={() => setPhase("upload")} variant="ghost" className="text-white/70 hover:text-white">
                Try again
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProgressView({ title, message, progress }: { title: string; message: string; progress: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-4">
      <Loader2 className="h-10 w-10 animate-spin text-emerald-300" />
      <div className="text-center">
        <p className="text-base font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm text-white/55">{message}</p>
      </div>
      <div className="w-full max-w-md">
        <Progress value={progress} className="h-2" />
        <div className="mt-1 text-right text-[11px] text-white/40">{progress}%</div>
      </div>
    </div>
  );
}
