import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Video, Loader2, Sparkles, Download, RotateCcw, CheckCircle2, Library, Save,
  Music, Volume2, Wand2, Eye, Image as ImageIcon,
  Film, Clapperboard, Pencil, Share2, Search
} from "lucide-react";
import { VideoEditor } from "./VideoEditor";
import { VideoToSocialPanel } from "./VideoToSocialPanel";
import { VideoStudioPromptBar, VIDEO_MODELS } from "./VideoStudioPromptBar";
import { useVideoCredits } from "@/hooks/useVideoCredits";
import { useGenerations } from "@/hooks/useGenerations";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { slideshowToVideo } from "@/lib/slideshowToVideo";
import { supabase } from "@/integrations/supabase/client";
import { VideoLibrary } from "./VideoLibrary";
import { VideoInsightsPanel, type VideoAnalysisResults } from "./VideoInsightsPanel";
import { useBrandKit } from "@/hooks/useBrandKit";
import { usePromptTransformer } from "@/hooks/usePromptTransformer";
import { applyLogoWatermark } from "@/lib/videoWatermark";
import { mergeVideoAudio } from "@/lib/videoAudioMerge";
import { Input } from "@/components/ui/input";
import { Zap, Crown } from "lucide-react";

type Status = "idle" | "transforming" | "submitting" | "processing" | "completed" | "failed";
type GenerationMode = "fast" | "balanced" | "premium";

interface ModeConfig {
  id: GenerationMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  provider: "sora" | "veo" | "wan";
  model: string;
  maxClipDuration: number;
  durationOptions: { value: string; label: string }[];
  badge: string;
}

const modeConfigs: ModeConfig[] = [
  {
    id: "fast", label: "Fast", description: "Quick iterations for social content",
    icon: <Zap className="w-4 h-4" />, provider: "sora", model: "sora-2",
    maxClipDuration: 12, badge: "~2 min",
    durationOptions: [{ value: "4", label: "4s" }, { value: "8", label: "8s" }, { value: "12", label: "12s" }, { value: "30", label: "30s" }, { value: "60", label: "60s" }],
  },
  {
    id: "balanced", label: "Balanced", description: "High-quality cinematic video with audio",
    icon: <Film className="w-4 h-4" />, provider: "wan", model: "wan2.6-t2v",
    maxClipDuration: 15, badge: "~3 min",
    durationOptions: [{ value: "5", label: "5s" }, { value: "10", label: "10s" }, { value: "15", label: "15s" }, { value: "30", label: "30s" }, { value: "60", label: "60s" }],
  },
  {
    id: "premium", label: "Premium", description: "Highest fidelity production quality",
    icon: <Crown className="w-4 h-4" />, provider: "sora", model: "sora-2-pro",
    maxClipDuration: 12, badge: "~5 min",
    durationOptions: [{ value: "4", label: "4s" }, { value: "8", label: "8s" }, { value: "12", label: "12s" }, { value: "30", label: "30s" }, { value: "60", label: "60s" }],
  },
];

const MAX_POLL_COUNT = 120;

interface VideoStudioContentProps {
  fullPage?: boolean;
  onVideoReady?: (videoUrl: string) => void;
}

type MediaType = "video" | "image" | "audio";

