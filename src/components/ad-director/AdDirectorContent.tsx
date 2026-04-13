import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { ProVideoEditor } from "./ProVideoEditor";
import { CameraLoader } from "./CameraLoader";
import { Loader2, Check, Pencil, Film, Play, AlertCircle, Home, RefreshCw, Send, BookmarkCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatPromptBar } from "./ChatPromptBar";
import {
  type ScriptSegment, type StoryboardScene,
  type ClipOutput, type ModelOverrides,
  DEFAULT_BRAND,
} from "@/types/adDirector";
import { stitchClips } from "@/lib/videoStitch";
import { VideoHistory } from "./VideoHistory";
import { useAdDirectorBrandKit } from "@/hooks/useAdDirectorBrandKit";
import { useAdProjectHistory, type AdProjectRow } from "@/hooks/useAdProjectHistory";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_VIDEO_PARAMS, type VideoParams } from "./VideoParameters";
import {
  backgroundAdDirectorService,
  type AdDirectorPipelineState,
} from "@/lib/backgroundAdDirectorService";

const EDGE_TIMEOUT_MS = 180_000;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function AdDirectorContent({ onEditingChange }: { onEditingChange?: (editing: boolean) => void }) {
  const { toast } = useToast();
  const { savedBrand, isLoading: brandLoading } = useAdDirectorBrandKit();
  const { projects, saveProject, deleteProject } = useAdProjectHistory();
  const service = backgroundAdDirectorService;

  const [modelOverrides] = useState<ModelOverrides>({});
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  const [scenePrompts, setScenePrompts] = useState<Record<string, string>>({});
  const [approved, setApproved] = useState(false);

  // Pipeline state — driven by singleton service
  const [pipelineState, setPipelineState] = useState<AdDirectorPipelineState>(service.getState());

  // Subscribe to service on mount, unsubscribe on unmount
  useEffect(() => {
    service.subscribe(setPipelineState);
    // Hydrate from current service state (in case pipeline was running while away)
    setPipelineState(service.getState());
    return () => service.unsubscribe();
  }, [service]);

  // Sync brand from DB into service when loaded
  useEffect(() => {
    if (savedBrand && !brandLoading) {
      service.patchState({ brand: savedBrand });
    }
  }, [savedBrand, brandLoading, service]);

  // Destructure for rendering
  const {
    flowState, userRatio, statusText, progressValue,
    segments, storyboard, continuity, clips, finalVideoUrl,
    exporting, brand, videoParams,
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
    videoModel?: string, videoProvider?: string,
  ) => {
    const currentBrand = service.getState().brand?.name ? service.getState().brand : (savedBrand || DEFAULT_BRAND);
    const currentVideoParams = service.getState().videoParams?.ratio ? service.getState().videoParams : DEFAULT_VIDEO_PARAMS;

    try {
      await service.startPipeline(
        prompt, ratio, images, introImage, outroImage, duration, characterImage,
        currentBrand, { ...currentVideoParams, ratio, duration: parseInt(duration) || 15 } as VideoParams,
        modelOverrides,
        async (data) => {
          const savedId = await saveProject.mutateAsync(data);
          return savedId;
        },
        videoModel, videoProvider,
        selectedProducts, selectedStyles,
      );
    } catch (error) {
      toast({ title: "Failed", description: getErrorMessage(error, "Unable to start video generation."), variant: "destructive" });
    }
  }, [modelOverrides, toast, savedBrand, saveProject, service]);

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
        subtitles: { enabled: false, segments: [] },
        audioUrl,
        musicUrl: service.getState().musicTrackUrl || undefined,
        musicVolume: 0.15,
      });

      // Upload to storage for permanent URL
      let permanentUrl = finalUrl.blobUrl;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const blob = await fetch(finalUrl.blobUrl).then(r => r.blob());
          const path = `${user.id}/${crypto.randomUUID()}.webm`;
          const { error: upErr } = await supabase.storage
            .from("generated-videos")
            .upload(path, blob, { contentType: "video/webm", upsert: false });
          if (!upErr) {
            const { data: pubData } = supabase.storage.from("generated-videos").getPublicUrl(path);
            if (pubData?.publicUrl) permanentUrl = pubData.publicUrl;
          } else {
            console.warn("[AdDirector] Storage upload failed:", upErr.message);
          }
        }
      } catch (e) { console.warn("[AdDirector] Upload to storage failed:", e); }

      service.patchState({ finalVideoUrl: finalUrl.blobUrl });
      // Save permanent URL to project history
      const pid = service.getState().projectId;
      if (pid) {
        saveProject.mutate({
          id: pid,
          name: (() => { const p = service.getState().userPrompt; return p ? (p.length > 50 ? p.substring(0, 50).replace(/\s+\S*$/, "…") : p) : (service.getState().brand.name || "Untitled"); })(),
          finalVideoUrl: permanentUrl,
          status: "completed",
        });
      }
      toast({ title: "Ad assembled!", description: `${orderedClips.length} scenes stitched` });
    } catch (error) {
      toast({ title: "Export failed", description: getErrorMessage(error, "Unable to assemble the video."), variant: "destructive" });
    } finally {
      service.patchState({ exporting: false });
    }
  }, [saveProject, service, toast]);

  const handleCancel = () => {
    service.cancel();
    toast({ title: "Generation cancelled" });
  };


  const handleSelectProjectDraft = (project: AdProjectRow) => {
    const projectClips = project.clips ?? [];
    const projectStoryboard = project.storyboard ?? [];
    const allComplete = projectStoryboard.every((scene) => {
      const clip = projectClips.find((candidate) => candidate.sceneId === scene.id);
      return clip && clip.status === "completed" && clip.videoUrl && typeof clip.videoUrl === "string";
    });

    if (allComplete) {
      service.patchState({
        segments: project.segments ?? [],
        storyboard: project.storyboard ?? [],
        clips: project.clips ?? [],
        continuity: project.continuity ?? null,
        flowState: "result",
      });
      return;
    }

    const fixedClips = projectClips.map((clip) => {
      if (clip.status !== "completed" || !clip.videoUrl) {
        return { ...clip, status: "failed" as const, error: "Missing video - auto-retry" };
      }
      return clip;
    });

    service.patchState({
      segments: project.segments ?? [],
      storyboard: project.storyboard ?? [],
      clips: fixedClips,
      continuity: project.continuity ?? null,
      flowState: "generating",
      statusText: "Recovering missing scenes...",
      progressValue: 10,
    });
    toast({ title: "Recovering missing scenes", description: "Re-generating incomplete video clips..." });
  };

  const handleRenameProject = async (id: string, newName: string) => {
    const proj = (projects.data ?? []).find((p) => p.id === id);
    if (!proj) return;

    try {
      await saveProject.mutateAsync({
        id,
        name: newName,
        brandName: proj.brand_name ?? undefined,
        script: proj.script ?? undefined,
        segments: proj.segments ?? [],
        storyboard: proj.storyboard ?? [],
        clips: proj.clips ?? [],
        continuity: proj.continuity ?? null,
        finalVideoUrl: proj.final_video_url ?? null,
        status: proj.status,
      });
    } catch {
      toast({ title: "Failed to rename", variant: "destructive" });
    }
  };

  // ─── Regenerate scene (from editor) ─────────────
  const handleRegenerateScene = useCallback(async (sceneId: string, customPrompt?: string) => {
    setApproved(false);
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
      finalVideoUrl: null,
    });
    try {
      const result = await invokeEdgeFunction<{
        url?: string; videoUrl?: string; jobId?: string; provider?: "wan" | "veo" | "sora";
      }>("generate-video", {
        action: "generate", prompt: motionPrompt, duration: sceneDuration,
        aspectRatio: wanRatio, provider: "wan", model: "wan2.6-t2v",
        negativePrompt: "static image, zoom only, no motion, blurry, text, words, letters, titles, subtitles, captions, watermark, typography, written content, overlay text, any text of any kind",
      }, { timeoutMs: EDGE_TIMEOUT_MS });
      const videoUrl = result.url || result.videoUrl;
      const genId = result.jobId;
      const provider = result.provider || "wan";

      if (videoUrl) {
        service.patchState({
          clips: service.getState().clips.map(c => c.sceneId === sceneId ? { ...c, status: "completed" as const, videoUrl, progress: 100 } : c),
        });
      } else if (genId) {
        // Async job — poll until complete
        const maxAttempts = 120;
        let completed = false;
        for (let i = 0; i < maxAttempts; i++) {
          await new Promise(r => setTimeout(r, 5000));
          try {
            const pollResult = await invokeEdgeFunction<{
              status?: string; url?: string; videoUrl?: string; error?: string;
            }>("generate-video", {
              action: "poll", jobId: genId, provider,
            }, { timeoutMs: 30000 });

            const pollUrl = pollResult.url || pollResult.videoUrl;
            if (pollResult.status === "completed" || pollUrl) {
              service.patchState({
                clips: service.getState().clips.map(c => c.sceneId === sceneId ? { ...c, status: "completed" as const, videoUrl: pollUrl!, progress: 100 } : c),
              });
              completed = true;
              break;
            }
            if (pollResult.status === "failed") {
              service.patchState({
                clips: service.getState().clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: pollResult.error || "Generation failed", progress: 0 } : c),
              });
              completed = true;
              break;
            }
            // Update progress
            const progress = Math.min(10 + Math.round((i / maxAttempts) * 85), 95);
            service.patchState({
              clips: service.getState().clips.map(c => c.sceneId === sceneId ? { ...c, progress } : c),
            });
          } catch {
            // Continue polling on transient errors
          }
        }
        if (!completed) {
          service.patchState({
            clips: service.getState().clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: "Generation timed out", progress: 0 } : c),
          });
        }
      } else {
        service.patchState({
          clips: service.getState().clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: "No video URL or job ID returned", progress: 0 } : c),
        });
      }
    } catch (error) {
      service.patchState({
        clips: service.getState().clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: getErrorMessage(error, "Scene regeneration failed."), progress: 0 } : c),
      });
    }
  }, [service]);

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
          onUpdateSegments={(segs) => service.patchState({ segments: segs })}
          onUpdateStoryboard={(sb) => service.patchState({ storyboard: sb })}
          onUpdateBrand={(b) => service.patchState({ brand: b })}
          onMusicSelect={(url) => service.patchState({ musicTrackUrl: url })}
          onAddSceneWithMedia={(url, fileName) => {
            const state = service.getState();
            const newId = crypto.randomUUID();
            const segId = crypto.randomUUID();
            const lastSeg = state.segments[state.segments.length - 1];
            const startTime = lastSeg ? lastSeg.endTime : 0;
            const duration = 5;
            const newSegment: ScriptSegment = {
              id: segId, type: "hook", label: fileName,
              text: "", startTime, endTime: startTime + duration,
            };
            const newScene: StoryboardScene = {
              id: newId, segmentId: segId,
              objective: fileName, visualStyle: "custom",
              shotType: "medium", cameraMovement: "static",
              environment: "", subjectAction: "", emotionalTone: "",
              transitionNote: "cut", generationMode: "static-card",
              continuityRequirements: "", prompt: "",
              continuityLock: false, locked: false,
            };
            const newClip: ClipOutput = {
              sceneId: newId, status: "completed" as const,
              videoUrl: url, progress: 100,
            };
            service.patchState({
              segments: [...state.segments, newSegment],
              storyboard: [...state.storyboard, newScene],
              clips: [...state.clips, newClip],
            });
          }}
          onDuplicateClip={(oldId, newId) => {
            const existing = service.getState().clips.find(c => c.sceneId === oldId);
            if (existing) {
              service.patchState({
                clips: [...service.getState().clips, { ...existing, sceneId: newId }],
              });
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[60vh] gap-6">
      {/* Background video — always looping, muted */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 z-0 w-full h-full object-cover pointer-events-none"
        src="/videos/ad-director-bg.mp4"
      />
      <div className="fixed inset-0 z-[1] bg-black/50 pointer-events-none" />
      {/* All content above the background */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full gap-6">
      {/* Idle state */}
      {flowState === "idle" && (
        <div className="w-full max-w-6xl space-y-6">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 md:p-6">
            <ChatPromptBar
              onSubmit={handleSubmit}
            />
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 md:p-6">
            <div className="mb-3">
              <p className="text-xs font-medium text-white/40">Recent projects</p>
              <h3 className="mt-0.5 text-base font-medium text-white/80">Resume a draft or reopen a finished ad</h3>
            </div>
            <VideoHistory
              projects={projects.data ?? []}
              onSelect={(url) => {
                service.patchState({ finalVideoUrl: url, flowState: "result" });
              }}
              onSelectDraft={handleSelectProjectDraft}
              onDelete={(id) => deleteProject.mutate(id)}
              onRename={handleRenameProject}
            />
          </div>
        </div>
       )}

      {/* Analyzing / Generating */}
      {(flowState === "analyzing" || flowState === "generating") && (
        <CameraLoader statusText={statusText} progressValue={progressValue} sceneCount={storyboard.length} onCancel={handleCancel} />
      )}

      {/* Result */}
      {flowState === "result" && (
        <>
        <div className="fixed inset-0 z-[5] bg-black" />
        <div className="w-full max-w-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
          {/* Home button — top */}
           <button
              onClick={() => { service.patchState({ flowState: "idle" }); }}
              className="fixed top-16 left-4 z-50 w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center transition-colors shadow-lg ring-2 ring-purple-400/30"
              title="Back to AI Video Director"
            >
              <Home className="w-7 h-7 text-white" />
            </button>
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
                            <button
                              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); handleRegenerateScene(clip.sceneId); }}
                              title="Regenerate scene"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-white" />
                            </button>
                          </>
                        ) : clip.status === "generating" || clip.status === "queued" ? (
                          <Skeleton className="w-full aspect-video flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                          </Skeleton>
                        ) : clip.status === "failed" ? (
                          <div className="w-full aspect-video bg-destructive/10 flex items-center justify-center relative">
                            <AlertCircle className="w-5 h-5 text-destructive" />
                            <button
                              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-opacity"
                              onClick={(e) => { e.stopPropagation(); handleRegenerateScene(clip.sceneId); }}
                              title="Retry scene"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-white" />
                            </button>
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
                          className="h-7 w-7 p-0 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                          disabled={clip.status === "generating"}
                          onClick={() => handleRegenerateScene(clip.sceneId, scenePrompts[clip.sceneId])}
                        >
                          <Send className="w-3.5 h-3.5" />
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
            <Button
              variant="outline"
              className="gap-2"
              disabled={saveProject.isPending}
              onClick={async () => {
                try {
                  await saveProject.mutateAsync({
                    name: (() => { const p = service.getState().userPrompt; return p ? (p.length > 50 ? p.substring(0, 50).replace(/\s+\S*$/, "…") : p) : (brand.name || "Untitled"); })(),
                    brandName: brand.name,
                    segments,
                    storyboard,
                    clips,
                    continuity,
                    status: "draft",
                  });
                  toast({ title: "Draft saved", description: "Project will appear in your video history." });
                } catch {
                  toast({ title: "Failed to save", variant: "destructive" });
                }
              }}
            >
              <BookmarkCheck className="w-4 h-4" />
              Save Draft
            </Button>
            {!approved ? (
              <Button onClick={() => setApproved(true)} className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400">
                <Check className="w-4 h-4" />
                Approve Composition
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => service.patchState({ flowState: "editing" })} className="gap-2">
                  <Pencil className="w-4 h-4" />
                  Edit Video
                </Button>
              </>
            )}
          </div>
        </div>
        </>
      )}
      </div>
    </div>
  );
}
