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

type SaveProjectInput = {
  id?: string;
  name: string;
  brandName?: string;
  script?: string;
  segments?: ScriptSegment[];
  storyboard?: StoryboardScene[];
  clips?: ClipOutput[];
  continuity?: ContinuityProfile | null;
  finalVideoUrl?: string | null;
  status?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

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
  sourceFootageCount: number;
  segments: ScriptSegment[];
  storyboard: StoryboardScene[];
  continuity: ContinuityProfile | null;
  clips: ClipOutput[];
  finalVideoUrl: string | null;
  exporting: boolean;
  musicTrackUrl: string | null;
  voiceoverUrl: string | null;
  brand: BrandProfile;
  videoParams: VideoParams;
  projectId: string | null;
  // Persisted generation context — required for per-scene regenerate to mirror initial pipeline
  characterImageUrl?: string | null;
  introImageUrl?: string | null;
  outroImageUrl?: string | null;
  characterPrompt?: string | null;
  videoProvider?: string | null;
  videoModel?: string | null;
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
      sourceFootageCount: 0,
      segments: [],
      storyboard: [],
      continuity: null,
      clips: [],
      finalVideoUrl: null,
      exporting: false,
      musicTrackUrl: null,
      voiceoverUrl: null,
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

  /** Mark pipeline as running externally (for resume/recovery flows). */
  setRunning(value: boolean) {
    this.running = value;
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

  /** Fire-and-forget: generate an AI thumbnail for the project. Silently ignores transient failures (rate-limits, payment, timeout). */
  private async generateThumbnail(projectId: string, prompt: string): Promise<void> {
    try {
      await invokeEdgeFunction("generate-thumbnail", { prompt, projectId }, { timeoutMs: 60_000 });
    } catch (e: any) {
      // Transient — never block the user, never surface as warning/error
      const status = e?.status ?? e?.cause?.status;
      const msg = String(e?.message ?? "");
      const isTransient =
        status === 429 || status === 402 || status === 408 || status === 504 ||
        /rate limit|payment required|timeout/i.test(msg);
      if (!isTransient) {
        console.info("[thumbnail] skipped:", msg || e);
      }
    }
  }

  // ─── Full Pipeline ────────────────────────────────────────
  async startPipeline(
    prompt: string,
    ratio: string,
    sourceMedia: File[],
    introImage: File | null,
    outroImage: File | null,
    duration: string,
    characterImage: File | null,
    brand: BrandProfile,
    videoParams: VideoParams,
    modelOverrides: ModelOverrides,
    saveProject: (data: SaveProjectInput) => Promise<string>,
    videoModel?: string,
    videoProvider?: string,
    selectedProducts?: string[],
    selectedStyles?: string[],
    characterPrompt?: string,
  ) {
    this.cancelFlag = false;
    this.running = true;

    this.update({
      flowState: "analyzing",
      userPrompt: prompt,
      userRatio: ratio,
      sourceFootageCount: sourceMedia.length,
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
    let sourceMediaUrls: string[] = [];
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

    if (sourceMedia.length > 0) {
      const uploadedSourceMedia = await Promise.all(
        sourceMedia.map(async (mediaFile) => {
          try {
            const folder = mediaFile.type.startsWith("video/") ? "source-videos" : "source-images";
            const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${mediaFile.name}`;
            const { error: uploadError } = await uploadFn("ad-assets", path, mediaFile);
            if (!uploadError) {
              const { data: urlData } = supabase.storage.from("ad-assets").getPublicUrl(path);
              return urlData?.publicUrl ?? null;
            }
          } catch (error) {
            console.warn("Source media upload failed, continuing without it", error);
          }
          return null;
        })
      );
    }

    // Persist generation context so per-scene regenerate can mirror the initial pipeline
    this.update({
      characterImageUrl: characterImageUrl ?? null,
      introImageUrl: introImageUrl ?? null,
      outroImageUrl: outroImageUrl ?? null,
      characterPrompt: characterPrompt ?? null,
      videoProvider: videoProvider ?? null,
      videoModel: videoModel ?? null,
    });

    try {
      // ── Force minimum scene count when BOTH intro & outro are uploaded ──
      // (so the intro image can anchor scene 1 AND the outro image can anchor the final scene)
      const bothFramesProvided = !!(introImageUrl && outroImageUrl);
      const baseSceneCount = videoParams.duration <= 15 ? 1 : videoParams.duration <= 30 ? 2 : Math.ceil(videoParams.duration / 15);
      const requestedSceneCount = bothFramesProvided ? Math.max(2, baseSceneCount) : baseSceneCount;

      // Phase 1: Analyze
      const analyzeResult = await withTimeout(invokeEdgeFunction<{
        result: { segments: ScriptSegment[]; storyboard: StoryboardScene[]; continuityProfile: ContinuityProfile };
        modelUsed: string;
      }>("ad-director-ai", {
        action: "analyze-script",
        script: prompt,
        brand,
        targetDuration: videoParams.duration,
        sceneCount: requestedSceneCount,
        assetDescriptions: sourceMedia.length > 0
          ? sourceMedia.map((file) => `${file.type.startsWith("video/") ? "video clip" : "image"}: ${file.name}`).join(", ")
          : undefined,
        sourceClipDescriptions: sourceMedia.map((file) =>
          `${file.name} (${file.type.startsWith("video/") ? "video clip" : "image asset"})`
        ),
        characterImageUrl,
        introImageUrl,
        outroImageUrl,
        modelOverrides,
        selectedProducts,
        selectedStyles,
      }, { timeoutMs: 90_000 }));

      let { segments: newSegments, storyboard: rawStoryboard } = analyzeResult.result;
      const continuityProfile = analyzeResult.result.continuityProfile;

      // ── Enforce scene count based on duration (or override when both frames set) ──
      const expectedSceneCount = requestedSceneCount;
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

      // Determine which scene index is the "last visual" (for outro frame anchoring)
      const lastVisualSceneIdx = rawStoryboard.reduce((acc, s, idx) => {
        const seg = newSegments.find(sg => sg.id === s.segmentId);
        return (s.generationMode !== "static-card" && seg?.type !== "closing") ? idx : acc;
      }, 0);

      const storyboardWithDefaults: StoryboardScene[] = rawStoryboard.map((s, idx) => {
        const isFirstScene = idx === 0;
        const isLastVisualScene = idx === lastVisualSceneIdx;
        // Force image-to-video mode whenever any reference image is anchored to the scene:
        // intro on first, outro on last visual, or a character reference on any non-static scene.
        const forcedI2V =
          (isFirstScene && !!introImageUrl) ||
          (isLastVisualScene && !!outroImageUrl) ||
          (!!characterImageUrl && s.generationMode !== "static-card");
        return {
          ...s,
          prompt: finalPrompts[idx].prompt,
          continuityLock: true,
          locked: false,
          generationMode: forcedI2V ? "image-to-video" : s.generationMode,
          referenceAssetUrl: sourceMediaUrls[idx] ?? sourceMediaUrls[0] ?? null,
          sceneIntelligence: {
            plannedBy: analyzeResult.modelUsed,
            promptWrittenBy: finalPrompts[idx].modelUsed,
            promptScoredBy: qualityResults[idx]?.scoredBy,
          },
          promptQuality: qualityResults[idx]?.quality,
        };
      });

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

      // Pre-compute shared values — derive per-scene duration from user choice
      const requestedTotal = videoParams?.duration && videoParams.duration > 0 ? videoParams.duration : 30;
      const sceneDuration = Math.max(2, Math.min(15, Math.round(requestedTotal / Math.max(1, storyboardWithDefaults.length))));
      const cp = continuityProfile;
      const continuityPrefix = cp
        ? `[Visual continuity: ${cp.environment || ""}, ${cp.lightingType || ""}, ${cp.colorMood || ""}` +
          (characterImageUrl
            ? `, wardrobe-and-look: see reference image (do not re-describe the person in words)`
            : `, subject: ${cp.subjectDescriptions || ""}, wardrobe: ${cp.wardrobe || ""}`) +
          `] `
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

        const motionPrompt = continuityPrefix + scene.prompt + " Shape this into a post-ready ad shot with premium after-effects-style transitions, polished pacing, and a strong intro/outro rhythm. Cinematic camera movement with dynamic subject motion throughout the scene. Avoid static shots.";
        this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "generating" as const, progress: 10 } : c));

        try {
          const isFirstScene = i === 0;
          const isLastVisualScene = i === lastVisualIdx;

          let referenceImage: string | undefined;
          // Priority: intro/outro override character ONLY for the specific anchor scene.
          // For all other scenes, the character image (if present) is used so the same face appears throughout.
          if (isFirstScene && introImageUrl) {
            referenceImage = introImageUrl;
          } else if (isLastVisualScene && outroImageUrl) {
            referenceImage = outroImageUrl;
          } else if (characterImageUrl) {
            referenceImage = characterImageUrl;
          }

          const chosenProvider = videoProvider || "wan";
          const isI2V = !!referenceImage;
          const chosenModel = videoModel || (isI2V ? "wan2.6-i2v" : "wan2.6-t2v");

          // Inject user-written character direction whenever this scene uses the character ref.
          const usingCharacter = !!characterImageUrl && referenceImage === characterImageUrl;
          const characterLockHeader = `[CHARACTER LOCK: The person in the reference image is the EXACT spokesperson — preserve their face, skin tone, hair, age, ethnicity, and clothing identically. Do NOT generate a different person, do NOT alter their identity.]\n`;
          const finalPrompt = usingCharacter
            ? `${characterLockHeader}${motionPrompt}` +
              (characterPrompt && characterPrompt.trim()
                ? `\n\nCharacter direction (actions only — keep face and look unchanged): ${characterPrompt.trim()}`
                : "")
            : motionPrompt;

          const baseNegative = "static image, zoom only, no motion, blurry, text, words, letters, titles, subtitles, captions, watermark, typography, written content, overlay text, any text of any kind";
          const negativePrompt = (isI2V && characterImageUrl)
            ? `${baseNegative}, different person, different face, identity change, face swap, wrong ethnicity, wrong age, generic stock person, replaced subject, altered facial features`
            : baseNegative;

          const result = await invokeEdgeFunction<{
            url?: string; videoUrl?: string; generationId?: string; jobId?: string;
            provider?: "wan" | "veo" | "sora"; mode?: string; imageUrls?: string[];
          }>("generate-video", {
            action: "generate", prompt: finalPrompt, duration: sceneDuration,
            aspectRatio: wanRatio, provider: chosenProvider,
            model: chosenModel,
            ...(isI2V ? { imageUrl: referenceImage } : {}),
            negativePrompt,
          }, { timeoutMs: EDGE_TIMEOUT_MS });

          const videoUrl = result.url || result.videoUrl;
          const genId = result.jobId || result.generationId;
          const provider = result.provider || "wan";

          if (result.mode === "slideshow" && result.imageUrls?.length) {
            try {
              const slideshowBlobUrl = await slideshowToVideo({ imageUrls: result.imageUrls!, durationPerImage: 4, width: 1280, height: 720 });
              this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "completed" as const, videoUrl: slideshowBlobUrl, progress: 100 } : c));
            } catch {
              this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "completed" as const, videoUrl: result.imageUrls![0], progress: 100 } : c));
            }
          } else if (videoUrl) {
            this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "completed" as const, videoUrl, progress: 100, generationId: genId } : c));
          } else if (genId) {
            this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "generating" as const, generationId: genId, progress: 30 } : c));
            await this.pollGeneration(scene.id, genId, provider);
          } else {
            this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "failed" as const, error: "No video URL returned", progress: 0 } : c));
          }
        } catch (error) {
          this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "failed" as const, error: getErrorMessage(error, "Scene generation failed"), progress: 0 } : c));
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

          const motionPrompt = continuityPrefix + scene.prompt + " Shape this into a post-ready ad shot with premium after-effects-style transitions, polished pacing, and a strong intro/outro rhythm. Cinematic camera movement with dynamic subject motion throughout the scene. Avoid static shots.";
          this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "generating" as const, error: null, progress: 10 } : c));

          try {
            const sceneIdx = storyboardWithDefaults.indexOf(scene);
            const isFirstScene = sceneIdx === 0;
            const isLastVisualScene = sceneIdx === lastVisualIdx;

            let referenceImage: string | undefined;
            // Same priority as initial generation — keep the same character face across retries.
            if (isFirstScene && introImageUrl) {
              referenceImage = introImageUrl;
            } else if (isLastVisualScene && outroImageUrl) {
              referenceImage = outroImageUrl;
            } else if (characterImageUrl) {
              referenceImage = characterImageUrl;
            }

            const chosenProvider = videoProvider || "wan";
            const isI2V = !!referenceImage;
            const chosenModel = videoModel || (isI2V ? "wan2.6-i2v" : "wan2.6-t2v");

            const usingCharacter = !!characterImageUrl && referenceImage === characterImageUrl;
            const finalPrompt = (usingCharacter && characterPrompt && characterPrompt.trim())
              ? `${motionPrompt}\n\nCharacter direction (this person speaks/acts on camera — keep their face and look unchanged): ${characterPrompt.trim()}`
              : motionPrompt;

            const result = await invokeEdgeFunction<{
              url?: string; videoUrl?: string; generationId?: string; jobId?: string;
              provider?: "wan" | "veo" | "sora"; mode?: string; imageUrls?: string[];
            }>("generate-video", {
              action: "generate", prompt: finalPrompt, duration: sceneDuration,
              aspectRatio: wanRatio, provider: chosenProvider, model: chosenModel,
              ...(isI2V ? { imageUrl: referenceImage } : {}),
              negativePrompt: "static image, zoom only, no motion, blurry, text, words, letters, titles, subtitles, captions, watermark, typography, written content, overlay text, any text of any kind",
            }, { timeoutMs: EDGE_TIMEOUT_MS });

            const videoUrl = result.url || result.videoUrl;
            const genId = result.jobId || result.generationId;
            const provider = result.provider || "wan";

            if (result.mode === "slideshow" && result.imageUrls?.length) {
              try {
                const slideshowBlobUrl = await slideshowToVideo({ imageUrls: result.imageUrls!, durationPerImage: 4, width: 1280, height: 720 });
                this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "completed" as const, videoUrl: slideshowBlobUrl, progress: 100 } : c));
              } catch {
                this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "completed" as const, videoUrl: result.imageUrls![0], progress: 100 } : c));
              }
            } else if (videoUrl) {
              this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "completed" as const, videoUrl, progress: 100, generationId: genId } : c));
            } else if (genId) {
              this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "generating" as const, generationId: genId, progress: 30 } : c));
              await this.pollGeneration(scene.id, genId, provider);
            } else {
              this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "failed" as const, error: "No video URL returned (retry)", progress: 0 } : c));
            }
          } catch (error) {
            this.updateClips(clips => clips.map(c => c.sceneId === scene.id ? { ...c, status: "failed" as const, error: getErrorMessage(error, "Scene retry failed"), progress: 0 } : c));
          }
        });

        await Promise.allSettled(retryPromises);
      }

      // Sync DB with final clip state so reload doesn't trigger "Recovering missing scenes"
      try {
        const pid = this.state.projectId;
        if (pid) {
          const finalStatus = this.state.clips.every(c => c.status === "completed" && c.videoUrl) ? "completed" : "draft";
          await saveProject({
            id: pid,
            name: prompt ? (prompt.length > 50 ? prompt.substring(0, 50).replace(/\s+\S*$/, "…") : prompt) : (brand.name ? `${brand.name} Ad` : "Untitled Ad"),
            brandName: brand.name, script: prompt,
            segments: newSegments, storyboard: storyboardWithDefaults,
            clips: this.state.clips, continuity: continuityProfile, status: finalStatus,
          });
        }
      } catch (e) { console.warn("Post-generation save failed:", e); }

      const unresolvedCount = this.state.clips.filter(c => c.status !== "completed" || !c.videoUrl).length;
      if (unresolvedCount > 0) {
        console.warn(`[AdDirector] ${unresolvedCount} scene(s) still without video after retries — showing result view with retry buttons`);
        toast.warning(`${unresolvedCount} scene(s) failed. Click the retry icon on each card to regenerate.`);
        if (!this.listener) {
          toast.info("Video generation incomplete — some scenes need attention.");
        }
      } else {
        // Phase 3: Export / stitch (only when all scenes succeeded)
        this.update({ statusText: "Assembling final video...", progressValue: 90 });
        await this.handleExportInternal(storyboardWithDefaults, newSegments, brand);

        // Upload completed clips to storage
        await this.uploadCompletedClips();
      }

      // Always land on result view so user sees scene cards (with retry icons for failures)
      this.update({ flowState: "result", statusText: "", progressValue: 100 });
      this.running = false;

      // Notify if component not mounted
      if (!this.listener) {
        toast.success("AI Video Director finished generating your video!");
      }
    } catch (error) {
      this.update({ flowState: "idle", statusText: "", progressValue: 0 });
      this.running = false;
      // Always surface a toast so the user gets feedback in any context.
      const { classifyEdgeFunctionError, isRecoverableEdgeError } = await import("@/lib/edgeFunctionError");
      const info = classifyEdgeFunctionError(error, "Video generation failed");
      toast.error(info.title, { description: info.description });
      // Only rethrow truly unexpected developer/runtime faults so the UI never goes blank
      // on known business errors (402 credits, 429 rate limit, 401/403 auth, timeouts).
      if (!isRecoverableEdgeError(error) && !this.listener) {
        // Background context with unknown error — toast already shown, swallow to avoid unhandled rejection.
        console.error("[AdDirector] pipeline failed (background):", error);
      } else if (!isRecoverableEdgeError(error) && this.listener) {
        throw error;
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

  // ─── Regenerate single scene ────────────────────
  // Mirrors initial-pipeline logic exactly: same i2v/t2v selection, CHARACTER LOCK header,
  // continuity prefix, character direction, and enhanced negative prompt.
  async regenerateScene(sceneId: string, customPrompt?: string): Promise<void> {
    const s = this.state;
    const scene = s.storyboard.find(sc => sc.id === sceneId);
    if (!scene) return;
    const segment = s.segments.find(seg => seg.id === scene.segmentId);

    const effectiveRatio = s.userRatio === "Smart" ? "16:9" : s.userRatio;
    const wanRatio = ["16:9", "9:16", "1:1", "4:3"].includes(effectiveRatio) ? effectiveRatio : "16:9";
    const rawDur = s.videoParams?.duration && s.videoParams.duration > 0
      ? Math.round(s.videoParams.duration / Math.max(1, s.storyboard.length))
      : (segment ? segment.endTime - segment.startTime : 5);
    const sceneDuration = Math.max(2, Math.min(15, rawDur));

    // Build motion prompt with continuity prefix (same as initial pipeline)
    const cp = s.continuity;
    const characterImageUrl = s.characterImageUrl || undefined;
    const introImageUrl = s.introImageUrl || undefined;
    const outroImageUrl = s.outroImageUrl || undefined;
    const characterPrompt = s.characterPrompt || undefined;

    const continuityPrefix = cp
      ? `[Visual continuity: ${cp.environment || ""}, ${cp.lightingType || ""}, ${cp.colorMood || ""}` +
        (characterImageUrl
          ? `, wardrobe-and-look: see reference image (do not re-describe the person in words)`
          : `, subject: ${cp.subjectDescriptions || ""}, wardrobe: ${cp.wardrobe || ""}`) +
        `] `
      : "";

    // Scene index — used for both narrative bridge and reference image selection
    const sceneIdx = s.storyboard.indexOf(scene);

    // ─── Narrative bridge: connect to previous/next scenes for story flow ───
    const previousScene = sceneIdx > 0 ? s.storyboard[sceneIdx - 1] : null;
    const nextScene = sceneIdx >= 0 && sceneIdx < s.storyboard.length - 1 ? s.storyboard[sceneIdx + 1] : null;
    const prevEndsWith = (previousScene as any)?.endsWith || cp?.lastFrameSummary || "";
    const prevAction = previousScene?.subjectAction || "";
    const nextObjective = nextScene?.objective || "";

    const narrativeBridge = previousScene
      ? `[Narrative bridge: This scene begins exactly where the previous scene ended${prevEndsWith ? ` — previous final frame: "${prevEndsWith}"` : ""}${prevAction ? `, previous action: "${prevAction}"` : ""}. Continue the same motion/pose seamlessly into this scene's action.] `
      : "";
    const nextHint = nextScene
      ? `[Setup for next: Frame the ending so it can flow into "${nextObjective}".] `
      : "";

    let basePrompt = customPrompt?.trim() ? customPrompt.trim() : scene.prompt;

    // ─── AI bridging for user "Custom prompt..." — wrap user text with adjacent-scene context ───
    if (customPrompt?.trim()) {
      try {
        const bridged = await invokeEdgeFunction<{ type: string; editedPrompt?: string }>(
          "edit-video-prompt",
          {
            originalPrompt: scene.prompt,
            editAction: "custom",
            editDetail: customPrompt.trim(),
            previousSceneSummary: prevEndsWith || prevAction,
            nextSceneSummary: nextObjective,
          },
          { timeoutMs: 30000 },
        );
        if (bridged?.editedPrompt && bridged.editedPrompt.trim().length > 0) {
          basePrompt = bridged.editedPrompt.trim();
        }
      } catch {
        // Fallback: use raw custom prompt if bridging fails
      }
    }

    const motionPrompt = continuityPrefix + narrativeBridge + nextHint + basePrompt + " Shape this into a post-ready ad shot with premium after-effects-style transitions, polished pacing, and a strong intro/outro rhythm. Cinematic camera movement with dynamic subject motion throughout the scene. Avoid static shots.";

    // Determine reference image with same priority as initial pipeline
    const lastVisualIdx = s.storyboard.reduce((acc, sc, idx) => {
      const seg = s.segments.find(sg => sg.id === sc.segmentId);
      return (sc.generationMode !== "static-card" && seg?.type !== "closing") ? idx : acc;
    }, 0);
    const isFirstScene = sceneIdx === 0;
    const isLastVisualScene = sceneIdx === lastVisualIdx;

    let referenceImage: string | undefined;
    if (isFirstScene && introImageUrl) referenceImage = introImageUrl;
    else if (isLastVisualScene && outroImageUrl) referenceImage = outroImageUrl;
    else if (characterImageUrl) referenceImage = characterImageUrl;

    const chosenProvider = s.videoProvider || "wan";
    const isI2V = !!referenceImage;
    const chosenModel = s.videoModel || (isI2V ? "wan2.6-i2v" : "wan2.6-t2v");

    const usingCharacter = !!characterImageUrl && referenceImage === characterImageUrl;
    const characterLockHeader = `[CHARACTER LOCK: The person in the reference image is the EXACT spokesperson — preserve their face, skin tone, hair, age, ethnicity, and clothing identically. Do NOT generate a different person, do NOT alter their identity.]\n`;
    const finalPrompt = usingCharacter
      ? `${characterLockHeader}${motionPrompt}` +
        (characterPrompt && characterPrompt.trim()
          ? `\n\nCharacter direction (actions only — keep face and look unchanged): ${characterPrompt.trim()}`
          : "")
      : motionPrompt;

    const baseNegative = "static image, zoom only, no motion, blurry, text, words, letters, titles, subtitles, captions, watermark, typography, written content, overlay text, any text of any kind";
    const negativePrompt = (isI2V && characterImageUrl)
      ? `${baseNegative}, different person, different face, identity change, face swap, wrong ethnicity, wrong age, generic stock person, replaced subject, altered facial features`
      : baseNegative;

    // Mark scene as generating, clear final video (stitched output is now stale)
    this.running = true;
    this.update({
      statusText: "Regenerating scene...",
      progressValue: 10,
      finalVideoUrl: null,
      clips: this.state.clips.map(c => c.sceneId === sceneId
        ? { ...c, status: "generating" as const, progress: 10, error: null, videoUrl: null }
        : c),
    });

    try {
      const result = await invokeEdgeFunction<{
        url?: string; videoUrl?: string; generationId?: string; jobId?: string;
        provider?: "wan" | "veo" | "sora"; mode?: string; imageUrls?: string[];
      }>("generate-video", {
        action: "generate", prompt: finalPrompt, duration: sceneDuration,
        aspectRatio: wanRatio, provider: chosenProvider, model: chosenModel,
        ...(isI2V ? { imageUrl: referenceImage } : {}),
        negativePrompt,
      }, { timeoutMs: EDGE_TIMEOUT_MS });

      const videoUrl = result.url || result.videoUrl;
      const genId = result.jobId || result.generationId;
      const provider = result.provider || "wan";

      if (result.mode === "slideshow" && result.imageUrls?.length) {
        try {
          const slideshowBlobUrl = await slideshowToVideo({ imageUrls: result.imageUrls!, durationPerImage: 4, width: 1280, height: 720 });
          this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "completed" as const, videoUrl: slideshowBlobUrl, progress: 100 } : c));
        } catch {
          this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "completed" as const, videoUrl: result.imageUrls![0], progress: 100 } : c));
        }
      } else if (videoUrl) {
        this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "completed" as const, videoUrl, progress: 100, generationId: genId } : c));
      } else if (genId) {
        this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "generating" as const, generationId: genId, progress: 30 } : c));
        await this.pollGeneration(sceneId, genId, provider);
      } else {
        this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: "No video URL or job ID returned", progress: 0 } : c));
      }
    } catch (error) {
      const msg = getErrorMessage(error, "Scene regeneration failed");
      this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: msg, progress: 0 } : c));
      toast.error("Scene regeneration failed", { description: msg });
    } finally {
      this.running = false;
      this.update({ statusText: "", progressValue: 100 });
    }
  }

  // ─── Proxy Veo authenticated video → Supabase Storage URL ──
  // Veo's Gemini Files URL requires x-goog-api-key header, which a plain
  // <video src=...> cannot send. Ask the edge function to download it
  // server-side with auth and re-upload to public Storage.
  private async proxyAuthenticatedVideo(
    provider: "wan" | "veo" | "sora",
    jobId: string,
    remoteUrl: string,
  ): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: "download",
          provider,
          videoUrl: remoteUrl,
          jobId,
          persist: true, // ask edge function to upload to Storage and return JSON { url }
        }),
      });

      if (!resp.ok) {
        console.warn("[bgService] proxyAuthenticatedVideo non-OK:", resp.status);
        return null;
      }

      const ctype = resp.headers.get("Content-Type") || "";
      if (ctype.includes("application/json")) {
        const data = await resp.json();
        if (data?.url) return data.url as string;
        if (data?.error) console.warn("[bgService] proxy error:", data.error);
        return null;
      }

      // Fallback: binary blob — create object URL (session-only, but stitch
      // happens inside this session so that's acceptable).
      const blob = await resp.blob();
      if (blob.size === 0) return null;
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("[bgService] proxyAuthenticatedVideo failed:", e);
      return null;
    }
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
        const result = await invokeEdgeFunction<{
          status?: string;
          videoUrl?: string;
          url?: string;
          needsAuth?: boolean;
          needsGeminiAuth?: boolean;
        }>(
          "generate-video", { action: "poll", jobId: generationId, provider }
        );
        consecutiveErrors = 0;
        if (result.status === "completed" || result.videoUrl || result.url) {
          let videoUrl = result.videoUrl || result.url;
          if (!videoUrl) {
            this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: "No video URL", progress: 0 } : c));
            return;
          }

          // Veo (and any provider flagged needsAuth) URLs require API-key
          // headers the browser can't send. Proxy through edge function to
          // get a plain public Supabase Storage URL.
          const needsProxy = result.needsAuth || result.needsGeminiAuth;
          if (needsProxy) {
            const proxied = await this.proxyAuthenticatedVideo(provider, generationId, videoUrl);
            if (proxied) {
              videoUrl = proxied;
            } else {
              console.warn("[bgService] Proxy failed for scene", sceneId, "— falling back to raw URL (likely unplayable)");
            }
          }

          const finalUrl = videoUrl;
          this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "completed" as const, videoUrl: finalUrl, progress: 100 } : c));
          return;
        }
        if (result.status === "failed") {
          this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: "Generation failed", progress: 0 } : c));
          return;
        }
        this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, progress: Math.min(90, 30 + (i / maxAttempts) * 60) } : c));
      } catch (error) {
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: getErrorMessage(error, "Polling failed"), progress: 0 } : c));
          return;
        }
      }
    }
    this.updateClips(clips => clips.map(c => c.sceneId === sceneId ? { ...c, status: "failed" as const, error: "Timed out", progress: 0 } : c));
  }

  // ─── Export (internal) ──────────────────────────
  private async handleExportInternal(sb: StoryboardScene[], segs: ScriptSegment[], brand: BrandProfile) {
    this.update({ exporting: true });

    // Request a Wake Lock so MediaRecorder + rAF in stitchClips don't get
    // throttled when the user navigates away from /ad-director.
    let wakeLock: { release: () => Promise<void> } | null = null;
    try {
      const nav = navigator as unknown as {
        wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
      };
      if (nav.wakeLock?.request) {
        wakeLock = await nav.wakeLock.request("screen");
        console.log("[bgService] Wake Lock acquired for stitching");
      }
    } catch (e) {
      console.warn("[bgService] Wake Lock request failed (non-blocking):", e);
    }

    if (typeof document !== "undefined" && document.hidden) {
      console.warn("[bgService] Document is hidden — stitching may be throttled by the browser.");
    }

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

      const transitionPreset = (typeof window !== "undefined" && localStorage.getItem("ad-director:transition-preset")) || "Crossfade";
      const transitionDuration = (() => {
        if (typeof window === "undefined") return 0.5;
        const v = parseFloat(localStorage.getItem("ad-director:transition-duration") || "0.5");
        return isNaN(v) ? 0.5 : v;
      })();
      const crossfadeDuration = transitionPreset === "None" ? 0 : transitionDuration;

      const stateRatio = this.state.videoParams?.ratio;
      const exportRatio = (stateRatio === "9:16" || stateRatio === "1:1" || stateRatio === "16:9")
        ? stateRatio as "9:16" | "1:1" | "16:9"
        : undefined;

      const finalUrl = await stitchClips(orderedClips, {
        logo: { url: "", enabled: false, size: 80 },
        endCard: {
          enabled: true, brandName: brand.name, tagline: brand.tagline,
          website: brand.website, primaryColor: brand.primaryColor,
          bgColor: brand.secondaryColor, logoUrl: null,
        },
        subtitles: { enabled: false, segments: [] },
        // HARD RULE: AI Video Director exports must never contain music. Pro Editor manual music is the only exception.
        musicUrl: undefined,
        musicVolume: 0,
        crossfadeDuration,
        aspectRatio: exportRatio,
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
    } catch (error) {
      console.warn("Export failed:", error);
    } finally {
      this.update({ exporting: false });
      if (wakeLock) {
        try { await wakeLock.release(); } catch { /* noop */ }
      }
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
