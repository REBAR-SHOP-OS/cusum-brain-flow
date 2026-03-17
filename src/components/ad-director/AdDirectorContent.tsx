import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { ScriptInput } from "./ScriptInput";
import { StoryboardTimeline } from "./StoryboardTimeline";
import { ContinuityInspector } from "./ContinuityInspector";
import { FinalPreview } from "./FinalPreview";
import { ExportDialog } from "./ExportDialog";
import { ProVideoEditor } from "./ProVideoEditor";
import { Progress } from "@/components/ui/progress";
import { FileText, Layers, Film, Loader2, ArrowLeft, X } from "lucide-react";
import { StepIndicator } from "./StepIndicator";
import {
  type BrandProfile, type ScriptSegment, type StoryboardScene,
  type ContinuityProfile, type ClipOutput, type ModelOverrides,
  type PromptQualityScore, DEFAULT_BRAND, DEMO_SCRIPT,
} from "@/types/adDirector";
import { cn } from "@/lib/utils";
import { usePromptHistory } from "@/hooks/usePromptHistory";
import { stitchClips } from "@/lib/videoStitch";
import { useAdDirectorBrandKit } from "@/hooks/useAdDirectorBrandKit";
import { useAdProjectHistory, type AdProjectRow } from "@/hooks/useAdProjectHistory";
import { supabase } from "@/integrations/supabase/client";

// Sidebar tab components
import { StockImagesTab } from "./editor/StockImagesTab";
import { StockVideoTab } from "./editor/StockVideoTab";
import { TemplatesTab } from "./editor/TemplatesTab";
import { GraphicsTab } from "./editor/GraphicsTab";
import { TransitionsTab } from "./editor/TransitionsTab";
import { TextTab } from "./editor/TextTab";
import { RecordTab } from "./editor/RecordTab";
import { MusicTab } from "./editor/MusicTab";
import { BrandKitSidePanel } from "./editor/BrandKitSidePanel";
import { DEFAULT_VIDEO_PARAMS, type VideoParams } from "./VideoParameters";

import { Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type WorkflowStep = "script" | "storyboard" | "preview";

const QUALITY_THRESHOLD = 7.0;
const MAX_IMPROVE_ATTEMPTS = 2;

const EDGE_TIMEOUT_MS = 180_000;

function withTimeout<T>(promise: Promise<T>, ms = EDGE_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out — the AI model took too long. Please try again.")), ms)
    ),
  ]);
}

interface AdDirectorContentProps {
  externalLoadProject?: import("@/hooks/useAdProjectHistory").AdProjectRow | null;
  onProjectLoaded?: () => void;
  externalActiveTab?: string | null;
  onActiveTabChanged?: (tab: string | null) => void;
}

