import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { ScriptInput } from "./ScriptInput";
import { StoryboardTimeline } from "./StoryboardTimeline";
import { ContinuityInspector } from "./ContinuityInspector";
import { FinalPreview } from "./FinalPreview";
import { Progress } from "@/components/ui/progress";
import { FileText, Layers, Film, Loader2, ArrowLeft } from "lucide-react";
import {
  type BrandProfile, type ScriptSegment, type StoryboardScene,
  type ContinuityProfile, type ClipOutput, type ModelOverrides,
  type PromptQualityScore, DEFAULT_BRAND, DEMO_SCRIPT,
} from "@/types/adDirector";
import { cn } from "@/lib/utils";
import { stitchClips } from "@/lib/videoStitch";
import { useAdDirectorBrandKit } from "@/hooks/useAdDirectorBrandKit";
import { useAdProjectHistory, type AdProjectRow } from "@/hooks/useAdProjectHistory";
import { supabase } from "@/integrations/supabase/client";


import { Check } from "lucide-react";

type WorkflowStep = "script" | "storyboard" | "preview";

const steps: { id: WorkflowStep; label: string; desc: string; icon: React.ReactNode }[] = [
  { id: "script", label: "Script & Assets", desc: "Write or paste your ad script", icon: <FileText className="w-4 h-4" /> },
  { id: "storyboard", label: "Storyboard", desc: "Review scenes & prompts", icon: <Layers className="w-4 h-4" /> },
  { id: "preview", label: "Preview & Export", desc: "Assemble & download", icon: <Film className="w-4 h-4" /> },
];

const QUALITY_THRESHOLD = 7.0;
const MAX_IMPROVE_ATTEMPTS = 2;

const EDGE_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, ms = EDGE_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out — the AI model took too long. Please try again.")), ms)
    ),
  ]);
}

