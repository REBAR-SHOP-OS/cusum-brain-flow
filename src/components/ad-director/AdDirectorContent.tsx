import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { ProVideoEditor } from "./ProVideoEditor";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check, Download, Pencil, Sparkles, Film, Play, AlertCircle, Home, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ExportDialog } from "./ExportDialog";
import { ChatPromptBar } from "./ChatPromptBar";
import {
  type BrandProfile, type ScriptSegment, type StoryboardScene,
  type ContinuityProfile, type ClipOutput, type ModelOverrides,
  DEFAULT_BRAND,
} from "@/types/adDirector";
import { usePromptHistory } from "@/hooks/usePromptHistory";
import { stitchClips } from "@/lib/videoStitch";
import { VideoHistory } from "./VideoHistory";
import { useAdDirectorBrandKit } from "@/hooks/useAdDirectorBrandKit";
import { useAdProjectHistory } from "@/hooks/useAdProjectHistory";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_VIDEO_PARAMS, type VideoParams } from "./VideoParameters";
import {
  backgroundAdDirectorService,
  type AdDirectorPipelineState,
  type FlowState,
} from "@/lib/backgroundAdDirectorService";

const EDGE_TIMEOUT_MS = 180_000;

export function AdDirectorContent({ onEditingChange }: { onEditingChange?: (editing: boolean) => void }) {
  const { toast } = useToast();
  const { savedBrand, isLoading: brandLoading, saveBrandKit } = useAdDirectorBrandKit();
  const { projects, saveProject } = useAdProjectHistory();
  const promptHistory = usePromptHistory();
  const service = backgroundAdDirectorService;

  // Local UI-only state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [modelOverrides] = useState<ModelOverrides>({});
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  const [scenePrompts, setScenePrompts] = useState<Record<string, string>>({});

  // Pipeline state — driven by singleton service
  const [pipelineState, setPipelineState] = useState<AdDirectorPipelineState>(service.getState());

  // Subscribe to service on mount, unsubscribe on unmount
  useEffect(() => {
    service.subscribe(setPipelineState);
    // Hydrate from current service state (in case pipeline was running while away)
    setPipelineState(service.getState());
    return () => service.unsubscribe();
  }, []);

  // Sync brand from DB into service when loaded
  useEffect(() => {
    if (savedBrand && !brandLoading) {
      service.patchState({ brand: savedBrand });
    }
  }, [savedBrand, brandLoading]);

  // Destructure for rendering
  const {
    flowState, userPrompt, userRatio, statusText, progressValue,
    segments, storyboard, continuity, clips, finalVideoUrl,
    exporting, musicTrackUrl, brand, videoParams, projectId,
  } = pipelineState;

  // Notify parent when editing state changes
  useEffect(() => {
    onEditingChange?.(flowState === "editing");
  }, [flowState, onEditingChange]);

  // ─── Submit handler → delegates to service ───
  const handleSubmit = useCallback(async (
    prompt: string, ratio: string, images: File[],
    introImage: File | null, outroImage: File | null,
    duration: string, characterImage: File | null,
    selectedProducts?: string[], selectedStyles?: string[],
  ) => {
    // Enrich prompt with product/style context
    const prefixParts: string[] = [];
    if (selectedProducts?.length) prefixParts.push(`Product: ${selectedProducts.join(", ")}`);
    if (selectedStyles?.length) prefixParts.push(`Style: ${selectedStyles.join(", ")}`);
    const enrichedPrompt = prefixParts.length > 0 ? `${prefixParts.join(". ")}. ${prompt}` : prompt;
    const currentBrand = service.getState().brand?.name ? service.getState().brand : (savedBrand || DEFAULT_BRAND);
    const currentVideoParams = service.getState().videoParams?.ratio ? service.getState().videoParams : DEFAULT_VIDEO_PARAMS;

    try {
      await service.startPipeline(
        enrichedPrompt, ratio, images, introImage, outroImage, duration, characterImage,
        currentBrand, { ...currentVideoParams, ratio, duration: parseInt(duration) || 15 } as VideoParams,
        modelOverrides,
        async (data) => {
          const savedId = await saveProject.mutateAsync(data);
          return savedId;
        },
      );
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
  }, [modelOverrides, toast, savedBrand, saveProject]);

  // ─── Export (user-triggered from editor) ──────────────
  const handleExport = useCallback(async () => {
    service.patchState({ exporting: true });
    try {
      const latestClips = service.getState().clips;
      const completedClips = latestClips.filter(c => c.status === "completed" && c.videoUrl);
      if (completedClips.length === 0) throw new Error("No clips to export");

      toast({ title: "Assembling ad..." });

      const currentStoryboard = service.getState().storyboard;
      const currentSegments = service.getState().segments;
      const currentBrand = service.getState().brand;

      const orderedClips = currentStoryboard
        .map(scene => {
          const clip = latestClips.find(c => c.sceneId === scene.id);
          const segment = currentSegments.find(s => s.id === scene.segmentId);
          const targetDur = segment ? segment.endTime - segment.startTime : 5;
          return clip?.status === "completed" && clip.videoUrl
            ? { videoUrl: clip.videoUrl, targetDuration: targetDur }
            : null;
        })
        .filter(Boolean) as { videoUrl: string; targetDuration: number }[];

      if (orderedClips.length === 0) throw new Error("No completed clips");

      let audioUrl: string | undefined;
      try {
        const fullNarration = currentSegments.map(s => s.text).join(" ");
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
          }
        }
      } catch (e) { console.warn("TTS failed:", e); }

      const finalUrl = await stitchClips(orderedClips, {
        logo: { url: currentBrand.logoUrl || "", enabled: !!currentBrand.logoUrl, size: 80 },
        endCard: {
          enabled: true, brandName: currentBrand.name, tagline: currentBrand.tagline,
          website: currentBrand.website, primaryColor: currentBrand.primaryColor,
          bgColor: currentBrand.secondaryColor, logoUrl: currentBrand.logoUrl,
        },
        subtitles: {
          enabled: true,
          segments: currentSegments.map(s => ({ text: s.text, startTime: s.startTime, endTime: s.endTime })),
        },
        audioUrl,
        musicUrl: service.getState().musicTrackUrl || undefined,
        musicVolume: 0.15,
      });

      service.patchState({ finalVideoUrl: finalUrl.blobUrl });
      toast({ title: "Ad assembled!", description: `${orderedClips.length} scenes stitched` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      service.patchState({ exporting: false });
    }
  }, [toast]);

  const handleDownload = () => {
    if (!finalVideoUrl) return;
    const a = document.createElement("a");
    a.href = finalVideoUrl;
    a.download = `${brand.name?.replace(/\s+/g, "-") || "video"}-ad.webm`;
    a.click();
  };

  const handleCancel = () => {
    service.cancel();
    toast({ title: "Generation cancelled" });
  };

  // ─── Regenerate scene (from editor) ─────────────
  const handleRegenerateScene = useCallback(async (sceneId: string, customPrompt?: string) => {
    const currentState = service.getState();
    const scene = currentState.storyboard.find(s => s.id === sceneId);
    if (!scene) return;
    const segment = currentState.segments.find(seg => seg.id === scene.segmentId);
    const effectiveRatio = currentState.userRatio === "Smart" ? "16:9" : currentState.userRatio;
    const wanRatio = ["16:9", "9:16", "1:1"].includes(effectiveRatio) ? effectiveRatio : "16:9";
    const rawDur = currentState.videoParams.duration > 0 ? currentState.videoParams.duration : (segment ? segment.endTime - segment.startTime : 5);
    const sceneDuration = Math.min(Math.max(rawDur, 2), 15);
    const basePrompt = customPrompt?.trim() ? customPrompt.trim() : scene.prompt;
    const motionPrompt = basePrompt + " Cinematic camera movement with dynamic subject motion throughout the scene. Avoid static shots.";
    service.patchState({
      clips: currentState.clips.map(c => c.sceneId === sceneId ? { ...c, status: "generating" as const, progress: 10 } : c),
    });
    try {
      const result = await invokeEdgeFunction<{
        url?: string; videoUrl?: string; jobId?: string; provider?: "wan" | "veo" | "sora";
      }>("generate-video", {
        action: "generate", prompt: motionPrompt, duration: sceneDuration,
        aspectRatio: wanRatio, provider: "wan", model: "wan2.6-t2v",
        negativePrompt: "static image, zoom only, no motion, blurry, text overlay, watermark",
      }, { timeoutMs: EDGE_TIMEOUT_MS });
      const videoUrl = result.url || result.videoUrl;
      if (videoUrl) {
        service.patchState({
          clips: service.getState().clips.map(c => c.sceneId === sceneId ? { ...c, status: "completed" as const, videoUrl, progress: 100 } : c),
        });
      }
    } catch (err: any) {
      service.patchState({
        clips: service.getState().clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: err.message, progress: 0 } : c),
      });
    }
  }, []);

  // ─── RENDER ──────────────────────────────────────

  // Editing mode — full ProVideoEditor
  if (flowState === "editing") {
    return (
      <div className="space-y-4">
        <ProVideoEditor
          clips={clips}
          storyboard={storyboard}
          segments={segments}
          brand={brand}
          finalVideoUrl={finalVideoUrl}
          onBack={() => service.patchState({ flowState: "result" })}
          onExport={handleExport}
          exporting={exporting}
          onOpenExportDialog={() => setExportDialogOpen(true)}
          onRegenerateScene={handleRegenerateScene}
          onUpdateClipUrl={(sceneId, url) => service.patchState({
            clips: service.getState().clips.map(c => c.sceneId === sceneId ? { ...c, status: "completed" as const, videoUrl: url, progress: 100 } : c),
          })}
          onUpdateSegment={(id, text) => service.patchState({
            segments: service.getState().segments.map(s => s.id === id ? { ...s, text } : s),
          })}
          onUpdateSegmentTiming={(id, startTime, endTime) => service.patchState({
            segments: service.getState().segments.map(s => s.id === id ? { ...s, startTime, endTime } : s),
          })}
          onUpdateStoryboard={(sb) => service.patchState({ storyboard: sb })}
          onUpdateBrand={(b) => service.patchState({ brand: b })}
          onMusicSelect={(url) => service.patchState({ musicTrackUrl: url })}
        />
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      {/* Idle state */}
      {flowState === "idle" && (
        <>
          <div className="text-center space-y-3 animate-in fade-in duration-500">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Film className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">What video do you want to create?</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Describe your idea and we'll generate a professional video ad for you.
            </p>
          </div>
          <ChatPromptBar onSubmit={handleSubmit} />
          <VideoHistory
            projects={projects.data ?? []}
            onSelect={(url) => {
              service.patchState({ finalVideoUrl: url, flowState: "result" });
            }}
          />
        </>
      )}

      {/* Analyzing / Generating */}
      {(flowState === "analyzing" || flowState === "generating") && (
        <div className="w-full max-w-lg space-y-6 animate-in fade-in duration-300">
          {/* User message bubble */}
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-3 text-sm">
              {userPrompt}
            </div>
          </div>

          {/* Progress */}
          <div className="rounded-2xl border border-border/20 bg-card/40 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
              <span className="text-sm font-medium">{statusText}</span>
            </div>
            <Progress value={progressValue} className="h-2" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{progressValue}%</span>
              <Button variant="ghost" size="sm" onClick={handleCancel} className="h-7 text-xs text-destructive hover:text-destructive">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {flowState === "result" && (
        <div className="w-full max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* User message */}
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-3 text-sm">
              {userPrompt}
            </div>
          </div>

          {/* Main Preview */}
          <div className="rounded-2xl border border-border/20 bg-card/40 overflow-hidden">
            {(selectedPreviewUrl || finalVideoUrl) ? (
              <video
                key={selectedPreviewUrl || finalVideoUrl}
                src={selectedPreviewUrl || finalVideoUrl!}
                controls
                autoPlay
                className="w-full aspect-video bg-black"
              />
            ) : (
              <div className="w-full aspect-video bg-muted/20 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Click a scene below to preview</p>
              </div>
            )}
          </div>

          {/* Scene Clips Gallery */}
          {clips.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground px-1">Generated Scenes</p>
              <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-thin">
                {clips.map((clip, i) => {
                  const scene = storyboard[i];
                  const label = scene?.objective?.split(" ").slice(0, 3).join(" ") || `Scene ${i + 1}`;
                  const segType = segments.find(s => s.id === scene?.segmentId)?.type;
                  const isSelected = clip.videoUrl === selectedPreviewUrl;

                  return (
                    <div key={clip.sceneId} className="flex-shrink-0 w-[280px] space-y-1.5">
                      <div
                        className={`relative rounded-xl border overflow-hidden cursor-pointer transition-all group ${
                          isSelected ? "ring-2 ring-primary border-primary" : "border-border/30 hover:border-primary/50"
                        }`}
                        onClick={() => clip.videoUrl && setSelectedPreviewUrl(clip.videoUrl)}
                      >
                        {clip.status === "completed" && clip.videoUrl ? (
                          <>
                            <video
                              src={clip.videoUrl}
                              className="w-full aspect-video object-cover"
                              muted
                              preload="metadata"
                              onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                              onMouseLeave={(e) => { const el = e.target as HTMLVideoElement; el.pause(); el.currentTime = 0; }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                              <div className="w-8 h-8 rounded-full bg-background/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Play className="w-4 h-4 text-foreground ml-0.5" />
                              </div>
                            </div>
                          </>
                        ) : clip.status === "generating" || clip.status === "queued" ? (
                          <Skeleton className="w-full aspect-video flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          </Skeleton>
                        ) : clip.status === "failed" ? (
                          <div className="w-full aspect-video bg-destructive/10 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-destructive" />
                          </div>
                        ) : (
                          <div className="w-full aspect-video bg-muted/20 flex items-center justify-center">
                            <Film className="w-5 h-5 text-muted-foreground/40" />
                          </div>
                        )}

                        {/* Label overlay */}
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                          <p className="text-[10px] font-medium text-white truncate">
                            {i + 1}. {segType ? segType.charAt(0).toUpperCase() + segType.slice(1) : label}
                          </p>
                        </div>
                      </div>

                      {/* Custom prompt input + regenerate */}
                      <div className="flex gap-1">
                        <Input
                          value={scenePrompts[clip.sceneId] || ""}
                          onChange={e => setScenePrompts(p => ({ ...p, [clip.sceneId]: e.target.value }))}
                          placeholder="Custom prompt..."
                          className="h-7 text-xs flex-1"
                          onClick={e => e.stopPropagation()}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          disabled={clip.status === "generating"}
                          onClick={() => handleRegenerateScene(clip.sceneId, scenePrompts[clip.sceneId])}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3">
            <Button onClick={handleDownload} disabled={!finalVideoUrl} className="gap-2">
              <Download className="w-4 h-4" />
              Approve & Download
            </Button>
            <Button variant="outline" onClick={() => service.patchState({ flowState: "editing" })} className="gap-2">
              <Pencil className="w-4 h-4" />
              Edit Video
            </Button>
          </div>
          {/* Home button */}
          <div className="flex justify-center pt-2">
            <button
              onClick={() => service.patchState({ flowState: "idle" })}
              className="w-12 h-12 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
              title="Back to AI Video Director"
            >
              <Home className="w-5 h-5 text-primary" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
