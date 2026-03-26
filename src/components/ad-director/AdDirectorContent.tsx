import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { ProVideoEditor } from "./ProVideoEditor";
import { Progress } from "@/components/ui/progress";
import { CameraLoader } from "./CameraLoader";
import { Loader2, Check, Download, Pencil, Sparkles, Film, Play, AlertCircle, Home, RefreshCw, CalendarDays, BookmarkCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
// ExportDialog removed — scheduling now handled inside ProVideoEditor
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
  const { projects, saveProject, deleteProject } = useAdProjectHistory();
  const promptHistory = usePromptHistory();
  const service = backgroundAdDirectorService;

  // Local UI-only state
  // exportDialogOpen removed — scheduling is handled inside ProVideoEditor
  const [showIntro, setShowIntro] = useState(true);
  const [modelOverrides] = useState<ModelOverrides>({});
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  const [scenePrompts, setScenePrompts] = useState<Record<string, string>>({});
  const [approved, setApproved] = useState(false);

  // Schedule-to-social state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleHour, setScheduleHour] = useState("09");
  const [scheduleMinute, setScheduleMinute] = useState("00");
  const [scheduling, setScheduling] = useState(false);

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

  const handleScheduleToSocial = async () => {
    if (!scheduleDate || !finalVideoUrl) return;
    const scheduledDateTime = new Date(scheduleDate);
    scheduledDateTime.setHours(parseInt(scheduleHour), parseInt(scheduleMinute), 0, 0);

    if (scheduledDateTime <= new Date()) {
      toast({ title: "Invalid Time", description: "Cannot schedule in the past.", variant: "destructive" });
      return;
    }

    setScheduling(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Authentication required", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from("social_posts").insert({
        platform: "instagram",
        status: "scheduled",
        qa_status: "scheduled",
        content_type: "reel",
        image_url: finalVideoUrl,
        scheduled_date: scheduledDateTime.toISOString(),
        title: pipelineState.brand?.name || "AI Video",
        content: pipelineState.userPrompt || "",
        user_id: user.id,
        neel_approved: false,
      });

      if (error) throw error;

      toast({
        title: "Scheduled ✅",
        description: `Video scheduled for ${format(scheduledDateTime, "PPP")} at ${scheduleHour}:${scheduleMinute}`,
      });
      setScheduleOpen(false);
    } catch (err: any) {
      toast({ title: "Scheduling failed", description: err.message, variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  };

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
          name: service.getState().brand.name || "Untitled",
          finalVideoUrl: permanentUrl,
          status: "completed",
        });
      }
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
        <>
          {showIntro ? (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
              <video
                src="/videos/ad-director-intro.mp4"
                autoPlay
                
                playsInline
                className="w-full h-full object-cover"
                onEnded={() => setShowIntro(false)}
              />
            </div>
           ) : (
            <div className="w-full max-w-4xl mx-auto rounded-3xl bg-black/60 backdrop-blur-md border border-white/10 p-8 space-y-6">
              <div className="text-center space-y-3 animate-in fade-in duration-500">
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mx-auto">
                  <Film className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-semibold text-white">What video do you want to create?</h2>
                <p className="text-sm text-white/70 max-w-md mx-auto">
                  Describe your idea and we'll generate a professional video ad for you.
                </p>
              </div>
              <ChatPromptBar onSubmit={handleSubmit} />
              <VideoHistory
                projects={projects.data ?? []}
                onSelect={(url) => {
                  service.patchState({ finalVideoUrl: url, flowState: "result" });
                }}
                onDelete={(id) => deleteProject.mutate(id)}
              />
            </div>
           )}
         </>
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
              onClick={() => service.patchState({ flowState: "idle" })}
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
