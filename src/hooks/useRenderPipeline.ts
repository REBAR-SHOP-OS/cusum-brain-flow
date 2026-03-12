import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { stitchClips, type StitchOverlayOptions, type StitchProgress } from "@/lib/videoStitch";
export type { StitchProgress };

export type RenderStatus =
  | "idle"
  | "scenes_ready"
  | "generating_voice"
  | "assembly_in_progress"
  | "validating"
  | "assembled"
  | "render_failed";

export interface RenderLogEntry {
  timestamp: string;
  stage: string;
  message: string;
  durationMs?: number;
}

export interface RenderState {
  status: RenderStatus;
  error: { message: string; stage: string } | null;
  log: RenderLogEntry[];
  progress: StitchProgress | null;
  finalVideoUrl: string | null;
  finalBlob: Blob | null;
  finalDuration: number | null;
  jobId: string | null;
}

const initialState: RenderState = {
  status: "idle",
  error: null,
  log: [],
  progress: null,
  finalVideoUrl: null,
  finalBlob: null,
  finalDuration: null,
  jobId: null,
};

export function useRenderPipeline() {
  const [state, setState] = useState<RenderState>(initialState);
  const abortRef = useRef(false);

  const addLog = useCallback((stage: string, message: string) => {
    const entry: RenderLogEntry = { timestamp: new Date().toISOString(), stage, message };
    setState(prev => ({ ...prev, log: [...prev.log, entry] }));
    console.log(`[RenderPipeline] [${stage}] ${message}`);
    return performance.now();
  }, []);

  const setStatus = useCallback((status: RenderStatus) => {
    setState(prev => ({ ...prev, status }));
  }, []);

  const setError = useCallback((stage: string, message: string) => {
    setState(prev => ({
      ...prev,
      status: "render_failed",
      error: { stage, message },
    }));
    addLog(stage, `❌ ERROR: ${message}`);
  }, [addLog]);

  // Persist render job to database (best-effort, non-blocking)
  const persistJob = useCallback(async (updates: Record<string, unknown>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const jobId = state.jobId;
      if (jobId) {
        await (supabase as any).from("render_jobs").update(updates).eq("id", jobId);
      } else {
        const { data } = await (supabase as any).from("render_jobs")
          .insert({ user_id: user.id, ...updates })
          .select("id")
          .single();
        if (data?.id) setState(prev => ({ ...prev, jobId: data.id }));
      }
    } catch (e) {
      console.warn("[RenderPipeline] DB persist failed:", e);
    }
  }, [state.jobId]);

  const startRender = useCallback(async (
    orderedClips: { videoUrl: string; targetDuration: number }[],
    overlays: StitchOverlayOptions,
    voiceGenerator?: () => Promise<string | undefined>,
  ) => {
    abortRef.current = false;
    setState({ ...initialState, status: "scenes_ready" });

    const startTime = performance.now();
    addLog("init", `Starting render pipeline: ${orderedClips.length} clips`);
    await persistJob({ status: "draft", scene_count: orderedClips.length, completed_scenes: 0 });

    // Phase 1: Voice generation
    if (voiceGenerator) {
      setStatus("generating_voice");
      addLog("voice", "Generating voiceover...");
      try {
        const audioUrl = await voiceGenerator();
        if (audioUrl) {
          overlays = { ...overlays, audioUrl };
          addLog("voice", "✅ Voiceover generated");
          await persistJob({ status: "voice_ready", voice_url: audioUrl });
        } else {
          addLog("voice", "⚠ No voiceover — continuing without audio");
        }
      } catch (err: any) {
        addLog("voice", `⚠ Voiceover failed: ${err.message} — continuing without audio`);
      }
    }

    if (abortRef.current) return;

    // Phase 2: Stitch
    setStatus("assembly_in_progress");
    addLog("stitch", "Starting clip assembly...");
    await persistJob({ status: "assembly_in_progress" });

    try {
      const result = await stitchClips(orderedClips, overlays, (p) => {
        setState(prev => ({ ...prev, progress: p }));
      });

      addLog("stitch", `✅ Stitch complete: ${(result.blob.size / 1024 / 1024).toFixed(1)}MB, ${result.duration.toFixed(1)}s`);

      setState(prev => ({
        ...prev,
        status: "assembled",
        finalVideoUrl: result.blobUrl,
        finalBlob: result.blob,
        finalDuration: result.duration,
        progress: { stage: "done", message: "Export complete" },
      }));

      const totalMs = Math.round(performance.now() - startTime);
      addLog("complete", `✅ Pipeline finished in ${(totalMs / 1000).toFixed(1)}s`);
      await persistJob({
        status: "assembled",
        final_file_size: result.blob.size,
        completed_scenes: orderedClips.length,
      });
    } catch (err: any) {
      setError("stitch", err.message);
      await persistJob({ status: "render_failed", error_message: err.message, error_stage: "stitch" });
    }
  }, [addLog, setStatus, setError, persistJob]);

  const reset = useCallback(() => {
    abortRef.current = true;
    setState(initialState);
  }, []);

  const downloadLog = useCallback(() => {
    const json = JSON.stringify(state.log, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `render-log-${new Date().toISOString().slice(0, 19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.log]);

  return { ...state, startRender, reset, downloadLog };
}
