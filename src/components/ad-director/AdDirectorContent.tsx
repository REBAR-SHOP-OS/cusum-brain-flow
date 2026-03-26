import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { ProVideoEditor } from "./ProVideoEditor";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check, Download, Pencil, Sparkles, Film } from "lucide-react";
import { ExportDialog } from "./ExportDialog";
import { ChatPromptBar } from "./ChatPromptBar";
import {
  type BrandProfile, type ScriptSegment, type StoryboardScene,
  type ContinuityProfile, type ClipOutput, type ModelOverrides,
  type PromptQualityScore, DEFAULT_BRAND,
} from "@/types/adDirector";
import { usePromptHistory } from "@/hooks/usePromptHistory";
import { stitchClips } from "@/lib/videoStitch";
import { useAdDirectorBrandKit } from "@/hooks/useAdDirectorBrandKit";
import { useAdProjectHistory } from "@/hooks/useAdProjectHistory";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_VIDEO_PARAMS, type VideoParams } from "./VideoParameters";

type FlowState = "idle" | "analyzing" | "generating" | "result" | "editing";

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

export function AdDirectorContent() {
  const { toast } = useToast();
  const { savedBrand, isLoading: brandLoading, saveBrandKit } = useAdDirectorBrandKit();
  const { saveProject } = useAdProjectHistory();
  const projectIdRef = useRef<string | null>(null);
  const promptHistory = usePromptHistory();

  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [userPrompt, setUserPrompt] = useState("");
  const [userRatio, setUserRatio] = useState("16:9");

  const [script, setScript] = useState("");
  const [brand, setBrand] = useState<BrandProfile>(DEFAULT_BRAND);
  const [videoParams, setVideoParams] = useState<VideoParams>(DEFAULT_VIDEO_PARAMS);
  const [assets, setAssets] = useState<File[]>([]);
  const [statusText, setStatusText] = useState("");
  const [progressValue, setProgressValue] = useState(0);
  const [modelOverrides] = useState<ModelOverrides>({});

  const [segments, setSegments] = useState<ScriptSegment[]>([]);
  const [storyboard, setStoryboard] = useState<StoryboardScene[]>([]);
  const storyboardRef = useRef<StoryboardScene[]>(storyboard);
  useEffect(() => { storyboardRef.current = storyboard; }, [storyboard]);
  const [continuity, setContinuity] = useState<ContinuityProfile | null>(null);
  const [clips, setClips] = useState<ClipOutput[]>([]);
  const [exporting, setExporting] = useState(false);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [musicTrackUrl, setMusicTrackUrl] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const cancelRef = useRef(false);

  const logoEnabled = !!brand.logoUrl;

  useEffect(() => {
    if (savedBrand && !brandLoading) setBrand(savedBrand);
  }, [savedBrand, brandLoading]);

  // ─── Full Pipeline: prompt → analyze → generate → result ───
  // Keep a ref to always have the latest clips (avoids stale closure in export)
  const clipsRef = useRef<ClipOutput[]>([]);
  useEffect(() => { clipsRef.current = clips; }, [clips]);

  const handleSubmit = useCallback(async (prompt: string, ratio: string, images: File[], introImage: File | null, outroImage: File | null, duration: string, characterImage: File | null) => {
    setUserPrompt(prompt);
    setUserRatio(ratio);
    setScript(prompt);
    setAssets(images);
    setVideoParams(prev => ({ ...prev, ratio }));
    setFinalVideoUrl(null);
    cancelRef.current = false;

    // Upload character image to storage if provided
    let characterImageUrl: string | undefined;
    if (characterImage) {
      try {
        const path = `character-refs/${Date.now()}-${characterImage.name}`;
        const { uploadToStorage } = await import("@/lib/storageUpload");
        const { error: upErr } = await uploadToStorage("ad-assets", path, characterImage);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("ad-assets").getPublicUrl(path);
          characterImageUrl = urlData?.publicUrl;
        }
      } catch (e) {
        console.warn("Character image upload failed, continuing without it", e);
      }
    }

    try {
      // Phase 1: Analyze
      setFlowState("analyzing");
      setStatusText("Analyzing your idea...");
      setProgressValue(10);

      const analyzeResult = await withTimeout(invokeEdgeFunction<{
        result: { segments: ScriptSegment[]; storyboard: StoryboardScene[]; continuityProfile: ContinuityProfile };
        modelUsed: string;
      }>("ad-director-ai", {
        action: "analyze-script",
        script: prompt,
        brand,
        assetDescriptions: images.length > 0 ? images.map(f => f.name).join(", ") : undefined,
        characterImageUrl,
        modelOverrides,
      }, { timeoutMs: 90_000 }));

      const { segments: newSegments, storyboard: rawStoryboard, continuityProfile } = analyzeResult.result;

      // Write cinematic prompts
      setStatusText("Writing cinematic prompts...");
      setProgressValue(30);
      const promptResults = await Promise.all(
        rawStoryboard.map(async (scene, idx) => {
          try {
            const res = await withTimeout(invokeEdgeFunction<{
              result: { prompt: string };
              modelUsed: string;
            }>("ad-director-ai", {
              action: "write-cinematic-prompt",
              scene, brand, continuityProfile,
              previousScene: idx > 0 ? rawStoryboard[idx - 1] : null,
              modelOverrides,
            }, { timeoutMs: EDGE_TIMEOUT_MS }));
            return { prompt: res.result.prompt, modelUsed: res.modelUsed };
          } catch {
            return { prompt: scene.prompt, modelUsed: "original" };
          }
        })
      );

      // Score + improve
      setStatusText("Scoring & improving prompts...");
      setProgressValue(55);
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
              brand, modelOverrides,
            }, { timeoutMs: EDGE_TIMEOUT_MS }));
            return { quality: res.result, scoredBy: res.modelUsed };
          } catch {
            return { quality: undefined, scoredBy: "skipped" };
          }
        })
      );

      setProgressValue(75);
      const finalPrompts = await Promise.all(
        promptResults.map(async (pr, idx) => {
          const quality = qualityResults[idx]?.quality;
          if (!quality || quality.overall >= QUALITY_THRESHOLD) return pr;
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
                brand, modelOverrides,
              }, { timeoutMs: EDGE_TIMEOUT_MS }));
              const rescoreRes = await withTimeout(invokeEdgeFunction<{
                result: PromptQualityScore;
              }>("ad-director-ai", {
                action: "score-prompt-quality",
                prompt: improveRes.result.prompt,
                scene: rawStoryboard[idx],
                brand, modelOverrides,
              }, { timeoutMs: EDGE_TIMEOUT_MS }));
              qualityResults[idx] = { quality: rescoreRes.result, scoredBy: qualityResults[idx].scoredBy };
              if (rescoreRes.result.overall >= QUALITY_THRESHOLD) {
                return { prompt: improveRes.result.prompt, modelUsed: improveRes.modelUsed };
              }
              pr = { prompt: improveRes.result.prompt, modelUsed: improveRes.modelUsed };
            } catch { break; }
          }
          return pr;
        })
      );

      const storyboardWithDefaults: StoryboardScene[] = rawStoryboard.map((s, idx) => ({
        ...s,
        prompt: finalPrompts[idx].prompt,
        continuityLock: true,
        locked: false,
        referenceAssetUrl: null,
        sceneIntelligence: {
          plannedBy: analyzeResult.modelUsed,
          promptWrittenBy: finalPrompts[idx].modelUsed,
          promptScoredBy: qualityResults[idx]?.scoredBy,
        },
        promptQuality: qualityResults[idx]?.quality,
      }));

      setSegments(newSegments);
      setStoryboard(storyboardWithDefaults);
      setContinuity(continuityProfile);

      const initialClips = storyboardWithDefaults.map(s => ({
        sceneId: s.id,
        status: "idle" as const,
        progress: 0,
      }));
      setClips(initialClips);

      // Auto-save
      try {
        const savedId = await saveProject.mutateAsync({
          id: projectIdRef.current ?? undefined,
          name: brand.name ? `${brand.name} Ad` : "Untitled Ad",
          brandName: brand.name,
          script: prompt,
          segments: newSegments,
          storyboard: storyboardWithDefaults,
          clips: initialClips,
          continuity: continuityProfile,
          status: "analyzed",
        });
        projectIdRef.current = savedId;
      } catch (e) {
        console.warn("Auto-save failed:", e);
      }

      // Phase 2: Generate all scenes
      setFlowState("generating");
      setProgressValue(0);

      const effectiveRatio = ratio === "Smart" ? "16:9" : ratio;
      const wanRatio = ["16:9", "9:16", "1:1"].includes(effectiveRatio) ? effectiveRatio : "16:9";

      for (let i = 0; i < storyboardWithDefaults.length; i++) {
        if (cancelRef.current) break;
        const scene = storyboardWithDefaults[i];
        const segment = newSegments.find(seg => seg.id === scene.segmentId);

        setStatusText(`Generating scene ${i + 1} of ${storyboardWithDefaults.length}...`);
        setProgressValue(Math.round(((i) / storyboardWithDefaults.length) * 100));

        // End card
        if (scene.generationMode === "static-card" || segment?.type === "closing") {
          generateEndCardPreview(scene.id);
          continue;
        }

        const rawDur = videoParams.duration > 0 ? videoParams.duration : (segment ? segment.endTime - segment.startTime : 5);
        const sceneDuration = Math.min(Math.max(rawDur, 2), 15);
        const motionPrompt = scene.prompt + " Cinematic camera movement with dynamic subject motion throughout the scene. Avoid static shots.";

        setClips(prev => prev.map(c => c.sceneId === scene.id ? { ...c, status: "generating", progress: 10 } : c));

        try {
          const result = await invokeEdgeFunction<{
            url?: string; videoUrl?: string; generationId?: string; jobId?: string;
            provider?: "wan" | "veo" | "sora"; mode?: string; imageUrls?: string[];
          }>("generate-video", {
            action: "generate",
            prompt: motionPrompt,
            duration: sceneDuration,
            aspectRatio: wanRatio,
            provider: "wan",
            model: "wan2.6-t2v",
            negativePrompt: "static image, zoom only, no motion, blurry, text overlay, watermark",
          }, { timeoutMs: EDGE_TIMEOUT_MS });

          const videoUrl = result.url || result.videoUrl;
          const genId = result.jobId || result.generationId;
          const provider = result.provider || "wan";

          if (result.mode === "slideshow" && result.imageUrls?.length) {
            setClips(prev => prev.map(c => c.sceneId === scene.id ? { ...c, status: "completed", videoUrl: result.imageUrls![0], progress: 100 } : c));
          } else if (videoUrl) {
            setClips(prev => prev.map(c => c.sceneId === scene.id ? { ...c, status: "completed", videoUrl, progress: 100, generationId: genId } : c));
          } else if (genId) {
            setClips(prev => prev.map(c => c.sceneId === scene.id ? { ...c, status: "generating", generationId: genId, progress: 30 } : c));
            await pollGeneration(scene.id, genId, provider);
          } else {
            setClips(prev => prev.map(c => c.sceneId === scene.id ? { ...c, status: "failed", error: "No video URL returned", progress: 0 } : c));
          }
        } catch (err: any) {
          setClips(prev => prev.map(c => c.sceneId === scene.id ? { ...c, status: "failed", error: err.message, progress: 0 } : c));
        }
        await new Promise(r => setTimeout(r, 2000));
      }

      // Phase 3: Export / stitch
      setStatusText("Assembling final video...");
      setProgressValue(90);
      await handleExportInternal(storyboardWithDefaults, newSegments);

      setFlowState("result");
      setStatusText("");
      setProgressValue(100);
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
      setFlowState("idle");
      setStatusText("");
      setProgressValue(0);
    }
  }, [brand, videoParams, modelOverrides, toast]);

  // ─── End Card ──────────────────────────────────────
  const generateEndCardPreview = useCallback((sceneId: string) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, brand.primaryColor || "#ef4444");
    grad.addColorStop(1, brand.secondaryColor || "#1e293b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(brand.name || "", canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = "32px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(brand.tagline || "", canvas.width / 2, canvas.height / 2 + 20);
    const dataUrl = canvas.toDataURL("image/png");
    setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, status: "completed", videoUrl: dataUrl, progress: 100 } : c));
  }, [brand]);

  // ─── Poll ──────────────────────────────────────
  const pollGeneration = async (sceneId: string, generationId: string, provider: "wan" | "veo" | "sora" = "wan") => {
    const maxAttempts = 120;
    let consecutiveErrors = 0;
    for (let i = 0; i < maxAttempts; i++) {
      if (cancelRef.current) {
        setClips(prev => prev.map(c => c.sceneId === sceneId && c.status === "generating" ? { ...c, status: "failed", error: "Cancelled", progress: 0 } : c));
        return;
      }
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
            setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, status: "failed", error: "No video URL", progress: 0 } : c));
            return;
          }
          setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, status: "completed", videoUrl, progress: 100 } : c));
          return;
        }
        if (result.status === "failed") {
          setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, status: "failed", error: "Generation failed", progress: 0 } : c));
          return;
        }
        setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, progress: Math.min(90, 30 + (i / maxAttempts) * 60) } : c));
      } catch (err: any) {
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, status: "failed", error: err?.message || "Polling failed", progress: 0 } : c));
          return;
        }
      }
    }
    setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, status: "failed", error: "Timed out", progress: 0 } : c));
  };

  // ─── Export (internal) ──────────────────────────────────
  const handleExportInternal = useCallback(async (sb?: StoryboardScene[], segs?: ScriptSegment[]) => {
    const useSb = sb || storyboard;
    const useSegs = segs || segments;
    setExporting(true);
    try {
      // Wait for clips state to settle
      await new Promise(r => setTimeout(r, 500));
      
      const latestClips = clipsRef.current;
      const completedClips = latestClips.filter(c => c.status === "completed" && c.videoUrl);
      if (completedClips.length === 0) {
        console.warn("No completed clips for export");
        return;
      }

      const orderedClips = useSb
        .map(scene => {
          const clip = latestClips.find(c => c.sceneId === scene.id);
          const segment = useSegs.find(s => s.id === scene.segmentId);
          const targetDur = segment ? segment.endTime - segment.startTime : 5;
          return clip?.status === "completed" && clip.videoUrl
            ? { videoUrl: clip.videoUrl, targetDuration: targetDur }
            : null;
        })
        .filter(Boolean) as { videoUrl: string; targetDuration: number }[];

      if (orderedClips.length === 0) return;

      const finalUrl = await stitchClips(orderedClips, {
        logo: { url: brand.logoUrl || "", enabled: !!brand.logoUrl, size: 80 },
        endCard: {
          enabled: true,
          brandName: brand.name,
          tagline: brand.tagline,
          website: brand.website,
          primaryColor: brand.primaryColor,
          bgColor: brand.secondaryColor,
          logoUrl: brand.logoUrl,
        },
        subtitles: {
          enabled: true,
          segments: useSegs.map(s => ({ text: s.text, startTime: s.startTime, endTime: s.endTime })),
        },
        musicUrl: musicTrackUrl || undefined,
        musicVolume: 0.15,
      });

      setFinalVideoUrl(finalUrl.blobUrl);
    } catch (err: any) {
      console.warn("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [storyboard, segments, brand, musicTrackUrl]);

  // ─── Export (user-triggered from editor) ──────────────
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const latestClips = clipsRef.current;
      const completedClips = latestClips.filter(c => c.status === "completed" && c.videoUrl);
      if (completedClips.length === 0) throw new Error("No clips to export");

      toast({ title: "Assembling ad..." });

      const orderedClips = storyboard
        .map(scene => {
          const clip = latestClips.find(c => c.sceneId === scene.id);
          const segment = segments.find(s => s.id === scene.segmentId);
          const targetDur = segment ? segment.endTime - segment.startTime : 5;
          return clip?.status === "completed" && clip.videoUrl
            ? { videoUrl: clip.videoUrl, targetDuration: targetDur }
            : null;
        })
        .filter(Boolean) as { videoUrl: string; targetDuration: number }[];

      if (orderedClips.length === 0) throw new Error("No completed clips");

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
          }
        }
      } catch (e) { console.warn("TTS failed:", e); }

      const finalUrl = await stitchClips(orderedClips, {
        logo: { url: brand.logoUrl || "", enabled: !!brand.logoUrl, size: 80 },
        endCard: {
          enabled: true,
          brandName: brand.name,
          tagline: brand.tagline,
          website: brand.website,
          primaryColor: brand.primaryColor,
          bgColor: brand.secondaryColor,
          logoUrl: brand.logoUrl,
        },
        subtitles: {
          enabled: true,
          segments: segments.map(s => ({ text: s.text, startTime: s.startTime, endTime: s.endTime })),
        },
        audioUrl,
        musicUrl: musicTrackUrl || undefined,
        musicVolume: 0.15,
      });

      setFinalVideoUrl(finalUrl.blobUrl);
      toast({ title: "Ad assembled!", description: `${orderedClips.length} scenes stitched` });
    } catch (err: any) {
      toast({ title: "Export failed", description: err.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }, [clips, storyboard, segments, brand, musicTrackUrl, toast]);

  const handleDownload = () => {
    if (!finalVideoUrl) return;
    const a = document.createElement("a");
    a.href = finalVideoUrl;
    a.download = `${brand.name.replace(/\s+/g, "-") || "video"}-ad.webm`;
    a.click();
  };

  // ─── Auto-save clips to storage ────────────────────
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
            const { error } = await supabase.storage.from("generated-videos").upload(fileName, blob, { contentType: "video/mp4", upsert: false });
            if (!error) {
              const { data: publicData } = supabase.storage.from("generated-videos").getPublicUrl(fileName);
              setClips(prev => prev.map(c => c.sceneId === clip.sceneId ? { ...c, videoUrl: publicData.publicUrl } : c));
            }
          } catch (e) { console.warn("Clip upload failed:", e); }
        }
      }
    };
    if (clips.some(c => c.status === "completed" && c.videoUrl && !c.videoUrl.includes("generated-videos"))) {
      uploadCompletedClips();
    }
  }, [clips]);

  // ─── Cancel ──────────────────────────────────────
  const handleCancel = () => {
    cancelRef.current = true;
    setClips(prev => prev.map(c => c.status === "generating" ? { ...c, status: "failed", error: "Cancelled", progress: 0 } : c));
    setFlowState("idle");
    setStatusText("");
    toast({ title: "Generation cancelled" });
  };

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
          onBack={() => setFlowState("result")}
          onExport={handleExport}
          exporting={exporting}
          onOpenExportDialog={() => setExportDialogOpen(true)}
          onRegenerateScene={async (sceneId) => {
            const scene = storyboardRef.current.find(s => s.id === sceneId);
            if (!scene) return;
            const segment = segments.find(seg => seg.id === scene.segmentId);
            const effectiveRatio = userRatio === "Smart" ? "16:9" : userRatio;
            const wanRatio = ["16:9", "9:16", "1:1"].includes(effectiveRatio) ? effectiveRatio : "16:9";
            const rawDur = videoParams.duration > 0 ? videoParams.duration : (segment ? segment.endTime - segment.startTime : 5);
            const sceneDuration = Math.min(Math.max(rawDur, 2), 15);
            const motionPrompt = scene.prompt + " Cinematic camera movement with dynamic subject motion throughout the scene. Avoid static shots.";
            setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, status: "generating", progress: 10 } : c));
            try {
              const result = await invokeEdgeFunction<{
                url?: string; videoUrl?: string; jobId?: string; provider?: "wan" | "veo" | "sora";
              }>("generate-video", {
                action: "generate", prompt: motionPrompt, duration: sceneDuration,
                aspectRatio: wanRatio, provider: "wan", model: "wan2.6-t2v",
                negativePrompt: "static image, zoom only, no motion, blurry, text overlay, watermark",
              }, { timeoutMs: EDGE_TIMEOUT_MS });
              const videoUrl = result.url || result.videoUrl;
              const genId = result.jobId;
              if (videoUrl) {
                setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, status: "completed", videoUrl, progress: 100 } : c));
              } else if (genId) {
                await pollGeneration(sceneId, genId, result.provider || "wan");
              }
            } catch (err: any) {
              setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, status: "failed", error: err.message, progress: 0 } : c));
            }
          }}
          onUpdateClipUrl={(sceneId, url) => setClips(prev => prev.map(c => c.sceneId === sceneId ? { ...c, status: "completed" as const, videoUrl: url, progress: 100 } : c))}
          onUpdateSegment={(id, text) => setSegments(prev => prev.map(s => s.id === id ? { ...s, text } : s))}
          onUpdateSegmentTiming={(id, startTime, endTime) => setSegments(prev => prev.map(s => s.id === id ? { ...s, startTime, endTime } : s))}
          onUpdateStoryboard={setStoryboard}
          onUpdateBrand={setBrand}
          onMusicSelect={setMusicTrackUrl}
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

          {/* Video */}
          <div className="rounded-2xl border border-border/20 bg-card/40 overflow-hidden">
            {finalVideoUrl ? (
              <video
                src={finalVideoUrl}
                controls
                className="w-full aspect-video bg-black"
              />
            ) : (
              <div className="w-full aspect-video bg-muted/20 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Video preview not available — use Edit to view scenes</p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3">
            <Button onClick={handleDownload} disabled={!finalVideoUrl} className="gap-2">
              <Download className="w-4 h-4" />
              Approve & Download
            </Button>
            <Button variant="outline" onClick={() => setFlowState("editing")} className="gap-2">
              <Pencil className="w-4 h-4" />
              Edit Video
            </Button>
          </div>

          {/* New prompt */}
          <div className="pt-4 border-t border-border/10">
            <ChatPromptBar onSubmit={handleSubmit} />
          </div>
        </div>
      )}
    </div>
  );
}
