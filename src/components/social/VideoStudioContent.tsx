import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Video, Loader2, Sparkles, Download, RotateCcw, CheckCircle2, Library, Save,
  Music, Volume2, ChevronDown, ChevronUp, Wand2, Zap, Crown, Eye, EyeOff,
  Film, Upload, ExternalLink, Clapperboard, Pencil, Share2, Gauge
} from "lucide-react";
import { VideoEditor } from "./VideoEditor";
import { VideoToSocialPanel } from "./VideoToSocialPanel";
import { useVideoCredits } from "@/hooks/useVideoCredits";
import { useGenerations } from "@/hooks/useGenerations";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { slideshowToVideo } from "@/lib/slideshowToVideo";
import { supabase } from "@/integrations/supabase/client";
import { VideoLibrary } from "./VideoLibrary";
import { useBrandKit } from "@/hooks/useBrandKit";
import { useSeoSuggestions } from "@/hooks/useSeoSuggestions";
import { usePromptTransformer } from "@/hooks/usePromptTransformer";
import { Skeleton } from "@/components/ui/skeleton";
import { applyLogoWatermark } from "@/lib/videoWatermark";
import { mergeVideoAudio } from "@/lib/videoAudioMerge";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

type Status = "idle" | "transforming" | "submitting" | "processing" | "completed" | "failed";
type GenerationMode = "fast" | "balanced" | "premium";

interface ModeConfig {
  id: GenerationMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  provider: "sora" | "veo";
  model: string;
  maxClipDuration: number;
  durationOptions: { value: string; label: string }[];
  badge: string;
}

const modeConfigs: ModeConfig[] = [
  {
    id: "fast",
    label: "Fast",
    description: "Quick iterations for social content",
    icon: <Zap className="w-4 h-4" />,
    provider: "sora",
    model: "sora-2",
    maxClipDuration: 12,
    badge: "~2 min",
    durationOptions: [
      { value: "4", label: "4s" },
      { value: "8", label: "8s" },
      { value: "12", label: "12s" },
    ],
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "High-quality cinematic video",
    icon: <Film className="w-4 h-4" />,
    provider: "veo",
    model: "veo-3.1",
    maxClipDuration: 8,
    badge: "~3 min",
    durationOptions: [
      { value: "4", label: "4s" },
      { value: "6", label: "6s" },
      { value: "8", label: "8s" },
    ],
  },
  {
    id: "premium",
    label: "Premium",
    description: "Highest fidelity production quality",
    icon: <Crown className="w-4 h-4" />,
    provider: "sora",
    model: "sora-2-pro",
    maxClipDuration: 12,
    badge: "~5 min",
    durationOptions: [
      { value: "4", label: "4s" },
      { value: "8", label: "8s" },
      { value: "12", label: "12s" },
    ],
  },
];

const aspectRatios = [
  { value: "16:9", label: "16:9 Landscape", icon: "🖥️" },
  { value: "9:16", label: "9:16 Portrait", icon: "📱" },
  { value: "1:1", label: "1:1 Square", icon: "⬜" },
];

const MAX_POLL_COUNT = 120;

interface VideoStudioContentProps {
  /** If true, runs as a full page; otherwise as embedded content */
  fullPage?: boolean;
  onVideoReady?: (videoUrl: string) => void;
}

