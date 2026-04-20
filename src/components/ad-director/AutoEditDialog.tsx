import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Download, Sparkles, AlertCircle, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { extractKeyframes, cutVideoIntoSegments, type RawSceneCut } from "@/lib/rawVideoUtils";
import { stitchClips } from "@/lib/videoStitch";
import { AutoEditUploadStep } from "./AutoEditUploadStep";
import { AutoEditStoryboardStep, type SceneCut } from "./AutoEditStoryboardStep";

type ClipPayload = { index: number; duration: number; frames: { t: number; dataUrl: string }[] };

type Phase = "upload" | "analyzing" | "review" | "generating" | "done" | "error";

interface AutoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ClipMeta {
  file: File;
  duration: number;
}

export function AutoEditDialog({ open, onOpenChange }: AutoEditDialogProps) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("upload");
  const [clips, setClips] = useState<ClipMeta[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [scenes, setScenes] = useState<SceneCut[]>([]);
  const [summary, setSummary] = useState("");
  const [finalUrl, setFinalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regeneratePrompt, setRegeneratePrompt] = useState("");
  const finalUrlRef = useRef<string | null>(null);
  const clipsPayloadRef = useRef<ClipPayload[] | null>(null);

  useEffect(() => {
    finalUrlRef.current = finalUrl;
  }, [finalUrl]);

  useEffect(() => {
    if (!open) {
      const url = finalUrlRef.current;
      setTimeout(() => {
        if (url) URL.revokeObjectURL(url);
      }, 500);
      setPhase("upload");
      setClips([]);
      setProgress(0);
      setProgressMsg("");
      setScenes([]);
      setSummary("");
      setFinalUrl(null);
      setError(null);
      setRegeneratePrompt("");
      clipsPayloadRef.current = null;
    }
  }, [open]);

  const totalDuration = clips.reduce((a, c) => a + c.duration, 0);

  const handleFilesSelected = async (selected: File[]) => {
    if (selected.length === 0) return;
    setPhase("analyzing");
    setError(null);
    setProgress(2);
    setProgressMsg("Reading videos…");

    try {
      // 1) Extract keyframes for each clip
      const perClipMaxFrames = selected.length === 1 ? 12 : 8;
      const clipsPayload: ClipPayload[] = [];
      const collected: ClipMeta[] = [];

      for (let i = 0; i < selected.length; i++) {
        const f = selected[i];
        setProgressMsg(`Analyzing clip ${i + 1} of ${selected.length}…`);
        const { frames, duration } = await extractKeyframes(f, {
          maxFrames: perClipMaxFrames,
          targetWidth: 200,
          onProgress: (p) => {
            const base = 2 + (i / selected.length) * 38;
            const span = (1 / selected.length) * 38;
            setProgress(Math.round(base + p * span));
          },
        });
        clipsPayload.push({ index: i, duration, frames });
        collected.push({ file: f, duration });
      }

      setClips(collected);
      clipsPayloadRef.current = clipsPayload;

      const approxBytes = clipsPayload.reduce(
        (acc, c) => acc + c.frames.reduce((a, f) => a + f.dataUrl.length, 0),
        0,
      );
      console.log(
        `[AutoEdit] clips=${clipsPayload.length} totalDur=${collected.reduce((a, c) => a + c.duration, 0).toFixed(1)}s payload≈${(approxBytes / 1024).toFixed(0)}KB`,
      );

      // 2) Send batch to edge function
      setProgress(45);
      setProgressMsg(`AI is reviewing ${clipsPayload.length} clip${clipsPayload.length > 1 ? "s" : ""}…`);

      const { data, error: fnErr } = await supabase.functions.invoke("auto-video-editor", {
        body: { action: "analyze", clips: clipsPayload },
      });

      if (fnErr) {
        const raw = fnErr.message || "AI analysis failed";
        if (/failed to send|fetch|network/i.test(raw)) {
          throw new Error("Couldn't reach the AI service. Please check your connection and try again.");
        }
        throw new Error(raw);
      }
      if (data?.error) throw new Error(data.error);
      if (!Array.isArray(data?.scenes) || data.scenes.length === 0) {
        throw new Error("AI returned no scenes");
      }

      const sceneList: SceneCut[] = data.scenes.map((s: any, i: number) => ({
        id: `s_${i}_${Math.random().toString(36).slice(2, 8)}`,
        clipIndex: typeof s.clipIndex === "number" ? s.clipIndex : 0,
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
    if (clips.length === 0 || scenes.length === 0) return;
    setPhase("generating");
    setError(null);
    setProgress(0);
    setProgressMsg("Cutting your scenes…");

    try {
      // Group scenes by source clip so we cut each file in one pass
      const segmentsBySceneId = new Map<string, { blob: Blob; blobUrl: string; duration: number }>();
      const grouped = new Map<number, SceneCut[]>();
      for (const s of scenes) {
        const ci = Math.min(Math.max(0, s.clipIndex ?? 0), clips.length - 1);
        if (!grouped.has(ci)) grouped.set(ci, []);
        grouped.get(ci)!.push(s);
      }

      const totalScenes = scenes.length;
      let processed = 0;

      for (const [clipIdx, sceneSubset] of grouped.entries()) {
        const file = clips[clipIdx].file;
        const cuts: RawSceneCut[] = sceneSubset.map((s) => ({ start: s.start, end: s.end }));
        const segs = await cutVideoIntoSegments(file, cuts, ({ index, total }) => {
          const localFrac = (processed + index) / totalScenes;
          setProgress(Math.round(localFrac * 60));
          setProgressMsg(`Cutting scene ${processed + index + 1} of ${totalScenes}…`);
        });
        sceneSubset.forEach((s, i) => segmentsBySceneId.set(s.id, segs[i]));
        processed += sceneSubset.length;
      }

      // Stitch in the user's storyboard order
      setProgressMsg("Assembling final video…");
      setProgress(70);

      const orderedSegments = scenes
        .map((s) => segmentsBySceneId.get(s.id))
        .filter((x): x is { blob: Blob; blobUrl: string; duration: number } => Boolean(x));

      const stitchInput = orderedSegments.map((seg) => ({
        videoUrl: seg.blobUrl,
        targetDuration: seg.duration,
        blob: seg.blob,
      }));

      // Probe first source clip's native dimensions so output preserves
      // the original framing exactly (no zoom/crop).
      const probeDims = await probeVideoDimensions(clips[0].file);

      const result = await stitchClips(
        stitchInput,
        {
          // SILENT: no audio
          fitMode: "contain",
          canvasWidth: probeDims.width,
          canvasHeight: probeDims.height,
        } as any,
        (p) => {
          setProgressMsg(p.message || "Assembling…");
          setProgress((cur) => Math.min(98, Math.max(cur, cur + 1)));
        },
      );

      // Cleanup segment URLs
      orderedSegments.forEach((s) => URL.revokeObjectURL(s.blobUrl));

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

  const handleRegenerate = async () => {
    const direction = regeneratePrompt.trim();
    if (!direction) return;
    if (!clipsPayloadRef.current || clips.length === 0) {
      toast({ title: "Can't regenerate", description: "Source clips are no longer available. Please re-upload.", variant: "destructive" });
      return;
    }

    // Revoke previous final video
    const prev = finalUrlRef.current;
    if (prev) {
      try { URL.revokeObjectURL(prev); } catch {}
    }
    setFinalUrl(null);

    setPhase("analyzing");
    setError(null);
    setProgress(20);
    setProgressMsg("Re-editing with your direction…");

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("auto-video-editor", {
        body: { action: "analyze", clips: clipsPayloadRef.current, userDirection: direction },
      });
      if (fnErr) throw new Error(fnErr.message || "AI analysis failed");
      if (data?.error) throw new Error(data.error);
      if (!Array.isArray(data?.scenes) || data.scenes.length === 0) {
        throw new Error("AI returned no scenes");
      }

      const sceneList: SceneCut[] = data.scenes.map((s: any, i: number) => ({
        id: `s_${i}_${Math.random().toString(36).slice(2, 8)}`,
        clipIndex: typeof s.clipIndex === "number" ? s.clipIndex : 0,
        start: s.start,
        end: s.end,
        description: s.description || `Scene ${i + 1}`,
      }));

      setScenes(sceneList);
      setSummary(data.summary || "");
      setRegeneratePrompt("");

      // Skip review — go straight to generating using the new scenes
      // We need to pass scenes directly since setScenes is async
      await runGenerateWithScenes(sceneList);
    } catch (e) {
      console.error("[AutoEdit] regenerate failed:", e);
      const msg = e instanceof Error ? e.message : "Regeneration failed";
      setError(msg);
      setPhase("error");
      toast({ title: "Regeneration failed", description: msg, variant: "destructive" });
    }
  };

  const runGenerateWithScenes = async (sceneList: SceneCut[]) => {
    if (clips.length === 0 || sceneList.length === 0) return;
    setPhase("generating");
    setError(null);
    setProgress(0);
    setProgressMsg("Cutting your scenes…");

    try {
      const segmentsBySceneId = new Map<string, { blob: Blob; blobUrl: string; duration: number }>();
      const grouped = new Map<number, SceneCut[]>();
      for (const s of sceneList) {
        const ci = Math.min(Math.max(0, s.clipIndex ?? 0), clips.length - 1);
        if (!grouped.has(ci)) grouped.set(ci, []);
        grouped.get(ci)!.push(s);
      }
      const totalScenes = sceneList.length;
      let processed = 0;
      for (const [clipIdx, sceneSubset] of grouped.entries()) {
        const file = clips[clipIdx].file;
        const cuts: RawSceneCut[] = sceneSubset.map((s) => ({ start: s.start, end: s.end }));
        const segs = await cutVideoIntoSegments(file, cuts, ({ index }) => {
          const localFrac = (processed + index) / totalScenes;
          setProgress(Math.round(localFrac * 60));
          setProgressMsg(`Cutting scene ${processed + index + 1} of ${totalScenes}…`);
        });
        sceneSubset.forEach((s, i) => segmentsBySceneId.set(s.id, segs[i]));
        processed += sceneSubset.length;
      }

      setProgressMsg("Assembling final video…");
      setProgress(70);

      const orderedSegments = sceneList
        .map((s) => segmentsBySceneId.get(s.id))
        .filter((x): x is { blob: Blob; blobUrl: string; duration: number } => Boolean(x));

      const stitchInput = orderedSegments.map((seg) => ({
        videoUrl: seg.blobUrl,
        targetDuration: seg.duration,
        blob: seg.blob,
      }));

      const probeDims = await probeVideoDimensions(clips[0].file);
      const result = await stitchClips(
        stitchInput,
        { fitMode: "contain", canvasWidth: probeDims.width, canvasHeight: probeDims.height } as any,
        (p) => {
          setProgressMsg(p.message || "Assembling…");
          setProgress((cur) => Math.min(98, Math.max(cur, cur + 1)));
        },
      );

      orderedSegments.forEach((s) => URL.revokeObjectURL(s.blobUrl));
      setFinalUrl(result.blobUrl);
      setProgress(100);
      setProgressMsg("Done!");
      setPhase("done");
    } catch (e) {
      console.error("[AutoEdit] regenerate stitch failed:", e);
      const msg = e instanceof Error ? e.message : "Generation failed";
      setError(msg);
      setPhase("error");
      toast({ title: "Generation failed", description: msg, variant: "destructive" });
    }
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
            Upload one or more raw clips — AI picks the best scenes and assembles a silent edit.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6">
          {phase === "upload" && <AutoEditUploadStep onFilesSelected={handleFilesSelected} />}

          {(phase === "analyzing" || phase === "generating") && (
            <ProgressView
              title={phase === "analyzing" ? "Analyzing your videos" : "Generating final video"}
              message={progressMsg}
              progress={progress}
            />
          )}

          {phase === "review" && (
            <AutoEditStoryboardStep
              scenes={scenes}
              summary={summary}
              videoDuration={totalDuration}
              clipCount={clips.length}
              onChange={setScenes}
              onGenerate={handleGenerate}
              onBack={() => setPhase("upload")}
            />
          )}

          {phase === "done" && finalUrl && (
            <div className="flex h-full flex-col items-center gap-5 overflow-y-auto py-2">
              <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-black">
                <video src={finalUrl} controls className="w-full" muted />
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={handleDownload} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2">
                  <Download className="h-4 w-4" /> Download Video
                </Button>
                <Button variant="ghost" onClick={() => setPhase("upload")} className="text-white/70 hover:text-white">
                  Edit more clips
                </Button>
              </div>

              <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white/90">
                  <Wand2 className="h-4 w-4 text-amber-300" />
                  Not quite right? Tell the AI how to re-edit it
                </div>
                <Textarea
                  value={regeneratePrompt}
                  onChange={(e) => setRegeneratePrompt(e.target.value)}
                  placeholder="e.g. faster cuts, only keep the thumbs-up section, drop the last few scenes…"
                  className="mt-2 min-h-[72px] resize-none border-white/10 bg-slate-900/60 text-sm text-white placeholder:text-white/30"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setPhase("review")}
                    className="text-xs text-white/55 underline-offset-2 hover:text-white hover:underline"
                  >
                    Edit storyboard manually
                  </button>
                  <Button
                    onClick={handleRegenerate}
                    disabled={regeneratePrompt.trim().length === 0}
                    className="gap-2 bg-gradient-to-r from-amber-500 to-fuchsia-500 text-white hover:from-amber-600 hover:to-fuchsia-600 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" /> Regenerate with this prompt
                  </Button>
                </div>
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

/** Read native videoWidth/videoHeight from a File without rendering it. */
function probeVideoDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.playsInline = true;
    const cleanup = () => {
      try { URL.revokeObjectURL(url); } catch {}
    };
    v.onloadedmetadata = () => {
      const width = v.videoWidth || 1280;
      const height = v.videoHeight || 720;
      cleanup();
      resolve({ width, height });
    };
    v.onerror = () => {
      cleanup();
      resolve({ width: 1280, height: 720 });
    };
    v.src = url;
  });
}
