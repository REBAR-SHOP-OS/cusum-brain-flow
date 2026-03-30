/**
 * BackgroundAdDirectorService — singleton that keeps the Ad Director
 * video generation pipeline alive even when the user navigates away.
 *
 * Pattern mirrors BackgroundAgentService: component subscribes on mount,
 * unsubscribes on unmount; the service keeps running in the background.
 */

import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { stitchClips } from "@/lib/videoStitch";
import { slideshowToVideo } from "@/lib/slideshowToVideo";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  BrandProfile,
  ScriptSegment,
  StoryboardScene,
  ContinuityProfile,
  ClipOutput,
  ModelOverrides,
  PromptQualityScore,
} from "@/types/adDirector";
import type { VideoParams } from "@/components/ad-director/VideoParameters";

export type FlowState = "idle" | "analyzing" | "generating" | "result" | "editing";

const QUALITY_THRESHOLD = 7.0;
const MAX_IMPROVE_ATTEMPTS = 1;
const EDGE_TIMEOUT_MS = 180_000;

function withTimeout<T>(promise: Promise<T>, ms = EDGE_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out — the AI model took too long. Please try again.")), ms)
    ),
  ]);
}

export interface AdDirectorPipelineState {
  flowState: FlowState;
  userPrompt: string;
  userRatio: string;
  statusText: string;
  progressValue: number;
  segments: ScriptSegment[];
  storyboard: StoryboardScene[];
  continuity: ContinuityProfile | null;
  clips: ClipOutput[];
  finalVideoUrl: string | null;
  exporting: boolean;
  musicTrackUrl: string | null;
  brand: BrandProfile;
  videoParams: VideoParams;
  projectId: string | null;
}

class BackgroundAdDirectorService {
  private state: AdDirectorPipelineState;
  private listener: ((s: AdDirectorPipelineState) => void) | null = null;
  private cancelFlag = false;
  private running = false;

  constructor() {
    this.state = this.initialState();
  }

  private initialState(): AdDirectorPipelineState {
    return {
      flowState: "idle",
      userPrompt: "",
      userRatio: "16:9",
      statusText: "",
      progressValue: 0,
      segments: [],
      storyboard: [],
      continuity: null,
      clips: [],
      finalVideoUrl: null,
      exporting: false,
      musicTrackUrl: null,
      brand: {} as BrandProfile,
      videoParams: {} as VideoParams,
      projectId: null,
    };
  }

  private update(partial: Partial<AdDirectorPipelineState>) {
    this.state = { ...this.state, ...partial };
    this.listener?.(this.state);
  }

  private updateClips(fn: (clips: ClipOutput[]) => ClipOutput[]) {
    this.update({ clips: fn(this.state.clips) });
  }

  getState(): AdDirectorPipelineState {
    return this.state;
  }

  isRunning(): boolean {
    return this.running;
  }

  subscribe(cb: (s: AdDirectorPipelineState) => void) {
    this.listener = cb;
  }

  unsubscribe() {
    this.listener = null;
  }

  /** Set individual state fields from the component (e.g. brand, flowState) */
  patchState(partial: Partial<AdDirectorPipelineState>) {
    this.update(partial);
  }

  cancel() {
    this.cancelFlag = true;
    this.updateClips(clips =>
      clips.map(c => c.status === "generating" ? { ...c, status: "failed" as const, error: "Cancelled", progress: 0 } : c)
    );
    this.update({ flowState: "idle", statusText: "" });
    this.running = false;
  }

  reset() {
    this.cancelFlag = false;
    this.running = false;
    this.state = this.initialState();
    this.listener?.(this.state);
  }

  /** Fire-and-forget: generate an AI thumbnail for the project */
  private async generateThumbnail(projectId: string, prompt: string): Promise<void> {
    try {
      await invokeEdgeFunction("generate-thumbnail", { prompt, projectId }, { timeoutMs: 60_000 });
    } catch (e) {
      console.warn("Thumbnail generation failed (non-blocking):", e);
    }
  }