export function AdDirectorContent() {
  const { toast } = useToast();
  const { savedBrand, isLoading: brandLoading, saveBrandKit } = useAdDirectorBrandKit();
  const { saveProject } = useAdProjectHistory();
  const projectIdRef = useRef<string | null>(null);
  const [step, setStep] = useState<WorkflowStep>("script");
  const [script, setScript] = useState("");
  const [brand, setBrand] = useState<BrandProfile>(DEFAULT_BRAND);

  // Load saved brand kit on mount
  useEffect(() => {
    if (savedBrand && !brandLoading) {
      setBrand(savedBrand);
    }
  }, [savedBrand, brandLoading]);

  const [assets, setAssets] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");
  const [modelOverrides, setModelOverrides] = useState<ModelOverrides>({});

  const [segments, setSegments] = useState<ScriptSegment[]>([]);
  const [storyboard, setStoryboard] = useState<StoryboardScene[]>([]);
  const [continuity, setContinuity] = useState<ContinuityProfile | null>(null);
  const [clips, setClips] = useState<ClipOutput[]>([]);
  // Derive generatingAny reactively from clips state
  const generatingAny = clips.some(c => c.status === "generating");
  const [exporting, setExporting] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [improvingSceneId, setImprovingSceneId] = useState<string | null>(null);

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [logoEnabled, setLogoEnabled] = useState(true);
  const [endCardEnabled, setEndCardEnabled] = useState(true);

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
      }));

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
            }));
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
            }));
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
              }));

              // Re-score
              const rescoreRes = await withTimeout(invokeEdgeFunction<{
                result: PromptQualityScore;
              }>("ad-director-ai", {
                action: "score-prompt-quality",
                prompt: improveRes.result.prompt,
                scene: rawStoryboard[idx],
                brand,
                modelOverrides,
              }));

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
      });

      const rescoreRes = await invokeEdgeFunction<{
        result: PromptQualityScore;
        modelUsed: string;
      }>("ad-director-ai", {
        action: "score-prompt-quality",
        prompt: improveRes.result.prompt,
        scene,
        brand,
        modelOverrides,
      });

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
    setStoryboard(prev => prev.map(s => s.id === id ? { ...s, prompt, promptQuality: undefined } : s));
  };

  const handleContinuityToggle = (id: string) => {
    setStoryboard(prev => prev.map(s => s.id === id ? { ...s, continuityLock: !s.continuityLock } : s));
  };

  // ─── Generate Single Scene ──────────────────────────────
  const generateScene = useCallback(async (sceneId: string) => {
    const scene = storyboard.find(s => s.id === sceneId);
    if (!scene) return;

    // Calculate duration from script segment timing
    const segment = segments.find(seg => seg.id === scene.segmentId);
    const rawDur = segment ? segment.endTime - segment.startTime : 5;
    const sceneDuration = Math.min(Math.max(rawDur, 2), 15);

    // Enforce motion in prompt to avoid static zoom-only results
    const motionPrompt = scene.prompt + " Cinematic camera movement with dynamic subject motion throughout the scene. Avoid static shots.";

    setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, status: "generating", progress: 10 } : c));

    try {
      const result = await invokeEdgeFunction<{
        url?: string; videoUrl?: string; generationId?: string; jobId?: string;
        provider?: "wan" | "veo" | "sora"; mode?: string; imageUrls?: string[];
      }>(
        "generate-video",
        {
          action: "generate",
          prompt: motionPrompt,
          duration: sceneDuration,
          aspectRatio: "16:9",
          provider: "wan",
          model: "wan2.6-t2v",
          negativePrompt: "static image, zoom only, no motion, blurry, text overlay, watermark",
        }
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
  }, [storyboard, segments]);

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

  // ─── Generate All ──────────────────────────────────────
  const handleGenerateAll = useCallback(async () => {
    const scenesToGenerate = storyboard.filter(s => {
      const c = clips.find(c => c.sceneId === s.id);
      return c?.status !== "completed";
    });
    const total = scenesToGenerate.length;
    let launched = 0;
    for (const scene of scenesToGenerate) {
      launched++;
      setGenerationStatus(`Launching scene ${launched} of ${total}...`);
      await generateScene(scene.id);
      await new Promise(r => setTimeout(r, 2000));
    }
    setGenerationStatus("");
    setStep("preview");
    toast({ title: "All scenes launched", description: "Scenes are generating. Check progress below." });
  }, [storyboard, clips, generateScene, toast]);

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

      // 3. Stitch clips with overlays + audio in a single pass
      const finalUrl = await stitchClips(orderedClips, {
        logo: {
          url: brand.logoUrl || "",
          enabled: logoEnabled && !!brand.logoUrl,
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
  }, [clips, storyboard, segments, brand, logoEnabled, endCardEnabled, subtitlesEnabled, toast]);

  const handleDownload = () => {
    if (!finalVideoUrl) return;
    const a = document.createElement("a");
    a.href = finalVideoUrl;
    a.download = `${brand.name.replace(/\s+/g, "-")}-30s-ad.webm`;
    a.click();
  };

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
      <div className="flex items-center justify-center gap-0">
        {steps.map((s, idx) => {
          const stepOrder = ["script", "storyboard", "preview"];
          const currentIdx = stepOrder.indexOf(step);
          const thisIdx = stepOrder.indexOf(s.id);
          const isCompleted = thisIdx < currentIdx;
          const isActive = s.id === step;
          const isDisabled = (s.id === "storyboard" && segments.length === 0) || (s.id === "preview" && storyboard.length === 0);

          return (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => !isDisabled && setStep(s.id)}
                disabled={isDisabled}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                  isActive && "bg-primary/10 ring-1 ring-primary/30",
                  !isActive && !isDisabled && "hover:bg-card/50",
                  isDisabled && "opacity-30 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0",
                  isCompleted && "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30",
                  isActive && "bg-primary text-primary-foreground shadow-md shadow-primary/30",
                  !isActive && !isCompleted && "bg-card/50 text-muted-foreground ring-1 ring-border/30"
                )}>
                  {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                <div className="hidden sm:block text-left">
                  <div className={cn("text-xs font-semibold", isActive ? "text-foreground" : "text-muted-foreground")}>{s.label}</div>
                  <div className="text-[10px] text-muted-foreground/70">{s.desc}</div>
                </div>
              </button>
              {idx < steps.length - 1 && (
                <div className={cn(
                  "w-12 h-[2px] mx-1 hidden sm:block rounded-full",
                  isCompleted ? "bg-emerald-500/40" : "bg-border/30"
                )} />
              )}
            </div>
          );
        })}
      </div>

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
            />
          </div>
        )}

        {step === "storyboard" && (
          <>
            <div className="lg:col-span-2">
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
                onToggleLogo={() => setLogoEnabled(!logoEnabled)}
                onToggleEndCard={() => setEndCardEnabled(!endCardEnabled)}
                onExport={handleExport}
                exporting={exporting}
                finalVideoUrl={finalVideoUrl}
              />
            </div>
          </>
        )}

        {step === "preview" && (
          <div className="lg:col-span-3 space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep("storyboard")} className="gap-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Storyboard
            </Button>
            <FinalPreview
              clips={clips}
              storyboard={storyboard}
              segments={segments}
              subtitlesEnabled={subtitlesEnabled}
              logoEnabled={logoEnabled}
              endCardEnabled={endCardEnabled}
              onToggleSubtitles={() => setSubtitlesEnabled(!subtitlesEnabled)}
              onToggleLogo={() => setLogoEnabled(!logoEnabled)}
              onToggleEndCard={() => setEndCardEnabled(!endCardEnabled)}
              onExport={handleExport}
              exporting={exporting}
              finalVideoUrl={finalVideoUrl}
            />
            {finalVideoUrl && (
              <div className="mt-4 flex justify-center">
                <Button onClick={handleDownload} variant="outline" className="gap-2 rounded-2xl px-6">
                  <Film className="w-4 h-4" />
                  Download Final Video
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