export function AdDirectorContent({ externalLoadProject, onProjectLoaded, externalActiveTab, onActiveTabChanged }: AdDirectorContentProps = {}) {
  const { toast } = useToast();
  const { savedBrand, isLoading: brandLoading, saveBrandKit } = useAdDirectorBrandKit();
  const { saveProject } = useAdProjectHistory();
  const projectIdRef = useRef<string | null>(null);
  const promptHistory = usePromptHistory();
  const [step, setStep] = useState<WorkflowStep>("script");
  const [script, setScript] = useState("");
  const [brand, setBrand] = useState<BrandProfile>(DEFAULT_BRAND);
  const [videoParams, setVideoParams] = useState<VideoParams>(DEFAULT_VIDEO_PARAMS);

  // Load saved brand kit on mount
  useEffect(() => {
    if (savedBrand && !brandLoading) {
      setBrand(savedBrand);
    }
  }, [savedBrand, brandLoading]);

  // Load project from sidebar
  useEffect(() => {
    if (externalLoadProject) {
      handleLoadProject(externalLoadProject);
      onProjectLoaded?.();
    }
  }, [externalLoadProject]);

  const [assets, setAssets] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");
  const [modelOverrides, setModelOverrides] = useState<ModelOverrides>({});

  const [segments, setSegments] = useState<ScriptSegment[]>([]);
  const [storyboard, setStoryboard] = useState<StoryboardScene[]>([]);
  const storyboardRef = useRef<StoryboardScene[]>(storyboard);
  useEffect(() => { storyboardRef.current = storyboard; }, [storyboard]);
  const [continuity, setContinuity] = useState<ContinuityProfile | null>(null);
  const [clips, setClips] = useState<ClipOutput[]>([]);
  // Multi-build state: each build is an independent set of clips for all scenes
  const [builds, setBuilds] = useState<{ buildIndex: number; clips: ClipOutput[] }[]>([]);
  const [activeBuildIndex, setActiveBuildIndex] = useState(0);
  // Derive generatingAny reactively from clips state + all builds
  const generatingAny = clips.some(c => c.status === "generating") || builds.some(b => b.clips.some(c => c.status === "generating"));
  const [exporting, setExporting] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [musicTrackUrl, setMusicTrackUrl] = useState<string | null>(null);
  const [improvingSceneId, setImprovingSceneId] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [endCardEnabled, setEndCardEnabled] = useState(true);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  // Logo watermark is always mandatory when logo exists — no toggle
  const logoEnabled = !!brand.logoUrl;

  // ─── Multi-Step Analysis Pipeline ────────────────────────
  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    try {
      // Step 1: Analyze script + generate storyboard
      setAnalysisStatus("Analyzing script structure...");
      setAnalysisProgress(10);
      const analyzeResult = await withTimeout(invokeEdgeFunction<{
        result: { segments: ScriptSegment[]; storyboard: StoryboardScene[]; continuityProfile: ContinuityProfile };
        modelUsed: string;
        fallbackUsed: boolean;
      }>("ad-director-ai", {
        action: "analyze-script",
        script, brand,
        assetDescriptions: assets.length > 0 ? assets.map(f => f.name).join(", ") : undefined,
        modelOverrides,
      }, { timeoutMs: 90_000 }));

      const { segments: newSegments, storyboard: rawStoryboard, continuityProfile } = analyzeResult.result;
      const plannedBy = analyzeResult.modelUsed;

      // Step 2: Write cinematic prompts for each scene
      setAnalysisStatus("Writing cinematic prompts...");
      setAnalysisProgress(30);
      const promptResults = await Promise.all(
        rawStoryboard.map(async (scene, idx) => {
          try {
            const res = await withTimeout(invokeEdgeFunction<{
              result: { prompt: string; reasoning?: string };
              modelUsed: string;
            }>("ad-director-ai", {
              action: "write-cinematic-prompt",
              scene,
              brand,
              continuityProfile,
              previousScene: idx > 0 ? rawStoryboard[idx - 1] : null,
              modelOverrides,
            }, { timeoutMs: EDGE_TIMEOUT_MS }));
            return { prompt: res.result.prompt, modelUsed: res.modelUsed };
          } catch {
            return { prompt: scene.prompt, modelUsed: "original" };
          }
        })
      );

      // Step 3: Score prompt quality
      setAnalysisStatus("Scoring prompt quality...");
      setAnalysisProgress(55);
      const qualityResults = await Promise.all(
        promptResults.map(async (pr, idx) => {
          try {
            const res = await withTimeout(invokeEdgeFunction<{
              result: PromptQualityScore;
              modelUsed: string;
            }>("ad-director-ai", {
              action: "score-prompt-quality",
              prompt: pr.prompt,
              scene: rawStoryboard[idx],
              brand,
              modelOverrides,
            }, { timeoutMs: EDGE_TIMEOUT_MS }));
            return { quality: res.result, scoredBy: res.modelUsed };
          } catch {
            return { quality: undefined, scoredBy: "skipped" };
          }
        })
      );

      // Step 4: Auto-improve prompts below threshold
      setAnalysisStatus("Auto-improving weak prompts...");
      setAnalysisProgress(75);
      const finalPrompts = await Promise.all(
        promptResults.map(async (pr, idx) => {
          const quality = qualityResults[idx]?.quality;
          if (!quality || quality.overall >= QUALITY_THRESHOLD) {
            return pr;
          }
          // Try improvement
          for (let attempt = 0; attempt < MAX_IMPROVE_ATTEMPTS; attempt++) {
            try {
              const improveRes = await withTimeout(invokeEdgeFunction<{
                result: { prompt: string };
                modelUsed: string;
              }>("ad-director-ai", {
                action: "improve-prompt",
                prompt: pr.prompt,
                qualityScore: quality,
                scene: rawStoryboard[idx],
                brand,
                modelOverrides,
              }, { timeoutMs: EDGE_TIMEOUT_MS }));

              // Re-score
              const rescoreRes = await withTimeout(invokeEdgeFunction<{
                result: PromptQualityScore;
              }>("ad-director-ai", {
                action: "score-prompt-quality",
                prompt: improveRes.result.prompt,
                scene: rawStoryboard[idx],
                brand,
                modelOverrides,
              }, { timeoutMs: EDGE_TIMEOUT_MS }));

              qualityResults[idx] = { quality: rescoreRes.result, scoredBy: qualityResults[idx].scoredBy };

              if (rescoreRes.result.overall >= QUALITY_THRESHOLD) {
                return { prompt: improveRes.result.prompt, modelUsed: improveRes.modelUsed };
              }
              pr = { prompt: improveRes.result.prompt, modelUsed: improveRes.modelUsed };
            } catch {
              break;
            }
          }
          return pr;
        })
      );

      // Build final storyboard
      setAnalysisStatus("Assembling storyboard...");
      setAnalysisProgress(95);
      const storyboardWithDefaults: StoryboardScene[] = rawStoryboard.map((s, idx) => ({
        ...s,
        prompt: finalPrompts[idx].prompt,
        continuityLock: true,
        locked: false,
        referenceAssetUrl: null,
        sceneIntelligence: {
          plannedBy,
          promptWrittenBy: finalPrompts[idx].modelUsed,
          promptScoredBy: qualityResults[idx]?.scoredBy,
        },
        promptQuality: qualityResults[idx]?.quality,
      }));

      setSegments(newSegments);
      setStoryboard(storyboardWithDefaults);
      setContinuity(continuityProfile);
      setClips(storyboardWithDefaults.map(s => ({
        sceneId: s.id,
        status: "idle" as const,
        progress: 0,
      })));
      setStep("storyboard");
      toast({ title: "Storyboard created", description: `${storyboardWithDefaults.length} scenes analyzed with multi-model pipeline` });

      // Auto-save project
      try {
        const savedId = await saveProject.mutateAsync({
          id: projectIdRef.current ?? undefined,
          name: brand.name ? `${brand.name} Ad` : "Untitled Ad",
          brandName: brand.name,
          script,
          segments: newSegments,
          storyboard: storyboardWithDefaults,
          clips: storyboardWithDefaults.map(s => ({ sceneId: s.id, status: "idle" as const, progress: 0 })),
          continuity: continuityProfile,
          status: "analyzed",
        });
        projectIdRef.current = savedId;
      } catch (e) {
        console.warn("Auto-save failed:", e);
      }
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
      setAnalysisStatus("");
      setAnalysisProgress(0);
    }
  }, [script, brand, assets, modelOverrides, toast]);

  // ─── Manual Improve Prompt ────────────────────────────────
  const handleImprovePrompt = useCallback(async (sceneId: string) => {
    const scene = storyboard.find(s => s.id === sceneId);
    if (!scene) return;

    setImprovingSceneId(sceneId);
    try {
      const improveRes = await invokeEdgeFunction<{
        result: { prompt: string };
        modelUsed: string;
      }>("ad-director-ai", {
        action: "improve-prompt",
        prompt: scene.prompt,
        qualityScore: scene.promptQuality,
        scene,
        brand,
        modelOverrides,
      }, { timeoutMs: EDGE_TIMEOUT_MS });

      const rescoreRes = await invokeEdgeFunction<{
        result: PromptQualityScore;
        modelUsed: string;
      }>("ad-director-ai", {
        action: "score-prompt-quality",
        prompt: improveRes.result.prompt,
        scene,
        brand,
        modelOverrides,
      }, { timeoutMs: EDGE_TIMEOUT_MS });

      setStoryboard(prev => prev.map(s => s.id === sceneId ? {
        ...s,
        prompt: improveRes.result.prompt,
        promptQuality: rescoreRes.result,
        sceneIntelligence: {
          ...s.sceneIntelligence!,
          promptWrittenBy: improveRes.modelUsed,
          promptScoredBy: rescoreRes.modelUsed,
        },
      } : s));

      toast({ title: "Prompt improved", description: `New quality: ${rescoreRes.result.overall.toFixed(1)}/10` });
    } catch (err: any) {
      toast({ title: "Improvement failed", description: err.message, variant: "destructive" });
    } finally {
      setImprovingSceneId(null);
    }
  }, [storyboard, brand, modelOverrides, toast]);

  // ─── Prompt Edit ──────────────────────────────────────
  const handlePromptChange = (id: string, prompt: string) => {
    const current = storyboard.find(s => s.id === id);
    if (current) promptHistory.push(id, current.prompt);
    setStoryboard(prev => prev.map(s => s.id === id ? { ...s, prompt, promptQuality: undefined } : s));
  };

  const handlePromptUndo = (id: string) => {
    const prev = promptHistory.undo(id);
    if (prev) {
      setStoryboard(st => st.map(s => s.id === id ? { ...s, prompt: prev, promptQuality: undefined } : s));
      toast({ title: "Prompt reverted" });
    }
  };

  const handleContinuityToggle = (id: string) => {
    setStoryboard(prev => prev.map(s => s.id === id ? { ...s, continuityLock: !s.continuityLock } : s));
  };

  // ─── Generate Canvas End Card ────────────────────────────
  const generateEndCardPreview = useCallback((sceneId: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d")!;

    // Gradient background using brand colors
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, brand.primaryColor || "#ef4444");
    grad.addColorStop(1, brand.secondaryColor || "#1e293b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Brand name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(brand.name || "", canvas.width / 2, canvas.height / 2 - 40);

    // Tagline
    ctx.font = "32px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(brand.tagline || "", canvas.width / 2, canvas.height / 2 + 20);

    // CTA
    ctx.font = "24px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(brand.cta || "", canvas.width / 2, canvas.height / 2 + 70);

    // Website
    ctx.font = "bold 28px sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(brand.website || "", canvas.width / 2, canvas.height / 2 + 120);

    const dataUrl = canvas.toDataURL("image/png");
    setClips(prev => prev.map(c =>
      c.sceneId === sceneId
        ? { ...c, status: "completed", videoUrl: dataUrl, progress: 100 }
        : c
    ));
    setStoryboard(prev => prev.map(s => s.id === sceneId ? {
      ...s,
      sceneIntelligence: { ...s.sceneIntelligence!, videoEngine: "Canvas End Card" },
    } : s));
  }, [brand]);

  // ─── Generate Single Scene ──────────────────────────────
  const generateScene = useCallback(async (sceneId: string) => {
    const scene = storyboardRef.current.find(s => s.id === sceneId);
    if (!scene) return;

    // Skip video generation for static-card / closing scenes — render canvas end card instead
    const segment = segments.find(seg => seg.id === scene.segmentId);
    if (scene.generationMode === "static-card" || segment?.type === "closing") {
      generateEndCardPreview(sceneId);
      return;
    }

    // Use videoParams.duration if set, fallback to segment timing
    const rawDur = videoParams.duration > 0 ? videoParams.duration : (segment ? segment.endTime - segment.startTime : 5);
    const sceneDuration = Math.min(Math.max(rawDur, 2), 15);

    // Enforce motion in prompt to avoid static zoom-only results
    const motionPrompt = scene.prompt + " Cinematic camera movement with dynamic subject motion throughout the scene. Avoid static shots.";

    setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, status: "generating", progress: 10 } : c));

    try {
      // Wire videoParams into generation request
      const effectiveRatio = videoParams.ratio === "Smart" ? "16:9" : videoParams.ratio;
      const wanRatio = ["16:9", "9:16", "1:1"].includes(effectiveRatio) ? effectiveRatio : "16:9";

      const result = await invokeEdgeFunction<{
        url?: string; videoUrl?: string; generationId?: string; jobId?: string;
        provider?: "wan" | "veo" | "sora"; mode?: string; imageUrls?: string[];
      }>(
        "generate-video",
        {
          action: "generate",
          prompt: motionPrompt,
          duration: sceneDuration,
          aspectRatio: wanRatio,
          provider: "wan",
          model: "wan2.6-t2v",
          negativePrompt: "static image, zoom only, no motion, blurry, text overlay, watermark, on-screen text, brand name, camera name, ARRI, RED, Sony",
        },
        { timeoutMs: EDGE_TIMEOUT_MS }
      );

      const videoUrl = result.url || result.videoUrl;
      const genId = result.jobId || result.generationId;
      const provider = result.provider || "wan";

      // Slideshow fallback — treat first image as completed thumbnail
      if (result.mode === "slideshow" && result.imageUrls?.length) {
        setClips(prev => prev.map(c =>
          c.sceneId === sceneId
            ? { ...c, status: "completed", videoUrl: result.imageUrls![0], progress: 100 }
            : c
        ));
        setStoryboard(prev => prev.map(s => s.id === sceneId ? {
          ...s,
          sceneIntelligence: { ...s.sceneIntelligence!, videoEngine: "Slideshow Fallback" },
        } : s));
      } else if (videoUrl) {
        setClips(prev => prev.map(c =>
          c.sceneId === sceneId
            ? { ...c, status: "completed", videoUrl, progress: 100, generationId: genId }
            : c
        ));
        setStoryboard(prev => prev.map(s => s.id === sceneId ? {
          ...s,
          sceneIntelligence: { ...s.sceneIntelligence!, videoEngine: "Alibaba Wan 2.6" },
        } : s));
      } else if (genId) {
        setClips(prev => prev.map(c =>
          c.sceneId === sceneId
            ? { ...c, status: "generating", generationId: genId, progress: 30 }
            : c
        ));
        pollGeneration(sceneId, genId, provider);
      } else {
        setClips(prev => prev.map(c =>
          c.sceneId === sceneId
            ? { ...c, status: "failed", error: "No job id or video URL returned", progress: 0 }
            : c
        ));
      }
    } catch (err: any) {
      setClips(prev => prev.map(c =>
        c.sceneId === sceneId
          ? { ...c, status: "failed", error: err.message, progress: 0 }
          : c
      ));
    }
  }, [storyboard, segments, videoParams]);

  const pollGeneration = async (sceneId: string, generationId: string, provider: "wan" | "veo" | "sora" = "wan") => {
    const maxAttempts = 120;
    let consecutiveErrors = 0;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const result = await invokeEdgeFunction<{ status?: string; videoUrl?: string; url?: string }>(
          "generate-video",
          { action: "poll", jobId: generationId, provider }
        );

        consecutiveErrors = 0;

        if (result.status === "completed" || result.videoUrl || result.url) {
          const videoUrl = result.videoUrl || result.url;
          if (!videoUrl) {
            setClips(prev => prev.map(c =>
              c.sceneId === sceneId
                ? { ...c, status: "failed", error: "Generation completed but no video URL was returned", progress: 0 }
                : c
            ));
            return;
          }
          setClips(prev => prev.map(c =>
            c.sceneId === sceneId
              ? { ...c, status: "completed", videoUrl, progress: 100 }
              : c
          ));
          return;
        }
        if (result.status === "failed") {
          setClips(prev => prev.map(c =>
            c.sceneId === sceneId
              ? { ...c, status: "failed", error: "Generation failed", progress: 0 }
              : c
          ));
          return;
        }
        setClips(prev => prev.map(c =>
          c.sceneId === sceneId
            ? { ...c, progress: Math.min(90, 30 + (i / maxAttempts) * 60) }
            : c
        ));
      } catch (err: any) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 3) {
          setClips(prev => prev.map(c =>
            c.sceneId === sceneId
              ? { ...c, status: "failed", error: err?.message || "Polling failed repeatedly", progress: 0 }
              : c
          ));
          return;
        }
      }
    }
    setClips(prev => prev.map(c =>
      c.sceneId === sceneId
        ? { ...c, status: "failed", error: "Generation timed out", progress: 0 }
        : c
    ));
  };

  // ─── Generate All (with buildQty support) ──────────────
  const handleGenerateAll = useCallback(async () => {
    const buildQty = videoParams.buildQty || 1;
    const baseScenes = storyboard;

    if (buildQty <= 1) {
      // Single build — original behaviour
      const scenesToGen = baseScenes.filter(s => {
        const c = clips.find(c => c.sceneId === s.id);
        return c?.status !== "completed";
      });
      let launched = 0;
      for (const scene of scenesToGen) {
        launched++;
        setGenerationStatus(`Generating scene ${launched} of ${scenesToGen.length}...`);
        await generateScene(scene.id);
        await new Promise(r => setTimeout(r, 2000));
      }
      setGenerationStatus("");
      setStep("preview");
      toast({ title: "Generation complete", description: `${scenesToGen.length} scenes generated.` });
      return;
    }

    // Multi-build: run the full pipeline buildQty times, each producing a complete set of clips
    const newBuilds: { buildIndex: number; clips: ClipOutput[] }[] = [];
    for (let b = 0; b < buildQty; b++) {
      newBuilds.push({
        buildIndex: b,
        clips: baseScenes.map(s => ({ sceneId: s.id, status: "idle" as const, progress: 0 })),
      });
    }
    setBuilds(newBuilds);
    setActiveBuildIndex(0);

    const totalJobs = baseScenes.length * buildQty;
    let launched = 0;

    for (let b = 0; b < buildQty; b++) {
      setActiveBuildIndex(b);
      // Set the main clips state to this build's clips so generateScene updates the right entries
      setClips(newBuilds[b].clips);

      for (const scene of baseScenes) {
        launched++;
        setGenerationStatus(`Build ${b + 1}/${buildQty} — scene ${launched} of ${totalJobs}...`);
        await generateScene(scene.id);
        await new Promise(r => setTimeout(r, 2000));
      }

      // Snapshot current clips state into the build
      setClips(prev => {
        newBuilds[b] = { ...newBuilds[b], clips: [...prev] };
        setBuilds([...newBuilds]);
        return prev;
      });
    }

    // Set active build to first and load its clips
    setActiveBuildIndex(0);
    setClips(newBuilds[0].clips);
    setGenerationStatus("");
    setStep("preview");
    toast({ title: "All versions generated", description: `${buildQty} ad versions × ${baseScenes.length} scenes completed.` });
  }, [storyboard, clips, generateScene, toast, videoParams.buildQty]);

  // ─── Export ──────────────────────────────────────
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const completedClips = clips.filter(c => c.status === "completed" && c.videoUrl);
      if (completedClips.length === 0) throw new Error("No clips to export");

      toast({ title: "Assembling ad...", description: "Generating voiceover, stitching clips..." });

      // 1. Build ordered clip list with target durations from storyboard
      let scenesForExport = [...storyboard];
      // When end card is enabled, replace the last scene with the branded end card
      if (endCardEnabled && scenesForExport.length > 1) {
        scenesForExport = scenesForExport.slice(0, -1);
      }

      const orderedClips = scenesForExport
        .map(scene => {
          const clip = clips.find(c => c.sceneId === scene.id);
          const segment = segments.find(s => s.id === scene.segmentId);
          const targetDur = segment ? segment.endTime - segment.startTime : 5;
          return clip?.status === "completed" && clip.videoUrl
            ? { videoUrl: clip.videoUrl, targetDuration: targetDur }
            : null;
        })
        .filter(Boolean) as { videoUrl: string; targetDuration: number }[];

      if (orderedClips.length === 0) throw new Error("No completed clips in storyboard order");

      // 2. Generate voiceover BEFORE stitching so audio can be mixed in one pass
      let audioUrl: string | undefined;
      try {
        const fullNarration = segments.map(s => s.text).join(" ");
        if (fullNarration.trim().length > 0) {
          const ttsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;
          const ttsResponse = await fetch(ttsUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ text: fullNarration }),
          });

          if (ttsResponse.ok) {
            const audioBlob = await ttsResponse.blob();
            audioUrl = URL.createObjectURL(audioBlob);
          } else {
            console.warn("TTS failed, exporting without voiceover");
            toast({ title: "Voiceover skipped", description: "TTS service unavailable. Exporting silent video.", variant: "destructive" });
          }
        }
      } catch (voErr: any) {
        console.warn("Voiceover generation failed:", voErr);
        toast({ title: "Voiceover skipped", description: voErr.message || "TTS failed. Exporting silent video.", variant: "destructive" });
      }

      // 2b. Try server-side assembly first (GCE)
      let serverAssemblyUrl: string | null = null;
      try {
        const gceResult = await invokeEdgeFunction<{ fallback?: boolean; expectedOutputUrl?: string; status?: string }>(
          "gce-video-assembly",
          {
            clips: orderedClips,
            logoUrl: brand.logoUrl,
            brand: { name: brand.name, tagline: brand.tagline, website: brand.website, primaryColor: brand.primaryColor, bgColor: brand.secondaryColor },
            subtitles: subtitlesEnabled ? segments.map(s => ({ text: s.text, startTime: s.startTime, endTime: s.endTime })) : [],
            endCard: endCardEnabled,
            audioUrl,
          }
        );
        if (!gceResult.fallback && gceResult.expectedOutputUrl) {
          serverAssemblyUrl = gceResult.expectedOutputUrl;
          // TODO: Poll GCS for completion in production
        }
      } catch (e) {
        console.warn("GCE assembly unavailable, using browser fallback:", e);
      }

      // 3. Stitch clips with overlays + audio in a single pass (browser fallback)
      const finalUrl = await stitchClips(orderedClips, {
        logo: {
          url: brand.logoUrl || "",
          enabled: !!brand.logoUrl,
          size: 80,
        },
        endCard: {
          enabled: endCardEnabled,
          brandName: brand.name,
          tagline: brand.tagline,
          website: brand.website,
          primaryColor: brand.primaryColor,
          bgColor: brand.secondaryColor,
          logoUrl: brand.logoUrl,
        },
        subtitles: {
          enabled: subtitlesEnabled,
          segments: segments.map(s => ({ text: s.text, startTime: s.startTime, endTime: s.endTime })),
        },
        audioUrl,
        musicUrl: musicTrackUrl || undefined,
        musicVolume: 0.15,
      });

      setFinalVideoUrl(finalUrl.blobUrl);
      toast({ title: "Ad assembled!", description: `${orderedClips.length} scenes stitched — ${finalUrl.duration.toFixed(1)}s, ${(finalUrl.blob.size / 1024 / 1024).toFixed(1)}MB` });

      // Auto-save project as completed
      try {
        await saveProject.mutateAsync({
          id: projectIdRef.current ?? undefined,
          name: brand.name ? `${brand.name} Ad` : "Untitled Ad",
          brandName: brand.name,
          script,
          segments,
          storyboard,
          clips,
          continuity,
          status: "completed",
        });
      } catch (e) {
        console.warn("Auto-save failed:", e);
      }
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, [clips, storyboard, segments, brand, endCardEnabled, subtitlesEnabled, toast]);

  const handleDownload = () => {
    if (!finalVideoUrl) return;
    const a = document.createElement("a");
    a.href = finalVideoUrl;
    a.download = `${brand.name.replace(/\s+/g, "-")}-30s-ad.webm`;
    a.click();
  };

  // ─── Load Project from History ──────────────────────────
  const handleLoadProject = useCallback((project: AdProjectRow) => {
    setScript(project.script ?? "");
    setSegments(project.segments ?? []);
    setStoryboard(project.storyboard ?? []);
    setContinuity(project.continuity ?? null);
    setClips(project.clips ?? []);
    setFinalVideoUrl(project.final_video_url);
    projectIdRef.current = project.id;

    const hasCompletedClips = (project.clips ?? []).some(
      (c: any) => c.status === "completed" && c.videoUrl
    );
    if (hasCompletedClips) {
      setStep("preview");
    } else if (project.storyboard?.length > 0) {
      setStep("storyboard");
    }
    toast({ title: "Project loaded", description: project.name });
  }, [toast]);

  // ─── Auto-save clips to storage on completion ────────────
  useEffect(() => {
    const uploadCompletedClips = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      for (const clip of clips) {
        if (clip.status === "completed" && clip.videoUrl && !clip.videoUrl.includes("generated-videos")) {
          try {
            const resp = await fetch(clip.videoUrl);
            if (!resp.ok) continue;
            const blob = await resp.blob();
            const fileName = `${user.id}/${crypto.randomUUID()}.mp4`;
            const { error } = await supabase.storage
              .from("generated-videos")
              .upload(fileName, blob, { contentType: "video/mp4", upsert: false });
            if (!error) {
              const { data: publicData } = supabase.storage.from("generated-videos").getPublicUrl(fileName);
              setClips(prev => prev.map(c =>
                c.sceneId === clip.sceneId ? { ...c, videoUrl: publicData.publicUrl } : c
              ));
            }
          } catch (e) {
            console.warn("Clip upload failed:", e);
          }
        }
      }
    };
    const hasNewCompleted = clips.some(c => c.status === "completed" && c.videoUrl && !c.videoUrl.includes("generated-videos"));
    if (hasNewCompleted) {
      uploadCompletedClips();
    }

    // Auto-save project when clips have completed with storage URLs
    const hasStorageClips = clips.some(c => c.status === "completed" && c.videoUrl?.includes("generated-videos"));
    if (hasStorageClips && projectIdRef.current) {
      saveProject.mutate({
        id: projectIdRef.current,
        name: brand.name + " Ad",
        brandName: brand.name,
        script,
        segments,
        storyboard,
        clips,
        continuity,
        finalVideoUrl,
        status: finalVideoUrl ? "completed" : "generating",
      });
    }
  }, [clips]);

  return (
    <div className="space-y-6">
      {/* Global Progress — visible on all tabs */}
      {(analyzing || generatingAny || exporting) && (() => {
        const genTotal = clips.length;
        const genCompleted = clips.filter(c => c.status === "completed").length;
        const genProgress = genTotal > 0 ? Math.round((genCompleted / genTotal) * 100) : 0;
        const statusText = analyzing
          ? analysisStatus
          : generatingAny
            ? (generationStatus || `Generating scenes... ${genCompleted}/${genTotal} completed`)
            : "Exporting...";
        const progressValue = analyzing ? analysisProgress : generatingAny ? genProgress : undefined;
        return (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
              <span className="text-sm font-medium text-foreground">{statusText}</span>
              {progressValue !== undefined && (
                <span className="ml-auto text-xs text-muted-foreground">{progressValue}%</span>
              )}
            </div>
            {progressValue !== undefined && <Progress value={progressValue} className="h-2" />}
          </div>
        );
      })()}

      {/* Step Indicator */}
      <StepIndicator
        step={step}
        onStepChange={setStep}
        segments={segments}
        storyboard={storyboard}
        clips={clips}
      />

      {/* Loading skeleton while brand kit loads */}
      {brandLoading && step === "script" && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[260px] w-full" />
        </div>
      )}
      {step !== "preview" && externalActiveTab && (
        <div className="fixed left-60 top-20 z-40 w-72 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-border/40 bg-card/95 backdrop-blur-md shadow-xl p-4 animate-in slide-in-from-left-4 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold capitalize">{externalActiveTab.replace("-", " ")}</h3>
            <button
              onClick={() => onActiveTabChanged?.(null)}
              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {externalActiveTab === "stock-images" && <StockImagesTab />}
          {externalActiveTab === "stock-video" && <StockVideoTab />}
          {externalActiveTab === "templates" && <TemplatesTab />}
          {externalActiveTab === "graphics" && <GraphicsTab />}
          {externalActiveTab === "transitions" && <TransitionsTab activeTransition="None" onSelect={() => {}} />}
          {externalActiveTab === "text" && <TextTab onAddText={() => toast({ title: "Coming soon", description: "Text overlays are available in the Preview editor" })} />}
          {externalActiveTab === "record" && <RecordTab />}
          {externalActiveTab === "music" && <MusicTab />}
          {externalActiveTab === "media" && (
            <div className="text-xs text-muted-foreground py-4 text-center">Media library is available in the Preview editor step.</div>
          )}
          {externalActiveTab === "settings" && (
            <div className="text-xs text-muted-foreground py-4 text-center">Filters & effects are available in the Preview editor step.</div>
          )}
          {externalActiveTab === "brand-kit" && (
            <BrandKitSidePanel
              brand={brand}
              onBrandChange={setBrand}
              onSaveBrandKit={() => saveBrandKit.mutate(brand)}
              savingBrandKit={saveBrandKit.isPending}
            />
          )}
        </div>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {step === "script" && (
          <div className="lg:col-span-3">
            <ScriptInput
              script={script}
              brand={brand}
              onScriptChange={setScript}
              onBrandChange={setBrand}
              onAnalyze={handleAnalyze}
              analyzing={analyzing}
              analysisStatus={analysisStatus}
              assets={assets}
              onAssetsChange={setAssets}
              modelOverrides={modelOverrides}
              onModelOverridesChange={setModelOverrides}
              onSaveBrandKit={() => saveBrandKit.mutate(brand)}
              savingBrandKit={saveBrandKit.isPending}
              onLoadProject={handleLoadProject}
              videoParams={videoParams}
              onVideoParamsChange={setVideoParams}
            />
          </div>
        )}

        {step === "storyboard" && (
          <>
            <div className="lg:col-span-2 space-y-3">
              {/* Build version tabs */}
              {builds.length > 1 && (
                <div className="flex items-center gap-1 rounded-lg border border-border/30 bg-card/30 p-1 w-fit">
                  {builds.map((b) => (
                    <button
                      key={b.buildIndex}
                      onClick={() => {
                        setActiveBuildIndex(b.buildIndex);
                        setClips(b.clips);
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                        activeBuildIndex === b.buildIndex
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      )}
                    >
                      Version {b.buildIndex + 1}
                      {b.clips.every(c => c.status === "completed") && (
                        <Check className="w-3 h-3 ml-1 inline" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              <StoryboardTimeline
                segments={segments}
                storyboard={storyboard}
                clips={clips}
                onPromptChange={handlePromptChange}
                onContinuityToggle={handleContinuityToggle}
                onRegenerate={generateScene}
                onGenerateAll={handleGenerateAll}
                generatingAny={generatingAny}
                onImprovePrompt={handleImprovePrompt}
                improvingSceneId={improvingSceneId}
                logoUrl={brand.logoUrl}
                onPromptUndo={handlePromptUndo}
                canUndoPrompt={promptHistory.canUndo}
              />
            </div>
            <div className="space-y-4">
              <ContinuityInspector profile={continuity} />
              <FinalPreview
                clips={clips}
                storyboard={storyboard}
                segments={segments}
                subtitlesEnabled={subtitlesEnabled}
                logoEnabled={logoEnabled}
                endCardEnabled={endCardEnabled}
                onToggleSubtitles={() => setSubtitlesEnabled(!subtitlesEnabled)}
                onToggleLogo={() => {}} // Logo is mandatory — no toggle
                onToggleEndCard={() => setEndCardEnabled(!endCardEnabled)}
                onExport={handleExport}
                exporting={exporting}
                finalVideoUrl={finalVideoUrl}
                onOpenExportDialog={() => setExportDialogOpen(true)}
              />
            </div>
          </>
        )}

        {step === "preview" && (
          <div className="lg:col-span-3 space-y-4">
            <ProVideoEditor
              clips={clips}
              storyboard={storyboard}
              segments={segments}
              brand={brand}
              finalVideoUrl={finalVideoUrl}
              onBack={() => setStep("storyboard")}
              onExport={handleExport}
              exporting={exporting}
              onOpenExportDialog={() => setExportDialogOpen(true)}
              onRegenerateScene={generateScene}
              onUpdateClipUrl={(sceneId, url) => setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, status: "completed" as const, videoUrl: url, progress: 100 } : c))}
              onUpdateSegment={(id, text) => setSegments(prev => prev.map(s => s.id === id ? { ...s, text } : s))}
              onUpdateSegmentTiming={(id, startTime, endTime) => setSegments(prev => prev.map(s => s.id === id ? { ...s, startTime, endTime } : s))}
              onUpdateStoryboard={setStoryboard}
              onUpdateBrand={setBrand}
              onMusicSelect={setMusicTrackUrl}
              externalActiveTab={externalActiveTab}
              onActiveTabChanged={onActiveTabChanged}
            />
          </div>
        )}
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        finalVideoUrl={finalVideoUrl}
        brandName={brand.name}
        onExport={handleExport}
        exporting={exporting}
      />
    </div>
  );
}
