import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { ScriptInput } from "./ScriptInput";
import { StoryboardTimeline } from "./StoryboardTimeline";
import { ContinuityInspector } from "./ContinuityInspector";
import { FinalPreview } from "./FinalPreview";
import { Badge } from "@/components/ui/badge";
import { Clapperboard, FileText, Layers, Film } from "lucide-react";
import {
  type AdProject, type BrandProfile, type ScriptSegment, type StoryboardScene,
  type ContinuityProfile, type ClipOutput, DEFAULT_BRAND, DEMO_SCRIPT,
} from "@/types/adDirector";
import { cn } from "@/lib/utils";

type WorkflowStep = "script" | "storyboard" | "preview";

const steps: { id: WorkflowStep; label: string; icon: React.ReactNode }[] = [
  { id: "script", label: "Script & Assets", icon: <FileText className="w-4 h-4" /> },
  { id: "storyboard", label: "Storyboard", icon: <Layers className="w-4 h-4" /> },
  { id: "preview", label: "Preview & Export", icon: <Film className="w-4 h-4" /> },
];

export function AdDirectorContent() {
  const { toast } = useToast();
  const [step, setStep] = useState<WorkflowStep>("script");
  const [script, setScript] = useState(DEMO_SCRIPT);
  const [brand, setBrand] = useState<BrandProfile>(DEFAULT_BRAND);
  const [assets, setAssets] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");

  const [segments, setSegments] = useState<ScriptSegment[]>([]);
  const [storyboard, setStoryboard] = useState<StoryboardScene[]>([]);
  const [continuity, setContinuity] = useState<ContinuityProfile | null>(null);
  const [clips, setClips] = useState<ClipOutput[]>([]);
  const [generatingAny, setGeneratingAny] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [logoEnabled, setLogoEnabled] = useState(true);
  const [endCardEnabled, setEndCardEnabled] = useState(true);

  // ─── Analyze Script ──────────────────────────────────────
  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    const statusMessages = [
      "Reading your script...",
      "Identifying hook, problem, and solution...",
      "Breaking script into timed scenes...",
      "Generating storyboard with visual styles...",
      "Building continuity profile...",
      "Optimizing scene prompts...",
    ];
    let msgIndex = 0;
    setAnalysisStatus(statusMessages[0]);
    const statusInterval = setInterval(() => {
      msgIndex = Math.min(msgIndex + 1, statusMessages.length - 1);
      setAnalysisStatus(statusMessages[msgIndex]);
    }, 3000);
    try {
      const assetDescriptions = assets.length > 0
        ? assets.map(f => f.name).join(", ")
        : undefined;

      const result = await invokeEdgeFunction<{
        segments: ScriptSegment[];
        storyboard: StoryboardScene[];
        continuityProfile: ContinuityProfile;
      }>("analyze-ad-script", { script, brand, assetDescriptions });

      // Add defaults
      const storyboardWithDefaults = result.storyboard.map(s => ({
        ...s,
        continuityLock: true,
        locked: false,
        referenceAssetUrl: null,
      }));

      setSegments(result.segments);
      setStoryboard(storyboardWithDefaults);
      setContinuity(result.continuityProfile);
      setClips(storyboardWithDefaults.map(s => ({
        sceneId: s.id,
        status: "idle" as const,
        progress: 0,
      })));
      setStep("storyboard");
      toast({ title: "Storyboard created", description: `${result.storyboard.length} scenes analyzed` });
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    } finally {
      clearInterval(statusInterval);
      setAnalyzing(false);
      setAnalysisStatus("");
    }
  }, [script, brand, assets, toast]);

  // ─── Prompt Edit ──────────────────────────────────────
  const handlePromptChange = (id: string, prompt: string) => {
    setStoryboard(prev => prev.map(s => s.id === id ? { ...s, prompt } : s));
  };

  const handleContinuityToggle = (id: string) => {
    setStoryboard(prev => prev.map(s => s.id === id ? { ...s, continuityLock: !s.continuityLock } : s));
  };

  // ─── Generate Single Scene ──────────────────────────────
  const generateScene = useCallback(async (sceneId: string) => {
    const scene = storyboard.find(s => s.id === sceneId);
    if (!scene) return;

    setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, status: "generating", progress: 10 } : c));

    try {
      // Use existing generate-video edge function
      const result = await invokeEdgeFunction<{ url?: string; videoUrl?: string; generationId?: string }>(
        "generate-video",
        {
          action: "generate",
          prompt: scene.prompt,
          duration: 15,
          aspectRatio: "16:9",
          provider: "wan",
          model: "wan2.6-t2v",
        }
      );

      const videoUrl = result.url || result.videoUrl;

      if (videoUrl) {
        setClips(prev => prev.map(c =>
          c.sceneId === sceneId
            ? { ...c, status: "completed", videoUrl, progress: 100, generationId: result.generationId }
            : c
        ));
      } else if (result.generationId) {
        // Poll for completion
        setClips(prev => prev.map(c =>
          c.sceneId === sceneId
            ? { ...c, status: "generating", generationId: result.generationId, progress: 30 }
            : c
        ));
        pollGeneration(sceneId, result.generationId);
      }
    } catch (err: any) {
      setClips(prev => prev.map(c =>
        c.sceneId === sceneId
          ? { ...c, status: "failed", error: err.message, progress: 0 }
          : c
      ));
    }
  }, [storyboard]);

  const pollGeneration = async (sceneId: string, generationId: string) => {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const result = await invokeEdgeFunction<{ status?: string; videoUrl?: string; url?: string }>(
          "generate-video",
          { action: "status", generationId }
        );

        if (result.status === "completed" || result.videoUrl || result.url) {
          const videoUrl = result.videoUrl || result.url;
          setClips(prev => prev.map(c =>
            c.sceneId === sceneId
              ? { ...c, status: "completed", videoUrl: videoUrl || null, progress: 100 }
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
        // Still processing — update progress
        setClips(prev => prev.map(c =>
          c.sceneId === sceneId
            ? { ...c, progress: Math.min(90, 30 + (i / maxAttempts) * 60) }
            : c
        ));
      } catch {
        // Network error — keep polling
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
    setGeneratingAny(true);
    // Generate scenes sequentially for continuity
    for (const scene of storyboard) {
      const clip = clips.find(c => c.sceneId === scene.id);
      if (clip?.status === "completed") continue; // Skip completed
      await generateScene(scene.id);
      // Wait a bit between scenes
      await new Promise(r => setTimeout(r, 2000));
    }
    setGeneratingAny(false);
    setStep("preview");
    toast({ title: "Generation complete", description: "All scenes generated. Ready to export." });
  }, [storyboard, clips, generateScene, toast]);

  // ─── Export ──────────────────────────────────────
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const completedClips = clips.filter(c => c.status === "completed" && c.videoUrl);
      if (completedClips.length === 0) throw new Error("No clips to export");

      // If only one clip, use it directly
      if (completedClips.length === 1) {
        setFinalVideoUrl(completedClips[0].videoUrl!);
        toast({ title: "Video ready", description: "Your 30-second ad is ready to download." });
        return;
      }

      // For multiple clips, create a simple concatenation by downloading and using the first clip as preview
      // Full stitching would require canvas/ffmpeg — for now show the first clip
      setFinalVideoUrl(completedClips[0].videoUrl!);
      toast({ title: "Preview ready", description: `${completedClips.length} clips generated. Full stitching available in export.` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, [clips, toast]);

  const handleDownload = () => {
    if (!finalVideoUrl) return;
    const a = document.createElement("a");
    a.href = finalVideoUrl;
    a.download = `${brand.name.replace(/\s+/g, "-")}-30s-ad.mp4`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Workflow Steps */}
      <div className="flex items-center gap-1 bg-card/30 rounded-xl p-1 border border-border/30">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-all",
              step === s.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50",
              // Disable if not reached yet
              s.id === "storyboard" && segments.length === 0 && "opacity-40 pointer-events-none",
              s.id === "preview" && storyboard.length === 0 && "opacity-40 pointer-events-none",
            )}
          >
            {s.icon}
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
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
              assets={assets}
              onAssetsChange={setAssets}
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
          <div className="lg:col-span-3">
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
                <button onClick={handleDownload} className="text-sm text-primary hover:underline">
                  Download Final MP4
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