export function VideoStudioContent({ fullPage = false, onVideoReady }: VideoStudioContentProps) {
  const { brandKit } = useBrandKit();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { transform, isTransforming, transformResult, transformError, reset: resetTransform } = usePromptTransformer();
  const { remaining, total, usedPercent, plan, canGenerate, getCost, consumeCredits, refundCredits } = useVideoCredits();
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
      return () => {
        if (progressTickRef.current) clearInterval(progressTickRef.current);
      };
    }
  }, [status]);

  useEffect(() => cleanup, [cleanup]);

  useEffect(() => {
    if (status === "completed" && rawPrompt && !audioPrompt) {
      setAudioPrompt(`Background music for: ${rawPrompt.slice(0, 100)}`);
    }
  }, [status, rawPrompt]);

  const { suggestions: promptSuggestions, isLoading: suggestionsLoading } = useSeoSuggestions("video");

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
          action: "download",
          provider,
          ...(provider === "veo" ? { videoUrl: remoteVideoUrl } : { jobId }),
        }),
      });
      if (dlResp.ok) {
        const blob = await dlResp.blob();
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        return blobUrl;
      }
    } catch (e) {
      console.error("Proxy download failed:", e);
    }
    return null;
  };

  // Multi-scene polling
  const pollMultiScene = useCallback(async () => {
    if (!multiJobsRef.current) return;
    pollCountRef.current += 1;
    if (pollCountRef.current > MAX_POLL_COUNT) {
      setError("Multi-scene generation timed out.");
      setStatus("failed");
      return;
    }
    try {
      const existingUrls: Record<string, string> = {};
      for (const [k, v] of Object.entries(uploadedSceneUrlsRef.current)) {
        existingUrls[String(k)] = v;
      }
      const data = await invokeEdgeFunction("generate-video", {
        action: "poll-multi",
        jobIds: multiJobsRef.current,
        existingSceneUrls: existingUrls,
      });
      if (data.uploadedSceneUrls) {
        for (const [k, v] of Object.entries(data.uploadedSceneUrls)) {
          uploadedSceneUrlsRef.current[Number(k)] = v as string;
        }
      }
      if (data.status === "completed") {
        setProgress(100);
        setProgressLabel("All scenes complete!");
        const urls: string[] = data.sceneUrls || (data.videoUrl ? [data.videoUrl] : []);
        setSceneUrls(urls);
        setCurrentScene(0);
        setSavedToLibrary(!!data.savedToLibrary);
        const firstUrl = urls[0];
        if (firstUrl && brandKit?.logo_url) {
          setWatermarking(true);
          setProgressLabel("Applying logo watermark...");
          try {
            const watermarked = await applyLogoWatermark(firstUrl, brandKit.logo_url, 80);
            setVideoUrl(watermarked);
          } catch { setVideoUrl(firstUrl); }
          setWatermarking(false);
        } else {
          setVideoUrl(firstUrl || null);
        }
        setStatus("completed");
        return;
      }
      if (data.status === "failed") {
        setError(data.error || "Multi-scene generation failed.");
        setStatus("failed");
        return;
      }
      const completed = data.completedScenes || 0;
      const uploaded = data.uploadedScenes || 0;
      const total = data.totalScenes || multiJobsRef.current.length;
      setProgress(data.progress || Math.round((uploaded / total) * 100));
      setProgressLabel(`Scene ${completed}/${total} generated, ${uploaded} uploaded`);
      pollTimerRef.current = setTimeout(pollMultiScene, 5000);
    } catch (err: any) {
      setError(err?.message || "Failed to check multi-scene status.");
      setStatus("failed");
    }
  }, [brandKit]);

  // Single clip polling
  const pollForResult = useCallback(async () => {
    if (!jobRef.current) return;
    pollCountRef.current += 1;
    if (pollCountRef.current > MAX_POLL_COUNT) {
      setError("Video generation timed out.");
      setStatus("failed");
      return;
    }
    try {
      const data = await invokeEdgeFunction("generate-video", {
        action: "poll",
        provider: jobRef.current.provider,
        jobId: jobRef.current.id,
      });
      if (data.status === "completed") {
        setProgress(100);
        const needsProxy = data.needsAuth || data.needsGeminiAuth;
        let finalUrl: string | null = null;
        if (needsProxy) {
          finalUrl = await proxyDownload(jobRef.current.provider, jobRef.current.id, data.videoUrl) || data.videoUrl;
        } else {
          finalUrl = data.videoUrl;
        }
        if (!finalUrl) { setError("Video generated but no URL returned."); setStatus("failed"); return; }
        if (brandKit?.logo_url) {
          setWatermarking(true);
          try {
            const watermarked = await applyLogoWatermark(finalUrl, brandKit.logo_url, 80);
            setVideoUrl(watermarked);
          } catch { setVideoUrl(finalUrl); }
          setWatermarking(false);
        } else {
          setVideoUrl(finalUrl);
        }
        setSceneUrls([finalUrl]);
        setStatus("completed");
        return;
      }
      if (data.status === "failed") { setError(data.error || "Video generation failed."); setStatus("failed"); return; }
      if (data.progress != null) setProgress(data.progress);
      else setProgress(prev => Math.min(prev + 3, 90));
      pollTimerRef.current = setTimeout(pollForResult, 5000);
    } catch (err: any) {
      setError(err?.message || "Failed to check video status.");
      setStatus("failed");
    }
  }, [brandKit]);

  // Main generate handler
  const handleGenerate = async () => {
    if (!rawPrompt.trim()) return;

    // Credit check
    const durationSecs = parseInt(duration);
    if (!canGenerate(durationSecs, mode)) {
      const cost = getCost(durationSecs, mode);
      toast({ title: "Not enough credits", description: `Need ${cost}s credits, have ${remaining}s remaining.`, variant: "destructive" });
      return;
    }

    // Consume credits upfront
    try {
      await consumeCredits.mutateAsync({ durationSeconds: durationSecs, mode });
    } catch (err: any) {
      toast({ title: "Credit error", description: err.message, variant: "destructive" });
      return;
    }

    // Step 1: Transform the prompt
    setStatus("transforming");
    setProgress(0);
    setProgressLabel("Engineering cinematic prompt...");
    setError(null);
    setVideoUrl(null);
    setSavedToLibrary(false);
    setAudioUrl(null);
    uploadedSceneUrlsRef.current = {};
    pollCountRef.current = 0;

    const result = await transform(rawPrompt, aspectRatio, parseInt(duration));
    if (!result) {
      // Fallback: use raw prompt if transform fails
      console.warn("Prompt transform failed, using raw prompt");
    }

    const finalPrompt = result?.engineeredPrompt || rawPrompt.trim();

    // Step 2: Generate the video
    setStatus("submitting");
    setProgress(0);
    setProgressLabel("");

    const requestedDuration = parseInt(duration);
    const isMultiScene = requestedDuration > currentMode.maxClipDuration;
    isMultiRef.current = isMultiScene;

    try {
      if (isMultiScene) {
        const sceneCount = Math.ceil(requestedDuration / currentMode.maxClipDuration);
        setProgressLabel(`Generating ${sceneCount} scenes...`);
        const data = await invokeEdgeFunction("generate-video", {
          action: "generate-multi",
          provider: currentMode.provider,
          prompt: finalPrompt,
          duration: requestedDuration,
          model: currentMode.model === "sora-2-pro" ? "sora-2-pro" : currentMode.model === "sora-2" ? "sora-2" : undefined,
        });
        if (data?.status === "failed") {
          setError(data.error || "Failed to start generation.");
          setStatus("failed");
          return;
        }
        if (data?.mode === "slideshow" && Array.isArray(data.imageUrls)) {
          setProgressLabel("Compiling motion slideshow...");
          setProgress(50);
          try {
            const blobUrl = await slideshowToVideo({
              imageUrls: data.imageUrls,
              durationPerImage: data.clipDuration || 5,
              onProgress: (pct) => setProgress(50 + Math.round(pct * 0.5)),
            });
            setVideoUrl(blobUrl);
            setSceneUrls([blobUrl]);
            setStatus("completed");
            toast({ title: "🎬 Motion Slideshow", description: data.message });
          } catch (compileErr: any) {
            setError(`Slideshow failed: ${compileErr.message}`);
            setStatus("failed");
          }
          return;
        }
        if (!Array.isArray(data?.jobs) || data.jobs.length === 0) {
          setError("No generation jobs were created.");
          setStatus("failed");
          return;
        }
        multiJobsRef.current = data.jobs;
        setStatus("processing");
        setProgress(5);
        setProgressLabel(`Generating ${data.totalScenes} scenes (${data.clipDuration}s each)...`);
        pollTimerRef.current = setTimeout(pollMultiScene, 5000);
      } else {
        const data = await invokeEdgeFunction("generate-video", {
          action: "generate",
          provider: currentMode.provider,
          prompt: finalPrompt,
          duration: requestedDuration,
          model: currentMode.model === "sora-2-pro" ? "sora-2-pro" : currentMode.model === "sora-2" ? "sora-2" : undefined,
        });
        if (data?.status === "failed") {
          setError(data.error || "Failed to start generation.");
          setStatus("failed");
          return;
        }
        if (data?.mode === "slideshow" && Array.isArray(data.imageUrls)) {
          setProgressLabel("Compiling motion slideshow...");
          setProgress(50);
          try {
            const blobUrl = await slideshowToVideo({
              imageUrls: data.imageUrls,
              durationPerImage: data.clipDuration || 5,
              onProgress: (pct) => setProgress(50 + Math.round(pct * 0.5)),
            });
            setVideoUrl(blobUrl);
            setSceneUrls([blobUrl]);
            setStatus("completed");
            toast({ title: "🎬 Motion Slideshow", description: data.message });
          } catch (compileErr: any) {
            setError(`Slideshow failed: ${compileErr.message}`);
            setStatus("failed");
          }
          return;
        }
        if (!data?.jobId || !data?.provider) {
          setError("No generation job was returned.");
          setStatus("failed");
          return;
        }
        jobRef.current = { id: data.jobId, provider: data.provider };
        setStatus("processing");
        setProgress(5);
        setProgressLabel("Generating video...");
        pollTimerRef.current = setTimeout(pollForResult, 5000);
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to start video generation.";
      setError(msg);
      setStatus("failed");
    }
  };

  const handleReset = () => {
    cleanup();
    resetTransform();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setStatus("idle");
    setProgress(0);
    setProgressLabel("");
    setVideoUrl(null);
    setSceneUrls([]);
    setCurrentScene(0);
    setWatermarking(false);
    setSavedToLibrary(false);
    setError(null);
    setAudioUrl(null);
    setShowEditor(false);
    setShowSocialPanel(false);
    setAudioPrompt("");
    setAudioGenerating(false);
    setAudioPlaying(false);
    setMerging(false);
    jobRef.current = null;
    multiJobsRef.current = null;
    isMultiRef.current = false;
    uploadedSceneUrlsRef.current = {};
    pollCountRef.current = 0;
    setElapsedSecs(0);
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
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
  };

  const handleUseVideo = () => {
    if (videoUrl) {
      onVideoReady?.(videoUrl);
    }
  };

  // Audio handlers
  const handleGenerateAudio = async () => {
    if (!audioPrompt.trim()) return;
    setAudioGenerating(true);
    setAudioUrl(null);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ prompt: audioPrompt, duration: parseInt(audioDuration), type: audioType }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Audio generation failed (${response.status})`);
      }
      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      toast({ title: "Audio ready!", description: `${audioType === "music" ? "Music" : "SFX"} generated` });
    } catch (err: any) {
      toast({ title: "Audio generation failed", description: err.message, variant: "destructive" });
    } finally {
      setAudioGenerating(false);
    }
  };

  const toggleAudioPlayback = () => {
    if (!audioUrl) return;
    if (audioPlaying && audioRef.current) {
      audioRef.current.pause();
      setAudioPlaying(false);
    } else {
      const audio = new Audio(audioUrl);
      audio.onended = () => setAudioPlaying(false);
      audio.play();
      audioRef.current = audio;
      setAudioPlaying(true);
    }
  };

  const handleMergeAudioVideo = async () => {
    if (!videoUrl || !audioUrl) return;
    setMerging(true);
    try {
      const mergedUrl = await mergeVideoAudio(videoUrl, audioUrl);
      setVideoUrl(mergedUrl);
      setSavedToLibrary(false);
      toast({ title: "Merged!", description: "Audio added to your video" });
    } catch (err: any) {
      toast({ title: "Merge failed", description: err.message, variant: "destructive" });
    } finally {
      setMerging(false);
    }
  };

  const isGenerating = status === "transforming" || status === "submitting" || status === "processing" || watermarking;

  const containerClass = fullPage
    ? "max-w-5xl mx-auto"
    : "";

  return (
    <div className={containerClass}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-4">
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
          <VideoLibrary
            onSelectVideo={(url) => {
              onVideoReady?.(url);
            }}
          />
        </TabsContent>

        <TabsContent value="generate">
          <div className={fullPage ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "space-y-4"}>
            {/* LEFT COLUMN: Input Controls */}
            {(status === "idle" || status === "transforming") && (
              <div className="space-y-5">
                {/* Mode Selector */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Generation Mode</Label>
                  <div className={fullPage ? "grid grid-cols-3 gap-3" : "grid grid-cols-3 gap-2"}>
                    {modeConfigs.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        disabled={isTransforming}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                          mode === m.id
                            ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                            : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          m.id === "fast" ? "bg-emerald-500/10 text-emerald-500" :
                          m.id === "balanced" ? "bg-violet-500/10 text-violet-500" :
                          "bg-amber-500/10 text-amber-500"
                        }`}>
                          {m.icon}
                        </div>
                        <span className="font-medium text-sm">{m.label}</span>
                        <span className="text-[10px] text-muted-foreground">{m.badge}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prompt Box */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">What do you want to create?</Label>
                  <Textarea
                    value={rawPrompt}
                    onChange={(e) => setRawPrompt(e.target.value)}
                    placeholder="Say it naturally — we'll turn it into a production-ready video prompt."
                    className={`resize-none ${fullPage ? "min-h-[140px]" : "min-h-[100px]"}`}
                    disabled={isTransforming}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Your casual description will be automatically transformed into a professional cinematic prompt.
                  </p>
                </div>

                {/* Quick Suggestions */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Try a suggestion</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestionsLoading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-7 w-36 rounded-full" />
                      ))
                    ) : (
                      promptSuggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setRawPrompt(s)}
                          disabled={isTransforming}
                          className="text-xs px-2.5 py-1.5 rounded-full border bg-card hover:bg-muted transition-colors text-left leading-tight"
                        >
                          {s.slice(0, 50)}…
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Duration + Aspect Ratio */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Duration</Label>
                    <Select value={duration} onValueChange={setDuration} disabled={isTransforming}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currentMode.durationOptions.map((d) => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Aspect Ratio</Label>
                    <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={isTransforming}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aspectRatios.map((ar) => (
                          <SelectItem key={ar.value} value={ar.value}>
                            {ar.icon} {ar.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Engineered Prompt Preview */}
                {transformResult && (
                  <Collapsible open={showEngineered} onOpenChange={setShowEngineered}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors w-full">
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>Engineered Prompt</span>
                        {transformResult.intent && transformResult.intent !== "cinematic_broll" && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-violet-500/10 text-violet-600 border-violet-500/20">
                            {transformResult.intent.replace(/_/g, " ")}
                          </Badge>
                        )}
                        {transformResult.isConstructionRelated && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20">
                            Construction Enhanced
                          </Badge>
                        )}
                        <span className="flex-1" />
                        {showEngineered ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 p-3 rounded-lg border bg-muted/30 text-sm text-muted-foreground leading-relaxed">
                        {transformResult.engineeredPrompt}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {Object.entries(transformResult.elements).map(([key, value]) => (
                          value && value !== "unspecified" && (
                            <Badge key={key} variant="secondary" className="text-[10px] gap-1">
                              <span className="font-semibold capitalize">{key}:</span> {String(value).slice(0, 30)}
                            </Badge>
                          )
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {transformError && (
                  <p className="text-xs text-amber-600">⚠️ Prompt transform unavailable, using your text directly.</p>
                )}

                {/* Credits Display */}
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <Gauge className="w-4 h-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{remaining}s / {total}s remaining</span>
                      <Badge variant="secondary" className="text-[10px]">{plan}</Badge>
                    </div>
                    <Progress value={usedPercent} className="h-1.5" />
                  </div>
                  {rawPrompt.trim() && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      Cost: {getCost(parseInt(duration), mode)}s
                    </span>
                  )}
                </div>

                {/* Generate Button */}
                <Button
                  className="w-full gap-2 h-11"
                  disabled={!rawPrompt.trim() || isTransforming || !canGenerate(parseInt(duration), mode)}
                  onClick={handleGenerate}
                  size="lg"
                >
                  {isTransforming ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Engineering prompt...
                    </>
                  ) : !canGenerate(parseInt(duration), mode) ? (
                    <>
                      <Gauge className="w-4 h-4" />
                      Not enough credits
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate {currentMode.label} Video
                    </>
                  )}
                </Button>

                {fullPage && (
                  <p className="text-[11px] text-center text-muted-foreground">
                    Powered by Google Veo 3.1 &amp; OpenAI Sora • Auto-fallback to motion slideshow
                  </p>
                )}
              </div>
            )}

            {/* RIGHT COLUMN / Progress / Result */}
            <div className="space-y-4">
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
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
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
                      cleanup();
                      setStatus("idle");
                      setProgress(0);
                      setProgressLabel("");
                      setElapsedSecs(0);
                      jobRef.current = null;
                      multiJobsRef.current = null;
                      isMultiRef.current = false;
                      uploadedSceneUrlsRef.current = {};
                      pollCountRef.current = 0;
                    }}>
                      Cancel
                    </Button>
                  </div>
                );
              })()}

              {/* Completed */}
              {status === "completed" && videoUrl && !showEditor && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">
                      {currentMode.label} video ready!
                    </span>
                  </div>

                  <div className={`rounded-xl overflow-hidden border bg-black ${fullPage ? "aspect-video" : ""}`}>
                    <video
                      src={videoUrl}
                      controls
                      autoPlay
                      muted
                      className="w-full aspect-video"
                      onEnded={() => {
                        if (sceneUrls.length > 1 && currentScene < sceneUrls.length - 1) {
                          const next = currentScene + 1;
                          setCurrentScene(next);
                          setVideoUrl(sceneUrls[next]);
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
                            className={`w-2 h-2 rounded-full transition-colors ${i === currentScene ? "bg-primary" : "bg-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Engineered prompt used */}
                  {transformResult && (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <Eye className="w-3 h-3" />
                          View engineered prompt used
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
                      <Button variant="outline" disabled className="gap-1.5 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" /> Saved
                      </Button>
                    )}
                    <Button variant="outline" asChild>
                      <a href={videoUrl} download target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4" /></a>
                    </Button>
                    <Button variant="outline" className="gap-1.5" onClick={() => setShowSocialPanel(!showSocialPanel)}>
                      <Share2 className="w-4 h-4" /> Post
                    </Button>
                    <Button variant="outline" onClick={handleReset}><RotateCcw className="w-4 h-4" /></Button>
                  </div>

                  {/* Social Post Panel */}
                  {showSocialPanel && (
                    <div className="border rounded-lg p-3 bg-muted/30">
                      <VideoToSocialPanel
                        videoUrl={videoUrl}
                        aspectRatio={aspectRatio}
                        onClose={() => setShowSocialPanel(false)}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Video Editor */}
              {status === "completed" && videoUrl && showEditor && (
                <VideoEditor
                  videoUrl={videoUrl}
                  engineeredPrompt={transformResult?.engineeredPrompt || rawPrompt}
                  mode={currentMode.label}
                  duration={duration}
                  onBack={() => setShowEditor(false)}
                  onEditComplete={(newUrl, newPrompt) => {
                    setVideoUrl(newUrl);
                    setSavedToLibrary(false);
                    setShowEditor(false);
                  }}
                  onRegenerate={(editedPrompt) => {
                    setShowEditor(false);
                    setStatus("submitting");
                    setProgress(0);
                    setProgressLabel("Regenerating with edits...");
                    setError(null);
                    setSavedToLibrary(false);
                    setVideoUrl(null);
                    pollCountRef.current = 0;
                    // Fire regeneration with edited prompt
                    (async () => {
                      try {
                        const data = await invokeEdgeFunction("generate-video", {
                          action: "generate",
                          provider: currentMode.provider,
                          prompt: editedPrompt,
                          duration: parseInt(duration),
                          model: currentMode.model === "sora-2-pro" ? "sora-2-pro" : currentMode.model === "sora-2" ? "sora-2" : undefined,
                        });
                        if (data?.status === "failed") {
                          setError(data.error || "Regeneration failed.");
                          setStatus("failed");
                          return;
                        }
                        if (data?.mode === "slideshow" && Array.isArray(data.imageUrls)) {
                          setProgressLabel("Compiling motion slideshow...");
                          setProgress(50);
                          const blobUrl = await slideshowToVideo({
                            imageUrls: data.imageUrls,
                            durationPerImage: data.clipDuration || 5,
                            onProgress: (pct) => setProgress(50 + Math.round(pct * 0.5)),
                          });
                          setVideoUrl(blobUrl);
                          setSceneUrls([blobUrl]);
                          setStatus("completed");
                          return;
                        }
                        if (!data?.jobId || !data?.provider) {
                          setError("No generation job was returned.");
                          setStatus("failed");
                          return;
                        }
                        jobRef.current = { id: data.jobId, provider: data.provider };
                        setStatus("processing");
                        setProgress(5);
                        setProgressLabel("Regenerating video with edits...");
                        pollTimerRef.current = setTimeout(pollForResult, 5000);
                      } catch (err: any) {
                        setError(err?.message || "Regeneration failed.");
                        setStatus("failed");
                      }
                    })();
                  }}
                />
              )}

              {/* Error */}
              {status === "failed" && (
                <div className="space-y-4 py-4">
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                    <p className="text-sm font-medium text-destructive">{error}</p>
                  </div>
                  <Button variant="outline" className="w-full gap-2" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4" /> Try Again
                  </Button>
                </div>
              )}

              {/* Empty state for right column in full-page idle */}
              {fullPage && status === "idle" && (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] rounded-xl border-2 border-dashed border-border/50">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 flex items-center justify-center mb-4">
                    <Clapperboard className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-muted-foreground text-sm font-medium">Your video will appear here</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">Describe your idea and hit Generate</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