  // ─── Full Pipeline ────────────────────────────────────────
  async startPipeline(
    prompt: string,
    ratio: string,
    images: File[],
    introImage: File | null,
    outroImage: File | null,
    duration: string,
    characterImage: File | null,
    brand: BrandProfile,
    videoParams: VideoParams,
    modelOverrides: ModelOverrides,
    saveProject: (data: any) => Promise<string>,
    videoModel?: string,
    videoProvider?: string,
    selectedProducts?: string[],
    selectedStyles?: string[],
  ) {
    this.cancelFlag = false;
    this.running = true;

    this.update({
      flowState: "analyzing",
      userPrompt: prompt,
      userRatio: ratio,
      brand,
      videoParams,
      finalVideoUrl: null,
      statusText: "Analyzing your idea...",
      progressValue: 10,
      clips: [],
      segments: [],
      storyboard: [],
      continuity: null,
      exporting: false,
    });

    // Upload character image
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

    // Upload intro/outro reference images
    let introImageUrl: string | undefined;
    let outroImageUrl: string | undefined;
    const { uploadToStorage: uploadFn } = await import("@/lib/storageUpload");
    if (introImage) {
      try {
        const path = `intro-refs/${Date.now()}-${introImage.name}`;
        const { error: upErr } = await uploadFn("ad-assets", path, introImage);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("ad-assets").getPublicUrl(path);
          introImageUrl = urlData?.publicUrl;
        }
      } catch (e) {
        console.warn("Intro image upload failed, continuing without it", e);
      }
    }
    if (outroImage) {
      try {
        const path = `outro-refs/${Date.now()}-${outroImage.name}`;
        const { error: upErr } = await uploadFn("ad-assets", path, outroImage);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("ad-assets").getPublicUrl(path);
          outroImageUrl = urlData?.publicUrl;
        }
      } catch (e) {
        console.warn("Outro image upload failed, continuing without it", e);
      }
    }

    try {
      // Phase 1: Analyze
      const analyzeResult = await withTimeout(invokeEdgeFunction<{
        result: { segments: ScriptSegment[]; storyboard: StoryboardScene[]; continuityProfile: ContinuityProfile };
        modelUsed: string;
      }>("ad-director-ai", {
        action: "analyze-script",
        script: prompt,
        brand,
        targetDuration: videoParams.duration,
        sceneCount: videoParams.duration <= 15 ? 1 : videoParams.duration <= 30 ? 2 : Math.ceil(videoParams.duration / 15),
        assetDescriptions: images.length > 0 ? images.map(f => f.name).join(", ") : undefined,
        characterImageUrl,
        introImageUrl,
        outroImageUrl,
        modelOverrides,
        selectedProducts,
        selectedStyles,
      }, { timeoutMs: 90_000 }));

      let { segments: newSegments, storyboard: rawStoryboard, continuityProfile } = analyzeResult.result;

      // ── Enforce scene count based on duration ──────────────────────
      const expectedSceneCount = videoParams.duration <= 15 ? 1 : videoParams.duration <= 30 ? 2 : Math.ceil(videoParams.duration / 15);
      const segmentDuration = videoParams.duration / expectedSceneCount;

      if (rawStoryboard.length > expectedSceneCount) {
        rawStoryboard = rawStoryboard.slice(0, expectedSceneCount);
        newSegments = newSegments.slice(0, expectedSceneCount);
      } else if (rawStoryboard.length < expectedSceneCount) {
        while (rawStoryboard.length < expectedSceneCount) {
          const last = rawStoryboard[rawStoryboard.length - 1];
          const lastSeg = newSegments[newSegments.length - 1];
          rawStoryboard.push({ ...last, id: `${last.id}-pad-${rawStoryboard.length}` });
          newSegments.push({ ...lastSeg, id: `${lastSeg.id}-pad-${newSegments.length}`, label: `Scene ${newSegments.length + 1}` });
        }
      }

      // Force-recalculate segment timings to exact intervals
      newSegments = newSegments.map((seg, i) => ({
        ...seg,
        startTime: Math.round(i * segmentDuration),
        endTime: Math.round((i + 1) * segmentDuration),
      }));
      // Sync storyboard segmentIds
      rawStoryboard = rawStoryboard.map((scene, i) => ({
        ...scene,
        segmentId: newSegments[i].id,
      }));
      // ──────────────────────────────────────────────────────────────

      if (this.cancelFlag) return;

      // Write cinematic prompts
      this.update({ statusText: "Writing cinematic prompts...", progressValue: 30 });
      const promptResults = await Promise.all(
        rawStoryboard.map(async (scene, idx) => {
          try {
            const res = await withTimeout(invokeEdgeFunction<{
              result: { prompt: string }; modelUsed: string;
            }>("ad-director-ai", {
              action: "write-cinematic-prompt",
              scene, brand, continuityProfile,
              previousScene: idx > 0 ? rawStoryboard[idx - 1] : null,
              characterImageUrl, introImageUrl, outroImageUrl,
              sceneIndex: idx, totalScenes: rawStoryboard.length,
              modelOverrides,
              selectedProducts,
              selectedStyles,
            }, { timeoutMs: EDGE_TIMEOUT_MS }));
            return { prompt: res.result.prompt, modelUsed: res.modelUsed };
          } catch { return { prompt: scene.prompt, modelUsed: "original" }; }
        })
      );

      if (this.cancelFlag) return;

      // Score + improve
      this.update({ statusText: "Scoring & improving prompts...", progressValue: 55 });
      const qualityResults = await Promise.all(
        promptResults.map(async (pr, idx) => {
          try {
            const res = await withTimeout(invokeEdgeFunction<{
              result: PromptQualityScore; modelUsed: string;
            }>("ad-director-ai", {
              action: "score-prompt-quality",
              prompt: pr.prompt, scene: rawStoryboard[idx], brand, modelOverrides,
            }, { timeoutMs: EDGE_TIMEOUT_MS }));
            return { quality: res.result, scoredBy: res.modelUsed };
          } catch { return { quality: undefined, scoredBy: "skipped" }; }
        })
      );

      this.update({ progressValue: 75 });
      const finalPrompts = await Promise.all(
        promptResults.map(async (pr, idx) => {
          const quality = qualityResults[idx]?.quality;
          if (!quality || quality.overall >= QUALITY_THRESHOLD) return pr;
          for (let attempt = 0; attempt < MAX_IMPROVE_ATTEMPTS; attempt++) {
            try {
              const improveRes = await withTimeout(invokeEdgeFunction<{
                result: { prompt: string }; modelUsed: string;
              }>("ad-director-ai", {
                action: "improve-prompt",
                prompt: pr.prompt, qualityScore: quality,
                scene: rawStoryboard[idx], brand, modelOverrides,
              }, { timeoutMs: EDGE_TIMEOUT_MS }));
              const rescoreRes = await withTimeout(invokeEdgeFunction<{
                result: PromptQualityScore;
              }>("ad-director-ai", {
                action: "score-prompt-quality",
                prompt: improveRes.result.prompt,
                scene: rawStoryboard[idx], brand, modelOverrides,
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

      const initialClips: ClipOutput[] = storyboardWithDefaults.map(s => ({
        sceneId: s.id, status: "idle" as const, progress: 0,
      }));

      this.update({
        segments: newSegments,
        storyboard: storyboardWithDefaults,
        continuity: continuityProfile,
        clips: initialClips,
      });

      // Auto-save — reuse existing project with same prompt if possible
      try {
        let projectId = this.state.projectId;
        if (!projectId && prompt) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: existing } = await supabase
                .from("ad_projects")
                .select("id")
                .eq("user_id", user.id)
                .eq("script", prompt)
                .order("updated_at", { ascending: false })
                .limit(1);
              if (existing && existing.length > 0) {
                projectId = existing[0].id;
              }
            }
          } catch (_) { /* ignore lookup failure */ }
        }
        const savedId = await saveProject({
          id: projectId ?? undefined,
          name: prompt ? (prompt.length > 50 ? prompt.substring(0, 50).replace(/\s+\S*$/, "…") : prompt) : (brand.name ? `${brand.name} Ad` : "Untitled Ad"),
          brandName: brand.name, script: prompt,
          segments: newSegments, storyboard: storyboardWithDefaults,
          clips: initialClips, continuity: continuityProfile, status: "analyzed",
        });
        this.update({ projectId: savedId });

        // Generate thumbnail in background (fire-and-forget)
        if (prompt && savedId) {
          this.generateThumbnail(savedId, prompt).catch(e => console.warn("Thumbnail generation failed:", e));
        }
      } catch (e) { console.warn("Auto-save failed:", e); }

      if (this.cancelFlag) return;

      // Phase 2: Generate scenes
      this.update({ flowState: "generating", progressValue: 0 });

      const effectiveRatio = ratio === "Smart" ? "16:9" : ratio;
      const wanRatio = ["16:9", "9:16", "1:1", "4:3"].includes(effectiveRatio) ? effectiveRatio : "16:9";

      // Pre-compute shared values
      const sceneDuration = 15;
      const cp = continuityProfile;
      const continuityPrefix = cp
        ? `[Visual continuity: ${cp.environment || ""}, ${cp.lightingType || ""}, ${cp.colorMood || ""}, subject: ${cp.subjectDescriptions || ""}, wardrobe: ${cp.wardrobe || ""}] `
        : "";
      const lastVisualIdx = storyboardWithDefaults.reduce((acc, s, idx) => {
        const seg = newSegments.find(sg => sg.id === s.segmentId);
        return (s.generationMode !== "static-card" && seg?.type !== "closing") ? idx : acc;
      }, 0);

      // Generate all scenes in parallel
      const scenePromises = storyboardWithDefaults.map(async (scene, i) => {
        if (this.cancelFlag) return;
        const segment = newSegments.find(seg => seg.id === scene.segmentId);

        // End card — handle synchronously
        if (scene.generationMode === "static-card" || segment?.type === "closing") {
          this.generateEndCard(scene.id, brand);
          return;
        }

        const motionPrompt = continuityPrefix + scene.prompt + " Cinematic camera movement with dynamic subject motion throughout the scene. Avoid static shots.";
        this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "generating" as const, progress: 10 } : c));

        try {
          const isFirstScene = i === 0;
          const isLastVisualScene = i === lastVisualIdx;

          let referenceImage: string | undefined;
          if (isFirstScene && introImageUrl) {
            referenceImage = introImageUrl;
          } else if (isLastVisualScene && outroImageUrl) {
            referenceImage = outroImageUrl;
          } else if (characterImageUrl && scene.generationMode === "image-to-video") {
            referenceImage = characterImageUrl;
          }

          const chosenProvider = videoProvider || "wan";
          const isI2V = !!referenceImage;
          const chosenModel = videoModel || (isI2V ? "wan2.6-i2v" : "wan2.6-t2v");
          const result = await invokeEdgeFunction<{
            url?: string; videoUrl?: string; generationId?: string; jobId?: string;
            provider?: "wan" | "veo" | "sora"; mode?: string; imageUrls?: string[];
          }>("generate-video", {
            action: "generate", prompt: motionPrompt, duration: sceneDuration,
            aspectRatio: wanRatio, provider: chosenProvider,
            model: chosenModel,
            ...(isI2V ? { imageUrl: referenceImage } : {}),
            negativePrompt: "static image, zoom only, no motion, blurry, text, words, letters, titles, subtitles, captions, watermark, typography, written content, overlay text, any text of any kind",
          }, { timeoutMs: EDGE_TIMEOUT_MS });

          const videoUrl = result.url || result.videoUrl;
          const genId = result.jobId || result.generationId;
          const provider = result.provider || "wan";

          if (result.mode === "slideshow" && result.imageUrls?.length) {
            this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "completed" as const, videoUrl: result.imageUrls![0], progress: 100 } : c));
          } else if (videoUrl) {
            this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "completed" as const, videoUrl, progress: 100, generationId: genId } : c));
          } else if (genId) {
            this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "generating" as const, generationId: genId, progress: 30 } : c));
            await this.pollGeneration(scene.id, genId, provider);
          } else {
            this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "failed" as const, error: "No video URL returned", progress: 0 } : c));
          }
        } catch (err: any) {
          this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "failed" as const, error: err.message, progress: 0 } : c));
        }
      });

      // Update progress while scenes generate in parallel
      const progressInterval = setInterval(() => {
        if (this.cancelFlag) { clearInterval(progressInterval); return; }
        const currentClips = this.state.clips;
        const total = currentClips.length;
        const done = currentClips.filter(c => c.status === "completed" || c.status === "failed").length;
        const generating = currentClips.filter(c => c.status === "generating");
        const avgProgress = generating.length > 0 ? generating.reduce((s, c) => s + (c.progress || 0), 0) / generating.length : 0;
        const overallProgress = Math.round(((done + avgProgress / 100) / total) * 100);
        this.update({
          statusText: `Generating scenes... ${done}/${total} complete`,
          progressValue: overallProgress,
        });
      }, 2000);

      await Promise.allSettled(scenePromises);
      clearInterval(progressInterval);

      // Phase 2b: Auto-retry unresolved scenes (failed/idle/generating-without-url) — up to 2 rounds
      const MAX_RETRY_ROUNDS = 2;
      for (let retryRound = 1; retryRound <= MAX_RETRY_ROUNDS; retryRound++) {
        if (this.cancelFlag) break;

        const unresolvedClips = this.state.clips.filter(c =>
          c.status === "failed" || c.status === "idle" || c.status === "queued" ||
          (c.status === "generating" && !c.videoUrl)
        );
        if (unresolvedClips.length === 0) break;

        console.log(`[AdDirector] Retry round ${retryRound}/${MAX_RETRY_ROUNDS}: ${unresolvedClips.length} unresolved scene(s)`);
        this.update({ statusText: `Retrying failed scenes... attempt ${retryRound}/${MAX_RETRY_ROUNDS} (${unresolvedClips.length} scene${unresolvedClips.length > 1 ? "s" : ""})` });

        // Small delay before retry to avoid rate limits
        await new Promise(r => setTimeout(r, 4000));

        const retryPromises = unresolvedClips.map(async (failedClip) => {
          if (this.cancelFlag) return;
          const scene = storyboardWithDefaults.find(s => s.id === failedClip.sceneId);
          if (!scene) return;
          const segment = newSegments.find(seg => seg.id === scene.segmentId);
          if (scene.generationMode === "static-card" || segment?.type === "closing") return;

          const motionPrompt = continuityPrefix + scene.prompt + " Cinematic camera movement with dynamic subject motion throughout the scene. Avoid static shots.";
          this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "generating" as const, error: null, progress: 10 } : c));

          try {
            const sceneIdx = storyboardWithDefaults.indexOf(scene);
            const isFirstScene = sceneIdx === 0;
            const isLastVisualScene = sceneIdx === lastVisualIdx;

            let referenceImage: string | undefined;
            if (isFirstScene && introImageUrl) {
              referenceImage = introImageUrl;
            } else if (isLastVisualScene && outroImageUrl) {
              referenceImage = outroImageUrl;
            } else if (characterImageUrl && scene.generationMode === "image-to-video") {
              referenceImage = characterImageUrl;
            }

            const chosenProvider = videoProvider || "wan";
            const isI2V = !!referenceImage;
            const chosenModel = videoModel || (isI2V ? "wan2.6-i2v" : "wan2.6-t2v");

            const result = await invokeEdgeFunction<{
              url?: string; videoUrl?: string; generationId?: string; jobId?: string;
              provider?: "wan" | "veo" | "sora"; mode?: string; imageUrls?: string[];
            }>("generate-video", {
              action: "generate", prompt: motionPrompt, duration: sceneDuration,
              aspectRatio: wanRatio, provider: chosenProvider, model: chosenModel,
              ...(isI2V ? { imageUrl: referenceImage } : {}),
              negativePrompt: "static image, zoom only, no motion, blurry, text, words, letters, titles, subtitles, captions, watermark, typography, written content, overlay text, any text of any kind",
            }, { timeoutMs: EDGE_TIMEOUT_MS });

            const videoUrl = result.url || result.videoUrl;
            const genId = result.jobId || result.generationId;
            const provider = result.provider || "wan";

            if (result.mode === "slideshow" && result.imageUrls?.length) {
              this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "completed" as const, videoUrl: result.imageUrls![0], progress: 100 } : c));
            } else if (videoUrl) {
              this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "completed" as const, videoUrl, progress: 100, generationId: genId } : c));
            } else if (genId) {
              this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "generating" as const, generationId: genId, progress: 30 } : c));
              await this.pollGeneration(scene.id, genId, provider);
            } else {
              this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "failed" as const, error: "No video URL returned (retry)", progress: 0 } : c));
            }
          } catch (err: any) {
            this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "failed" as const, error: err.message, progress: 0 } : c));
          }
        });

        await Promise.allSettled(retryPromises);
      }

      const stillFailed = this.state.clips.filter(c => c.status === "failed").length;
      if (stillFailed > 0) {
        console.warn(`[AdDirector] ${stillFailed} scene(s) still failed after retries`);
      }

      // Phase 3: Export / stitch
      this.update({ statusText: "Assembling final video...", progressValue: 90 });
      await this.handleExportInternal(storyboardWithDefaults, newSegments, brand);

      // Upload completed clips to storage
      await this.uploadCompletedClips();

      this.update({ flowState: "result", statusText: "", progressValue: 100 });
      this.running = false;

      // Notify if component not mounted
      if (!this.listener) {
        toast.success("AI Video Director finished generating your video!");
      }
    } catch (err: any) {
      this.update({ flowState: "idle", statusText: "", progressValue: 0 });
      this.running = false;
      if (this.listener) {
        // Component is mounted, it can handle the error
        throw err;
      } else {
        toast.error(`Video generation failed: ${err.message}`);
      }
    }
  }

  // ─── End Card ──────────────────────────────────
  private generateEndCard(sceneId: string, brand: BrandProfile) {
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
    this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "completed" as const, videoUrl: dataUrl, progress: 100 } : c));
  }

  // ─── Poll ──────────────────────────────────────
  private async pollGeneration(sceneId: string, generationId: string, provider: "wan" | "veo" | "sora" = "wan") {
    const maxAttempts = 120;
    let consecutiveErrors = 0;
    for (let i = 0; i < maxAttempts; i++) {
      if (this.cancelFlag) {
        this.updateClips(clips => clips.map(c => c.sceneId === sceneId && c.status === "generating" ? { ...c, status: "failed" as const, error: "Cancelled", progress: 0 } : c));
        return;
      }
      const pollDelay = i < 10 ? 3000 : 5000;
      await new Promise(r => setTimeout(r, pollDelay));
      try {
        const result = await invokeEdgeFunction<{ status?: string; videoUrl?: string; url?: string }>(
          "generate-video", { action: "poll", jobId: generationId, provider }
        );
        consecutiveErrors = 0;
        if (result.status === "completed" || result.videoUrl || result.url) {
          const videoUrl = result.videoUrl || result.url;
          if (!videoUrl) {
            this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: "No video URL", progress: 0 } : c));
            return;
          }
          this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "completed" as const, videoUrl, progress: 100 } : c));
          return;
        }
        if (result.status === "failed") {
          this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: "Generation failed", progress: 0 } : c));
          return;
        }
        this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, progress: Math.min(90, 30 + (i / maxAttempts) * 60) } : c));
      } catch (err: any) {
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: err?.message || "Polling failed", progress: 0 } : c));
          return;
        }
      }
    }
    this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: "Timed out", progress: 0 } : c));
  }

  // ─── Export (internal) ──────────────────────────
  private async handleExportInternal(sb: StoryboardScene[], segs: ScriptSegment[], brand: BrandProfile) {
    this.update({ exporting: true });
    try {
      const latestClips = this.state.clips;
      const completedClips = latestClips.filter(c => c.status === "completed" && c.videoUrl);
      if (completedClips.length === 0) { console.warn("No completed clips for export"); return; }

      const orderedClips = sb
        .map(scene => {
          const clip = latestClips.find(c => c.sceneId === scene.id);
          const segment = segs.find(s => s.id === scene.segmentId);
          const targetDur = segment ? segment.endTime - segment.startTime : 5;
          return clip?.status === "completed" && clip.videoUrl
            ? { videoUrl: clip.videoUrl, targetDuration: targetDur } : null;
        })
        .filter(Boolean) as { videoUrl: string; targetDuration: number }[];

      if (orderedClips.length === 0) return;

      const finalUrl = await stitchClips(orderedClips, {
        logo: { url: brand.logoUrl || "", enabled: !!brand.logoUrl, size: 80 },
        endCard: {
          enabled: true, brandName: brand.name, tagline: brand.tagline,
          website: brand.website, primaryColor: brand.primaryColor,
          bgColor: brand.secondaryColor, logoUrl: brand.logoUrl,
        },
        subtitles: { enabled: false, segments: [] },
        musicUrl: this.state.musicTrackUrl || undefined,
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
          }
        }
      } catch (e) { console.warn("[bgService] Upload to storage failed:", e); }

      this.update({ finalVideoUrl: permanentUrl });
    } catch (err: any) {
      console.warn("Export failed:", err);
    } finally {
      this.update({ exporting: false });
    }
  }

  // ─── Upload completed clips to storage ─────────
  private async uploadCompletedClips() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      for (const clip of this.state.clips) {
        if (clip.status === "completed" && clip.videoUrl && !clip.videoUrl.includes("generated-videos")) {
          try {
            const resp = await fetch(clip.videoUrl);
            if (!resp.ok) continue;
            const blob = await resp.blob();
            const fileName = `${user.id}/${crypto.randomUUID()}.mp4`;
            const { error } = await supabase.storage.from("generated-videos").upload(fileName, blob, { contentType: "video/mp4", upsert: false });
            if (!error) {
              const { data: publicData } = supabase.storage.from("generated-videos").getPublicUrl(fileName);
              this.updateClips(clips => clips.map(c => c.sceneId === clip.sceneId ? { ...c, videoUrl: publicData.publicUrl } : c));
            }
          } catch (e) { console.warn("Clip upload failed:", e); }
        }
      }
    } catch (e) { console.warn("Clip upload batch failed:", e); }
  }
}

/** Singleton instance that outlives component lifecycles. */
export const backgroundAdDirectorService = new BackgroundAdDirectorService();