export function VideoStudioContent({ fullPage = false, onVideoReady }: VideoStudioContentProps) {
  const { brandKit } = useBrandKit();
  const { toast } = useToast();
  const { transform, isTransforming, transformResult, transformError, reset: resetTransform } = usePromptTransformer();
  const { remaining, total, usedPercent, totalSpent, plan, canGenerate, getCost, consumeCredits, refundCredits } = useVideoCredits();
  const { createGeneration, updateGeneration } = useGenerations();
  const [showSocialPanel, setShowSocialPanel] = useState(false);
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);

  // Form state
  const [rawPrompt, setRawPrompt] = useState("");
  const [mode, setMode] = useState<GenerationMode>("balanced");
  const [duration, setDuration] = useState("8");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [showEngineered, setShowEngineered] = useState(false);
  const [activeTab, setActiveTab] = useState("generate");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>("video");
  const [selectedModel, setSelectedModel] = useState("gpt-image-1");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [customAudioFile, setCustomAudioFile] = useState<File | null>(null);
  const [customAudioStorageUrl, setCustomAudioStorageUrl] = useState<string | null>(null);
  const [firstFrameImage, setFirstFrameImage] = useState<string | null>(null);
  const [lastFrameImage, setLastFrameImage] = useState<string | null>(null);

  // Image generation state
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageGenerating, setImageGenerating] = useState(false);

  // Standalone audio generation state (for audio mode)
  const [standaloneAudioUrl, setStandaloneAudioUrl] = useState<string | null>(null);
  const [standaloneAudioGenerating, setStandaloneAudioGenerating] = useState(false);

  // Generation state
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [sceneUrls, setSceneUrls] = useState<string[]>([]);
  const [currentScene, setCurrentScene] = useState(0);
  const [watermarking, setWatermarking] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSecs, setElapsedSecs] = useState(0);

  // Audio state
  const [audioPrompt, setAudioPrompt] = useState("");
  const [audioType, setAudioType] = useState<"music" | "sfx">("music");
  const [audioDuration, setAudioDuration] = useState("30");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [merging, setMerging] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);

  // Video analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<VideoAnalysisResults | null>(null);
  const [moderationStatus, setModerationStatus] = useState<"safe" | "flagged">("safe");
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [showInsights, setShowInsights] = useState(false);

  // Refs
  const jobRef = useRef<{ id: string; provider: string } | null>(null);
  const multiJobsRef = useRef<{ id: string; provider: string; sceneIndex: number }[] | null>(null);
  const isMultiRef = useRef(false);
  const uploadedSceneUrlsRef = useRef<Record<number, string>>({});
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const progressTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentMode = modeConfigs.find(m => m.id === mode) || modeConfigs[1];

  // Derive effective provider from selected video model (override mode's default)
  const effectiveVideoProvider = useMemo((): "sora" | "veo" | "wan" => {
    if (mediaType !== "video") return currentMode.provider;
    const vm = VIDEO_MODELS.find((m: { id: string; provider: string }) => m.id === selectedModel);
    return (vm?.provider as "sora" | "veo" | "wan") || currentMode.provider;
  }, [selectedModel, mediaType, currentMode.provider]);

  const effectiveMaxClip = effectiveVideoProvider === "wan" ? 15 : currentMode.maxClipDuration;
  const isI2vModel = selectedModel === "wan-2.6-i2v" || selectedModel === "wan-2.6-i2v-flash";

  const cleanup = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    if (progressTickRef.current) clearInterval(progressTickRef.current);
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    pollTimerRef.current = null;
    progressTickRef.current = null;
    blobUrlRef.current = null;
    startedAtRef.current = null;
  }, []);

  useEffect(() => {
    if (status === "processing" || status === "submitting") {
      if (!startedAtRef.current) startedAtRef.current = Date.now();
      setElapsedSecs(0);
      progressTickRef.current = setInterval(() => {
        if (startedAtRef.current) {
          setElapsedSecs(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }
      }, 1000);
      return () => { if (progressTickRef.current) clearInterval(progressTickRef.current); };
    }
  }, [status]);

  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    if (status === "failed" && currentGenerationId) {
      const durationSecs = parseInt(duration);
      const creditCost = getCost(durationSecs, mode);
      refundCredits.mutateAsync({ cost: creditCost, generationId: currentGenerationId }).catch(console.error);
      updateGeneration.mutateAsync({ id: currentGenerationId, status: "failed", error_message: error || "Generation failed" }).catch(console.error);
    }
    if (status === "completed" && currentGenerationId && videoUrl) {
      updateGeneration.mutateAsync({
        id: currentGenerationId, status: "completed",
        output_asset_url: videoUrl, actual_credits: getCost(parseInt(duration), mode),
      }).catch(console.error);
    }
  }, [status]);

  useEffect(() => {
    if (status === "completed" && rawPrompt && !audioPrompt) {
      setAudioPrompt(`Background music for: ${rawPrompt.slice(0, 100)}`);
    }
  }, [status, rawPrompt]);

  // Proxy download
  const proxyDownload = async (provider: string, jobId: string, remoteVideoUrl?: string): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;
    try {
      const dlResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: "download", provider,
          ...(provider === "veo" ? { videoUrl: remoteVideoUrl } : { jobId }),
        }),
      });
      if (dlResp.ok) {
        const blob = await dlResp.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        return blobUrl;
      }
    } catch (e) { console.error("Proxy download failed:", e); }
    return null;
  };

  // Multi-scene polling
  const pollMultiScene = useCallback(async () => {
    if (!multiJobsRef.current) return;
    pollCountRef.current += 1;
    if (pollCountRef.current > MAX_POLL_COUNT) { setError("Multi-scene generation timed out."); setStatus("failed"); return; }
    try {
      const existingUrls: Record<string, string> = {};
      for (const [k, v] of Object.entries(uploadedSceneUrlsRef.current)) existingUrls[String(k)] = v;
      const data = await invokeEdgeFunction("generate-video", {
        action: "poll-multi", jobIds: multiJobsRef.current, existingSceneUrls: existingUrls,
      });
      if (data.uploadedSceneUrls) {
        for (const [k, v] of Object.entries(data.uploadedSceneUrls)) uploadedSceneUrlsRef.current[Number(k)] = v as string;
      }
      if (data.status === "completed") {
        setProgress(100); setProgressLabel("All scenes complete!");
        const urls: string[] = data.sceneUrls || (data.videoUrl ? [data.videoUrl] : []);
        setSceneUrls(urls); setCurrentScene(0); setSavedToLibrary(!!data.savedToLibrary);
        const firstUrl = urls[0];
        if (firstUrl && brandKit?.logo_url) {
          setWatermarking(true); setProgressLabel("Applying logo watermark...");
          try { const watermarked = await applyLogoWatermark(firstUrl, brandKit.logo_url, 80); setVideoUrl(watermarked); } catch { setVideoUrl(firstUrl); }
          setWatermarking(false);
        } else { setVideoUrl(firstUrl || null); }
        setStatus("completed"); return;
      }
      if (data.status === "failed") { setError(data.error || "Multi-scene generation failed."); setStatus("failed"); return; }
      const completed = data.completedScenes || 0;
      const uploaded = data.uploadedScenes || 0;
      const totalScenes = data.totalScenes || multiJobsRef.current.length;
      setProgress(data.progress || Math.round((uploaded / totalScenes) * 100));
      setProgressLabel(`Scene ${completed}/${totalScenes} generated, ${uploaded} uploaded`);
      pollTimerRef.current = setTimeout(pollMultiScene, 3000);
    } catch (err: any) { setError(err?.message || "Failed to check multi-scene status."); setStatus("failed"); }
  }, [brandKit]);

  // Single clip polling
  const pollForResult = useCallback(async () => {
    if (!jobRef.current) return;
    pollCountRef.current += 1;
    if (pollCountRef.current > MAX_POLL_COUNT) { setError("Video generation timed out."); setStatus("failed"); return; }
    try {
      const data = await invokeEdgeFunction("generate-video", {
        action: "poll", provider: jobRef.current.provider, jobId: jobRef.current.id,
      });
      if (data.status === "completed") {
        setProgress(100);
        const needsProxy = data.needsAuth || data.needsGeminiAuth;
        let finalUrl: string | null = null;
        if (needsProxy) finalUrl = await proxyDownload(jobRef.current.provider, jobRef.current.id, data.videoUrl) || data.videoUrl;
        else finalUrl = data.videoUrl;
        if (!finalUrl) { setError("Video generated but no URL returned."); setStatus("failed"); return; }
        if (brandKit?.logo_url) {
          setWatermarking(true);
          try { const watermarked = await applyLogoWatermark(finalUrl, brandKit.logo_url, 80); setVideoUrl(watermarked); } catch { setVideoUrl(finalUrl); }
          setWatermarking(false);
        } else { setVideoUrl(finalUrl); }
        setSceneUrls([finalUrl]); setStatus("completed"); return;
      }
      if (data.status === "failed") { setError(data.error || "Video generation failed."); setStatus("failed"); return; }
      if (data.progress != null) setProgress(data.progress);
      else setProgress(prev => Math.min(prev + 3, 90));
      pollTimerRef.current = setTimeout(pollForResult, 5000);
    } catch (err: any) { setError(err?.message || "Failed to check video status."); setStatus("failed"); }
  }, [brandKit]);

  // Image generation handler
  const handleGenerateImage = async () => {
    if (!rawPrompt.trim()) return;
    setImageGenerating(true); setGeneratedImageUrl(null); setError(null);
    try {
      const sizeMap: Record<string, string> = { "16:9": "1792x1024", "9:16": "1024x1792", "1:1": "1024x1024" };
      const size = sizeMap[aspectRatio] || "1024x1024";
      const brandContext = brandKit ? { business_name: brandKit.business_name, description: brandKit.description, value_prop: brandKit.value_prop, tagline: (brandKit as any).tagline || "" } : undefined;
      const logoUrl = brandKit?.logo_url || undefined;
      const data = await invokeEdgeFunction("generate-image", { prompt: rawPrompt.trim(), size, quality: "high", model: selectedModel, brandContext, logoUrl, aspectRatio });
      if (data?.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
        toast({ title: "Image ready!", description: data.revisedPrompt ? "Prompt was refined by AI" : "Image generated successfully" });
      } else { throw new Error("No image URL returned"); }
    } catch (err: any) { setError(err?.message || "Image generation failed"); toast({ title: "Image generation failed", description: err.message, variant: "destructive" }); }
    finally { setImageGenerating(false); }
  };

  // Standalone audio generation handler (for audio mode)
  const handleGenerateStandaloneAudio = async () => {
    if (!rawPrompt.trim()) return;
    setStandaloneAudioGenerating(true); setStandaloneAudioUrl(null); setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ prompt: rawPrompt.trim(), duration: parseInt(duration), type: audioType }),
      });
      if (!response.ok) { const errData = await response.json().catch(() => null); throw new Error(errData?.error || `Audio generation failed (${response.status})`); }
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setStandaloneAudioUrl(url);
      toast({ title: "Audio ready!", description: `${audioType === "music" ? "Music" : "Sound effect"} generated` });
    } catch (err: any) { setError(err?.message || "Audio generation failed"); toast({ title: "Audio generation failed", description: err.message, variant: "destructive" }); }
    finally { setStandaloneAudioGenerating(false); }
  };

  // Main generate handler — routes by mediaType
  const handleGenerate = async () => {
    if (!rawPrompt.trim()) return;

    if (mediaType === "image") { handleGenerateImage(); return; }
    if (mediaType === "audio") { handleGenerateStandaloneAudio(); return; }

    // I2V requires a reference image
    if (isI2vModel && !referenceImage) {
      toast({ title: "Reference image required", description: "Wan I2V models need a reference image to animate.", variant: "destructive" });
      return;
    }

    // Video generation (existing flow)
    const durationSecs = parseInt(duration);
    const creditCost = getCost(durationSecs, mode);
    const isWanProvider = effectiveVideoProvider === "wan";

    // Wan is billed externally — skip internal credit check
    if (!isWanProvider && !canGenerate(durationSecs, mode)) {
      toast({ title: "Not enough credits", description: `Need ${creditCost}s credits, have ${remaining}s remaining.`, variant: "destructive" });
      return;
    }
    setStatus("transforming"); setProgress(0); setProgressLabel("Engineering cinematic prompt...");
    setError(null); setVideoUrl(null); setSavedToLibrary(false); setAudioUrl(null);
    uploadedSceneUrlsRef.current = {}; pollCountRef.current = 0;

    const result = await transform(rawPrompt, aspectRatio, parseInt(duration));
    if (!result) console.warn("Prompt transform failed, using raw prompt");
    const finalPrompt = result?.engineeredPrompt || rawPrompt.trim();

    let genRecord: any = null;
    try {
      genRecord = await createGeneration.mutateAsync({
        raw_prompt: rawPrompt.trim(), engineered_prompt: finalPrompt,
        intent: result?.intent, mode, duration_seconds: durationSecs,
        aspect_ratio: aspectRatio, provider: effectiveVideoProvider,
        estimated_credits: isWanProvider ? 0 : creditCost,
        metadata: { elements: result?.elements, platform_intent: result?.platform_intent },
      });
      setCurrentGenerationId(genRecord.id);
    } catch (err) { console.error("Failed to create generation record:", err); }

    // Skip credit consumption for Wan (billed externally via DashScope)
    if (!isWanProvider) {
      try {
        await consumeCredits.mutateAsync({ durationSeconds: durationSecs, mode, generationId: genRecord?.id });
      } catch (err: any) {
        toast({ title: "Credit error", description: err.message, variant: "destructive" });
        if (genRecord) updateGeneration.mutateAsync({ id: genRecord.id, status: "failed", error_message: err.message });
        setStatus("idle"); return;
      }
    }

    setStatus("submitting"); setProgress(0); setProgressLabel("");
    const requestedDuration = parseInt(duration);
    const isMultiScene = requestedDuration > effectiveMaxClip;
    isMultiRef.current = isMultiScene;

    // Upload reference image to storage if present (for I2V)
    let refImageStorageUrl: string | undefined;
    if (referenceImage && isI2vModel) {
      try {
        setProgressLabel("Uploading reference image...");
        const resp = await fetch(referenceImage);
        const blob = await resp.blob();
        const { data: { user } } = await supabase.auth.getUser();
        const fileName = `ref-images/${user?.id}/${crypto.randomUUID()}.${blob.type.includes("png") ? "png" : "jpg"}`;
        const { error: upErr } = await supabase.storage.from("social-media-assets").upload(fileName, blob, { contentType: blob.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pubData } = supabase.storage.from("social-media-assets").getPublicUrl(fileName);
        refImageStorageUrl = pubData.publicUrl;
      } catch (err: any) {
        console.error("Ref image upload failed:", err);
        toast({ title: "Image upload failed", description: err.message, variant: "destructive" });
        setStatus("idle"); return;
      }
    }

    // Upload custom audio file to storage if present (for Wan audio sync)
    let audioStorageUrl: string | undefined;
    if (customAudioFile && effectiveVideoProvider === "wan") {
      try {
        setProgressLabel("Uploading audio file...");
        const { data: { user } } = await supabase.auth.getUser();
        const ext = customAudioFile.name.split(".").pop() || "mp3";
        const fileName = `audio-sync/${user?.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("social-media-assets").upload(fileName, customAudioFile, { contentType: customAudioFile.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pubData } = supabase.storage.from("social-media-assets").getPublicUrl(fileName);
        audioStorageUrl = pubData.publicUrl;
      } catch (err: any) {
        console.error("Audio file upload failed:", err);
        toast({ title: "Audio upload failed", description: err.message, variant: "destructive" });
        setStatus("idle"); return;
      }
    }

    // Build extra params for Wan models
    const wanExtras: Record<string, unknown> = {};
    if (refImageStorageUrl) wanExtras.imageUrl = refImageStorageUrl;
    if (audioStorageUrl) wanExtras.audioUrl = audioStorageUrl;
    if (negativePrompt.trim()) wanExtras.negativePrompt = negativePrompt.trim();
    wanExtras.aspectRatio = "16:9";

    // Upload first/last frame images for Veo I2V and convert to base64
    let firstFrameBase64: string | undefined;
    let firstFrameMimeType: string | undefined;
    let lastFrameBase64: string | undefined;
    let lastFrameMimeType: string | undefined;

    if (effectiveVideoProvider === "veo" && (firstFrameImage || lastFrameImage)) {
      try {
        setProgressLabel("Uploading frame images...");
        if (firstFrameImage) {
          const resp = await fetch(firstFrameImage);
          const blob = await resp.blob();
          firstFrameMimeType = blob.type || "image/jpeg";
          const arrayBuf = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          firstFrameBase64 = btoa(binary);
        }
        if (lastFrameImage) {
          const resp = await fetch(lastFrameImage);
          const blob = await resp.blob();
          lastFrameMimeType = blob.type || "image/jpeg";
          const arrayBuf = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          lastFrameBase64 = btoa(binary);
        }
      } catch (err: any) {
        console.error("Frame image processing failed:", err);
        toast({ title: "Frame image error", description: err.message, variant: "destructive" });
        setStatus("idle"); return;
      }
    }

    // For Wan I2V, use firstFrameImage as reference image
    if (effectiveVideoProvider === "wan" && isI2vModel && firstFrameImage && !refImageStorageUrl) {
      try {
        setProgressLabel("Uploading first frame as reference...");
        const resp = await fetch(firstFrameImage);
        const blob = await resp.blob();
        const { data: { user } } = await supabase.auth.getUser();
        const fileName = `ref-images/${user?.id}/${crypto.randomUUID()}.${blob.type.includes("png") ? "png" : "jpg"}`;
        const { error: upErr } = await supabase.storage.from("social-media-assets").upload(fileName, blob, { contentType: blob.type, upsert: false });
        if (upErr) throw upErr;
        const { data: pubData } = supabase.storage.from("social-media-assets").getPublicUrl(fileName);
        wanExtras.imageUrl = pubData.publicUrl;
      } catch (err: any) {
        console.error("First frame upload for Wan failed:", err);
      }
    }

    // Add Veo frame parameters
    const veoFrameExtras: Record<string, unknown> = {};
    if (firstFrameBase64) {
      veoFrameExtras.firstFrameBase64 = firstFrameBase64;
      veoFrameExtras.firstFrameMimeType = firstFrameMimeType;
    }
    if (lastFrameBase64) {
      veoFrameExtras.lastFrameBase64 = lastFrameBase64;
      veoFrameExtras.lastFrameMimeType = lastFrameMimeType;
    }

    try {
      if (isMultiScene) {
        const sceneCount = Math.ceil(requestedDuration / effectiveMaxClip);
        setProgressLabel(`Generating ${sceneCount} scenes...`);
        const data = await invokeEdgeFunction("generate-video", {
          action: "generate-multi", provider: effectiveVideoProvider, prompt: finalPrompt,
          duration: requestedDuration,
          model: selectedModel,
          ...wanExtras,
          ...veoFrameExtras,
        });
        if (data?.status === "failed") { setError(data.error || "Failed to start generation."); setStatus("failed"); return; }
        if (data?.mode === "slideshow" && Array.isArray(data.imageUrls)) {
          setProgressLabel("Compiling motion slideshow..."); setProgress(50);
          try {
            const blobUrl = await slideshowToVideo({ imageUrls: data.imageUrls, durationPerImage: data.clipDuration || 5, onProgress: (pct) => setProgress(50 + Math.round(pct * 0.5)) });
            setVideoUrl(blobUrl); setSceneUrls([blobUrl]); setStatus("completed");
            toast({ title: "🎬 Motion Slideshow", description: data.message });
          } catch (compileErr: any) { setError(`Slideshow failed: ${compileErr.message}`); setStatus("failed"); }
          return;
        }
        if (!Array.isArray(data?.jobs) || data.jobs.length === 0) { setError("No generation jobs were created."); setStatus("failed"); return; }
        multiJobsRef.current = data.jobs;
        setStatus("processing"); setProgress(5);
        setProgressLabel(`Generating ${data.totalScenes} scenes (${data.clipDuration}s each)...`);
        pollTimerRef.current = setTimeout(pollMultiScene, 5000);
      } else {
        const data = await invokeEdgeFunction("generate-video", {
          action: "generate", provider: effectiveVideoProvider, prompt: finalPrompt,
          duration: requestedDuration,
          model: selectedModel,
          ...wanExtras,
          ...veoFrameExtras,
        });
        if (data?.status === "failed") { setError(data.error || "Failed to start generation."); setStatus("failed"); return; }
        if (data?.mode === "slideshow" && Array.isArray(data.imageUrls)) {
          setProgressLabel("Compiling motion slideshow..."); setProgress(50);
          try {
            const blobUrl = await slideshowToVideo({ imageUrls: data.imageUrls, durationPerImage: data.clipDuration || 5, onProgress: (pct) => setProgress(50 + Math.round(pct * 0.5)) });
            setVideoUrl(blobUrl); setSceneUrls([blobUrl]); setStatus("completed");
            toast({ title: "🎬 Motion Slideshow", description: data.message });
          } catch (compileErr: any) { setError(`Slideshow failed: ${compileErr.message}`); setStatus("failed"); }
          return;
        }
        if (!data?.jobId || !data?.provider) { setError("No generation job was returned."); setStatus("failed"); return; }
        jobRef.current = { id: data.jobId, provider: data.provider };
        setStatus("processing"); setProgress(5); setProgressLabel("Generating video...");
        pollTimerRef.current = setTimeout(pollForResult, 5000);
      }
    } catch (err: any) { setError(err?.message || "Failed to start video generation."); setStatus("failed"); }
  };

  const handleReset = () => {
    cleanup(); resetTransform();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setStatus("idle"); setProgress(0); setProgressLabel(""); setVideoUrl(null);
    setSceneUrls([]); setCurrentScene(0); setWatermarking(false); setSavedToLibrary(false);
    setError(null); setAudioUrl(null); setShowEditor(false); setShowSocialPanel(false);
    setAudioPrompt(""); setAudioGenerating(false); setAudioPlaying(false); setMerging(false);
    jobRef.current = null; multiJobsRef.current = null; isMultiRef.current = false;
    uploadedSceneUrlsRef.current = {}; pollCountRef.current = 0; setElapsedSecs(0);
    setGeneratedImageUrl(null); setImageGenerating(false);
    setStandaloneAudioUrl(null); setStandaloneAudioGenerating(false);
    setAnalysisResults(null); setShowInsights(false); setAnalyzing(false);
    setSuggestedHashtags([]); setModerationStatus("safe");
    setNegativePrompt(""); setCustomAudioFile(null); setCustomAudioStorageUrl(null);
    setFirstFrameImage(null); setLastFrameImage(null);
  };

  const handleAnalyzeVideo = async () => {
    if (!videoUrl || analyzing) return;
    setAnalyzing(true);
    try {
      const submitData = await invokeEdgeFunction<{ operationName: string; done: boolean }>("video-intelligence", {
        action: "annotate", videoUrl,
      });
      if (submitData.done) {
        // Unlikely but handle inline results
        setShowInsights(true); setAnalyzing(false); return;
      }
      // Poll for results
      const opName = submitData.operationName;
      let attempts = 0;
      const poll = async () => {
        attempts++;
        if (attempts > 60) { toast({ title: "Analysis timeout", variant: "destructive" }); setAnalyzing(false); return; }
        const pollData = await invokeEdgeFunction<any>("video-intelligence", { action: "poll", operationName: opName });
        if (pollData.done) {
          if (pollData.results) {
            setAnalysisResults(pollData.results);
            setModerationStatus(pollData.moderationStatus || "safe");
            setSuggestedHashtags(pollData.suggestedHashtags || []);
          }
          setShowInsights(true); setAnalyzing(false);
        } else {
          setTimeout(poll, 5000);
        }
      };
      setTimeout(poll, 5000);
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err?.message || "Unknown error", variant: "destructive" });
      setAnalyzing(false);
    }
  };

  const handleSaveToLibrary = async () => {
    if (!videoUrl || savedToLibrary) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const resp = await fetch(videoUrl);
      const blob = await resp.blob();
      const fileName = `${user.id}/${crypto.randomUUID()}.mp4`;
      const { error } = await supabase.storage.from("generated-videos").upload(fileName, blob, { contentType: "video/mp4", upsert: false });
      if (error) throw error;
      setSavedToLibrary(true);
      toast({ title: "Saved!", description: "Video saved to your library" });
    } catch (err: any) { toast({ title: "Save failed", description: err.message, variant: "destructive" }); }
  };

  const handleUseVideo = async () => {
    if (!videoUrl || !onVideoReady) return;

    // blob: and data: URLs can be fetched client-side fine
    if (videoUrl.startsWith("blob:") || videoUrl.startsWith("data:")) {
      onVideoReady(videoUrl);
      return;
    }

    // Remote URL — proxy download to avoid CORS
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ action: "download", provider: "veo", videoUrl }),
      });

      if (!resp.ok) throw new Error("Proxy download failed");
      const blob = await resp.blob();
      onVideoReady(URL.createObjectURL(blob));
    } catch (err) {
      console.error("Use in post proxy failed, trying direct:", err);
      onVideoReady(videoUrl);
    }
  };

  // Audio handlers
  const handleGenerateAudio = async () => {
    if (!audioPrompt.trim()) return;
    setAudioGenerating(true); setAudioUrl(null);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ prompt: audioPrompt, duration: parseInt(audioDuration), type: audioType }),
      });
      if (!response.ok) { const errData = await response.json().catch(() => null); throw new Error(errData?.error || `Audio generation failed (${response.status})`); }
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      toast({ title: "Audio ready!", description: `${audioType === "music" ? "Music" : "SFX"} generated` });
    } catch (err: any) { toast({ title: "Audio generation failed", description: err.message, variant: "destructive" }); }
    finally { setAudioGenerating(false); }
  };

  const toggleAudioPlayback = () => {
    if (!audioUrl) return;
    if (audioPlaying && audioRef.current) { audioRef.current.pause(); setAudioPlaying(false); }
    else {
      const audio = new Audio(audioUrl);
      audio.onended = () => setAudioPlaying(false);
      audio.play(); audioRef.current = audio; setAudioPlaying(true);
    }
  };

  const handleMergeAudioVideo = async () => {
    if (!videoUrl || !audioUrl) return;
    setMerging(true);
    try {
      const mergedUrl = await mergeVideoAudio(videoUrl, audioUrl);
      setVideoUrl(mergedUrl); setSavedToLibrary(false);
      toast({ title: "Merged!", description: "Audio added to your video" });
    } catch (err: any) { toast({ title: "Merge failed", description: err.message, variant: "destructive" }); }
    finally { setMerging(false); }
  };

  const isGenerating = status === "transforming" || status === "submitting" || status === "processing" || watermarking || imageGenerating || standaloneAudioGenerating;

  return (
    <div className={fullPage ? "flex flex-col" : ""}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className={fullPage ? "flex flex-col" : ""}>
        <TabsList className="w-full mb-4 shrink-0">
          <TabsTrigger value="generate" className="flex-1 gap-1.5">
            <Clapperboard className="w-3.5 h-3.5" />
            Studio
          </TabsTrigger>
          <TabsTrigger value="library" className="flex-1 gap-1.5">
            <Library className="w-3.5 h-3.5" />
            Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          <VideoLibrary onSelectVideo={(url) => onVideoReady?.(url)} />
        </TabsContent>

        <TabsContent value="generate" className={fullPage ? "flex flex-col" : ""}>
          {/* Results area */}
          <div className={fullPage ? "pb-4" : "space-y-4"}>
            {/* Progress */}
            {(status === "submitting" || status === "processing") && (() => {
              const sceneCount = isMultiRef.current ? Math.ceil(parseInt(duration) / currentMode.maxClipDuration) : 1;
              const estPerScene = currentMode.provider === "sora" ? 240 : 120;
              const estTotal = sceneCount * estPerScene;
              const simulated = Math.min(85, (elapsedSecs / estTotal) * 85);
              const displayProgress = Math.max(progress, simulated);
              const mins = Math.floor(elapsedSecs / 60);
              const secs = elapsedSecs % 60;
              const elapsed = mins > 0 ? `${mins}m ${secs.toString().padStart(2, "0")}s` : `${secs}s`;
              const estMins = Math.ceil(estTotal / 60);

              return (
                <div className={`space-y-4 ${fullPage ? "py-12" : "py-6"}`}>
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">
                        {isMultiRef.current ? `Generating ${sceneCount} scenes…` : `Generating ${currentMode.label} video…`}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1 animate-pulse">
                        {progressLabel || `${currentMode.label} mode typically takes ~${estMins} min`}
                      </p>
                    </div>
                  </div>
                  <Progress value={displayProgress} className="h-2" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>{elapsed} elapsed</span>
                    <span>~{estMins} min estimated</span>
                  </div>
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => {
                    cleanup(); setStatus("idle"); setProgress(0); setProgressLabel(""); setElapsedSecs(0);
                    jobRef.current = null; multiJobsRef.current = null; isMultiRef.current = false;
                    uploadedSceneUrlsRef.current = {}; pollCountRef.current = 0;
                  }}>
                    Cancel
                  </Button>
                </div>
              );
            })()}

            {/* Completed */}
            {mediaType === "video" && status === "completed" && videoUrl && !showEditor && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[hsl(var(--success))]">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">{currentMode.label} video ready!</span>
                </div>

                <div className={`rounded-xl overflow-hidden border bg-black ${fullPage ? "aspect-video" : ""}`}>
                  <video src={videoUrl} controls autoPlay muted className="w-full aspect-video"
                    onEnded={() => {
                      if (sceneUrls.length > 1 && currentScene < sceneUrls.length - 1) {
                        const next = currentScene + 1; setCurrentScene(next); setVideoUrl(sceneUrls[next]);
                      }
                    }}
                  />
                </div>

                {sceneUrls.length > 1 && (
                  <div className="flex items-center gap-2 justify-center">
                    <span className="text-xs text-muted-foreground">Scene {currentScene + 1}/{sceneUrls.length}</span>
                    <div className="flex gap-1">
                      {sceneUrls.map((url, i) => (
                        <button key={i} onClick={() => { setCurrentScene(i); setVideoUrl(url); }}
                          className={`w-2 h-2 rounded-full transition-colors ${i === currentScene ? "bg-primary" : "bg-muted-foreground/30"}`} />
                      ))}
                    </div>
                  </div>
                )}

                {transformResult && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <Eye className="w-3 h-3" /> View engineered prompt used
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-1 p-2 rounded border bg-muted/20 text-xs text-muted-foreground">
                        {transformResult.engineeredPrompt}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Audio Section */}
                <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Music className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Add Audio / Music</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setAudioType("music")}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${audioType === "music" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}>
                      🎵 Music
                    </button>
                    <button onClick={() => setAudioType("sfx")}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${audioType === "sfx" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}>
                      🔊 Sound Effect
                    </button>
                  </div>
                  <Input value={audioPrompt} onChange={(e) => setAudioPrompt(e.target.value)}
                    placeholder={audioType === "music" ? "Upbeat corporate background music..." : "Construction machinery ambient sounds..."}
                    className="text-sm" />
                  {audioType === "music" && (
                    <Select value={audioDuration} onValueChange={setAudioDuration}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 seconds</SelectItem>
                        <SelectItem value="15">15 seconds</SelectItem>
                        <SelectItem value="30">30 seconds</SelectItem>
                        <SelectItem value="60">60 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button size="sm" variant="outline" className="w-full gap-1.5" disabled={!audioPrompt.trim() || audioGenerating} onClick={handleGenerateAudio}>
                    {audioGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Music className="w-3.5 h-3.5" />}
                    {audioGenerating ? "Generating..." : "Generate Audio"}
                  </Button>
                  {audioUrl && (
                    <div className="flex items-center gap-2 p-2 rounded bg-background border">
                      <Button size="sm" variant="ghost" onClick={toggleAudioPlayback} className="h-8 w-8 p-0">
                        <Volume2 className={`w-4 h-4 ${audioPlaying ? "text-primary" : ""}`} />
                      </Button>
                      <span className="text-xs text-muted-foreground flex-1">{audioPlaying ? "Playing..." : "Audio ready"}</span>
                      <Button size="sm" className="gap-1.5 h-7 text-xs" disabled={merging} onClick={handleMergeAudioVideo}>
                        {merging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {merging ? "Merging..." : "Add to Video"}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                        <a href={audioUrl} download="audio.mp3"><Download className="w-3 h-3" /></a>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  {onVideoReady && (
                    <Button className="flex-1 gap-2" onClick={handleUseVideo}>
                      <Video className="w-4 h-4" /> Use in Post
                    </Button>
                  )}
                  <Button variant="outline" className="gap-1.5" onClick={() => setShowEditor(true)}>
                    <Pencil className="w-4 h-4" /> Edit Video
                  </Button>
                  {!savedToLibrary && (
                    <Button variant="outline" onClick={handleSaveToLibrary} className="gap-1.5">
                      <Save className="w-4 h-4" /> Save
                    </Button>
                  )}
                  {savedToLibrary && (
                    <Button variant="outline" disabled className="gap-1.5 text-[hsl(var(--success))]">
                      <CheckCircle2 className="w-4 h-4" /> Saved
                    </Button>
                  )}
                  <Button variant="outline" asChild>
                    <a href={videoUrl} download target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4" /></a>
                  </Button>
                   <Button variant="outline" className="gap-1.5" onClick={() => setShowSocialPanel(!showSocialPanel)}>
                     <Share2 className="w-4 h-4" /> Post
                   </Button>
                   <Button variant="outline" className="gap-1.5" onClick={handleAnalyzeVideo} disabled={analyzing}>
                     {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                     {analyzing ? "Analyzing..." : "Analyze"}
                   </Button>
                   <Button variant="outline" onClick={handleReset}><RotateCcw className="w-4 h-4" /></Button>
                </div>

                {showSocialPanel && (
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <VideoToSocialPanel videoUrl={videoUrl} aspectRatio={aspectRatio} onClose={() => setShowSocialPanel(false)} />
                  </div>
                )}

                {showInsights && analysisResults && (
                  <VideoInsightsPanel
                    results={analysisResults}
                    moderationStatus={moderationStatus}
                    suggestedHashtags={suggestedHashtags}
                    onClose={() => setShowInsights(false)}
                  />
                )}
              </div>
            )}

            {/* Video Editor */}
            {mediaType === "video" && status === "completed" && videoUrl && showEditor && (
              <VideoEditor
                videoUrl={videoUrl}
                engineeredPrompt={transformResult?.engineeredPrompt || rawPrompt}
                mode={currentMode.label}
                duration={duration}
                onBack={() => setShowEditor(false)}
                onEditComplete={(newUrl) => { setVideoUrl(newUrl); setSavedToLibrary(false); setShowEditor(false); }}
                onRegenerate={(editedPrompt) => {
                  setShowEditor(false); setStatus("submitting"); setProgress(0);
                  setProgressLabel("Regenerating with edits..."); setError(null);
                  setSavedToLibrary(false); setVideoUrl(null); pollCountRef.current = 0;
                  (async () => {
                    try {
                      const data = await invokeEdgeFunction("generate-video", {
                        action: "generate", provider: currentMode.provider, prompt: editedPrompt,
                        duration: parseInt(duration),
                        model: currentMode.model === "sora-2-pro" ? "sora-2-pro" : currentMode.model === "sora-2" ? "sora-2" : undefined,
                        aspectRatio: "16:9",
                      });
                      if (data?.status === "failed") { setError(data.error || "Regeneration failed."); setStatus("failed"); return; }
                      if (data?.mode === "slideshow" && Array.isArray(data.imageUrls)) {
                        setProgressLabel("Compiling motion slideshow..."); setProgress(50);
                        const blobUrl = await slideshowToVideo({ imageUrls: data.imageUrls, durationPerImage: data.clipDuration || 5, onProgress: (pct) => setProgress(50 + Math.round(pct * 0.5)) });
                        setVideoUrl(blobUrl); setSceneUrls([blobUrl]); setStatus("completed"); return;
                      }
                      if (!data?.jobId || !data?.provider) { setError("No generation job was returned."); setStatus("failed"); return; }
                      jobRef.current = { id: data.jobId, provider: data.provider };
                      setStatus("processing"); setProgress(5); setProgressLabel("Regenerating video with edits...");
                      pollTimerRef.current = setTimeout(pollForResult, 5000);
                    } catch (err: any) { setError(err?.message || "Regeneration failed."); setStatus("failed"); }
                  })();
                }}
              />
            )}

            {/* Error */}
            {mediaType === "video" && status === "failed" && (
              <div className="space-y-4 py-4">
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                  <p className="text-sm font-medium text-destructive">{error}</p>
                  <p className="text-xs text-muted-foreground mt-1">Credits have been automatically refunded.</p>
                </div>
                <Button variant="outline" className="w-full gap-2" onClick={handleReset}>
                  <RotateCcw className="w-4 h-4" /> Try Again
                </Button>
              </div>
            )}

            {/* Image result */}
            {mediaType === "image" && generatedImageUrl && !imageGenerating && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[hsl(var(--success))]">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Image ready!</span>
                </div>
                <div className="rounded-xl overflow-hidden border bg-black">
                  <img src={generatedImageUrl} alt="Generated" className="w-full object-contain max-h-[500px]" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" asChild>
                    <a href={generatedImageUrl} download="generated-image.png" target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4 mr-1.5" /> Download</a>
                  </Button>
                  <Button variant="outline" onClick={() => { setGeneratedImageUrl(null); }}><RotateCcw className="w-4 h-4" /></Button>
                </div>
              </div>
            )}

            {/* Image generating */}
            {mediaType === "image" && imageGenerating && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
                <p className="font-semibold text-lg">Generating image…</p>
                <p className="text-sm text-muted-foreground animate-pulse">This usually takes 10-30 seconds</p>
              </div>
            )}

            {/* Standalone audio result */}
            {mediaType === "audio" && standaloneAudioUrl && !standaloneAudioGenerating && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[hsl(var(--success))]">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">{audioType === "music" ? "Music" : "Sound effect"} ready!</span>
                </div>
                <div className="p-4 rounded-xl border bg-muted/30">
                  <audio src={standaloneAudioUrl} controls className="w-full" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" asChild>
                    <a href={standaloneAudioUrl} download={`generated-${audioType}.mp3`}><Download className="w-4 h-4 mr-1.5" /> Download</a>
                  </Button>
                  <Button variant="outline" onClick={() => { setStandaloneAudioUrl(null); }}><RotateCcw className="w-4 h-4" /></Button>
                </div>
              </div>
            )}

            {/* Audio generating */}
            {mediaType === "audio" && standaloneAudioGenerating && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
                <p className="font-semibold text-lg">Generating {audioType === "music" ? "music" : "sound effect"}…</p>
                <p className="text-sm text-muted-foreground animate-pulse">This usually takes 15-60 seconds</p>
              </div>
            )}

            {/* Empty state */}
            {fullPage && status === "idle" && !generatedImageUrl && !standaloneAudioUrl && !imageGenerating && !standaloneAudioGenerating && (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4">
                  {mediaType === "image" ? <ImageIcon className="w-10 h-10 text-muted-foreground/30" /> :
                   mediaType === "audio" ? <Music className="w-10 h-10 text-muted-foreground/30" /> :
                   <Clapperboard className="w-10 h-10 text-muted-foreground/30" />}
                </div>
                <p className="text-muted-foreground text-sm font-medium">
                  {mediaType === "image" ? "Your image will appear here" :
                   mediaType === "audio" ? "Your audio will appear here" :
                   "Your video will appear here"}
                </p>
                <p className="text-muted-foreground/50 text-xs mt-1">Describe your idea below and hit Generate</p>
              </div>
            )}
          </div>

          {/* Prompt Bar — pinned at bottom in full page, inline otherwise */}
          {(status === "idle" || status === "transforming" || status === "completed" || status === "failed" || (mediaType !== "video" && !isGenerating)) && (
            <div className={fullPage ? "shrink-0 pt-2" : "mt-4"}>
              <VideoStudioPromptBar
                rawPrompt={rawPrompt}
                onPromptChange={setRawPrompt}
                mode={mode}
                onModeChange={setMode}
                duration={duration}
                onDurationChange={setDuration}
                aspectRatio={aspectRatio}
                onAspectRatioChange={setAspectRatio}
                showEngineered={showEngineered}
                onToggleEngineered={() => setShowEngineered(!showEngineered)}
                engineeredPrompt={transformResult?.engineeredPrompt}
                intent={transformResult?.intent}
                isConstructionRelated={transformResult?.isConstructionRelated}
                totalSpent={totalSpent}
                canGenerate={mediaType === "video" ? (effectiveVideoProvider === "wan" || canGenerate(parseInt(duration), mode)) : true}
                isGenerating={imageGenerating || standaloneAudioGenerating}
                isTransforming={isTransforming}
                onGenerate={handleGenerate}
                referenceImage={referenceImage}
                onReferenceImageChange={setReferenceImage}
                mediaType={mediaType}
                onMediaTypeChange={(t) => {
                  setMediaType(t);
                  setGeneratedImageUrl(null);
                  setStandaloneAudioUrl(null);
                  setError(null);
                  setStatus("idle");
                  setVideoUrl(null);
                  setSceneUrls([]);
                  if (t === "audio") setDuration("15");
                  else if (t === "video") setDuration("8");
                  // Set default model for media type
                  if (t === "image") setSelectedModel("gpt-image-1");
                  else if (t === "video") setSelectedModel("veo-3.1");
                  else setSelectedModel("elevenlabs");
                }}
                audioType={audioType}
                onAudioTypeChange={setAudioType}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                negativePrompt={negativePrompt}
                onNegativePromptChange={setNegativePrompt}
                customAudioFile={customAudioFile}
                onCustomAudioFileChange={setCustomAudioFile}
                firstFrameImage={firstFrameImage}
                onFirstFrameImageChange={setFirstFrameImage}
                lastFrameImage={lastFrameImage}
                onLastFrameImageChange={setLastFrameImage}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
