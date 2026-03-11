import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Video, Loader2, Sparkles, Download, RotateCcw, CheckCircle2, Library, Save, X, Music, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { supabase } from "@/integrations/supabase/client";
import { VideoLibrary } from "./VideoLibrary";
import { useBrandKit } from "@/hooks/useBrandKit";
import { useSeoSuggestions } from "@/hooks/useSeoSuggestions";
import { Skeleton } from "@/components/ui/skeleton";
import { applyLogoWatermark } from "@/lib/videoWatermark";
import { mergeVideoAudio } from "@/lib/videoAudioMerge";
import { Input } from "@/components/ui/input";

interface VideoGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVideoReady?: (videoUrl: string) => void;
}

type Status = "idle" | "submitting" | "processing" | "completed" | "failed";
type Provider = "veo" | "sora";

interface ModelOption {
  id: string;
  provider: Provider;
  label: string;
  description: string;
  pricing: string;
  maxClipDuration: number;
  durationOptions: { value: string; label: string }[];
}

const modelOptions: ModelOption[] = [
  {
    id: "veo-3.1",
    provider: "veo",
    label: "Google Veo 3.1",
    description: "High-quality cinematic video with native audio",
    pricing: "$0.75/sec",
    maxClipDuration: 8,
    durationOptions: [
      { value: "4", label: "4 seconds" },
      { value: "6", label: "6 seconds" },
      { value: "8", label: "8 seconds" },
      { value: "30", label: "30 seconds (4 scenes)" },
      { value: "60", label: "60 seconds (8 scenes)" },
    ],
  },
  {
    id: "sora-2",
    provider: "sora",
    label: "OpenAI Sora 2",
    description: "Fast iteration, great for social content",
    pricing: "Usage-based",
    maxClipDuration: 12,
    durationOptions: [
      { value: "4", label: "4 seconds" },
      { value: "8", label: "8 seconds" },
      { value: "12", label: "12 seconds" },
      { value: "30", label: "30 seconds (3 scenes)" },
      { value: "60", label: "60 seconds (5 scenes)" },
    ],
  },
  {
    id: "sora-2-pro",
    provider: "sora",
    label: "OpenAI Sora 2 Pro",
    description: "Production-quality, highest fidelity",
    pricing: "Premium",
    maxClipDuration: 12,
    durationOptions: [
      { value: "4", label: "4 seconds" },
      { value: "8", label: "8 seconds" },
      { value: "12", label: "12 seconds" },
      { value: "30", label: "30 seconds (3 scenes)" },
      { value: "60", label: "60 seconds (5 scenes)" },
    ],
  },
];

const MAX_POLL_COUNT = 120;

export function VideoGeneratorDialog({ open, onOpenChange, onVideoReady }: VideoGeneratorDialogProps) {
  const { brandKit } = useBrandKit();
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("veo-3.1");
  const [duration, setDuration] = useState("8");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [sceneUrls, setSceneUrls] = useState<string[]>([]);
  const [currentScene, setCurrentScene] = useState(0);
  const [watermarking, setWatermarking] = useState(false);
  const [savedToLibrary, setSavedToLibrary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("generate");

  // Audio state
  const [audioPrompt, setAudioPrompt] = useState("");
  const [audioType, setAudioType] = useState<"music" | "sfx">("music");
  const [audioDuration, setAudioDuration] = useState("30");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioGenerating, setAudioGenerating] = useState(false);
  const [merging, setMerging] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);

  // Single clip refs
  const jobRef = useRef<{ id: string; provider: Provider } | null>(null);
  // Multi-scene refs
  const multiJobsRef = useRef<{ id: string; provider: Provider; sceneIndex: number }[] | null>(null);
  const isMultiRef = useRef(false);
  // Progressive upload tracking
  const uploadedSceneUrlsRef = useRef<Record<number, string>>({});

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollCountRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const progressTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const { toast } = useToast();

  const currentModel = modelOptions.find((m) => m.id === selectedModel) || modelOptions[0];

  const cleanup = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (progressTickRef.current) {
      clearInterval(progressTickRef.current);
      progressTickRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
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
        if (progressTickRef.current) {
          clearInterval(progressTickRef.current);
          progressTickRef.current = null;
        }
      };
    }
  }, [status]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  useEffect(() => {
    const maxDur = 60;
    if (parseInt(duration) > maxDur) {
      setDuration(String(maxDur));
    }
  }, [selectedModel]);

  // Auto-suggest audio prompt when video completes
  useEffect(() => {
    if (status === "completed" && prompt && !audioPrompt) {
      setAudioPrompt(`Background music for: ${prompt.slice(0, 100)}`);
    }
  }, [status, prompt]);

  const handleClose = () => {
    if (status === "submitting" || status === "processing") return;
    cleanup();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    onOpenChange(false);
    setTimeout(() => {
      setPrompt("");
      setSelectedModel("veo-3.1");
      setDuration("8");
      setStatus("idle");
      setProgress(0);
      setProgressLabel("");
      setVideoUrl(null);
      setSceneUrls([]);
      setCurrentScene(0);
      setWatermarking(false);
      setSavedToLibrary(false);
      setError(null);
      setAudioPrompt("");
      setAudioUrl(null);
      setAudioGenerating(false);
      setAudioPlaying(false);
      setMerging(false);
      jobRef.current = null;
      multiJobsRef.current = null;
      isMultiRef.current = false;
      uploadedSceneUrlsRef.current = {};
      pollCountRef.current = 0;
    }, 300);
  };

  const proxyDownload = async (provider: Provider, jobId: string, remoteVideoUrl?: string): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;

    const downloadUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-video`;
    try {
      const dlResp = await fetch(downloadUrl, {
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

  // ── Multi-scene polling with progressive upload ──
  const pollMultiScene = useCallback(async () => {
    if (!multiJobsRef.current) return;

    pollCountRef.current += 1;
    if (pollCountRef.current > MAX_POLL_COUNT) {
      setError("Multi-scene generation timed out. Please try again.");
      setStatus("failed");
      return;
    }

    try {
      // Convert numeric keys to string keys for JSON
      const existingUrls: Record<string, string> = {};
      for (const [k, v] of Object.entries(uploadedSceneUrlsRef.current)) {
        existingUrls[String(k)] = v;
      }

      const data = await invokeEdgeFunction("generate-video", {
        action: "poll-multi",
        jobIds: multiJobsRef.current,
        existingSceneUrls: existingUrls,
      });

      // Track progressively uploaded scene URLs
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
          } catch (e) {
            console.warn("Watermark failed, using original:", e);
            setVideoUrl(firstUrl);
          }
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
      console.error("Multi poll error:", err);
      setError(err?.message || "Failed to check multi-scene status.");
      setStatus("failed");
    }
  }, []);

  // ── Single clip polling ──
  const pollForResult = useCallback(async () => {
    if (!jobRef.current) return;

    pollCountRef.current += 1;
    if (pollCountRef.current > MAX_POLL_COUNT) {
      setError("Video generation timed out. Please try again.");
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
          const proxied = await proxyDownload(
            jobRef.current.provider,
            jobRef.current.id,
            data.videoUrl,
          );
          finalUrl = proxied || data.videoUrl;
        } else if (data.videoUrl) {
          finalUrl = data.videoUrl;
        }

        if (!finalUrl) {
          setError("Video generated but no URL returned.");
          setStatus("failed");
          return;
        }

        if (brandKit?.logo_url) {
          setWatermarking(true);
          setProgressLabel("Applying logo watermark...");
          try {
            const watermarked = await applyLogoWatermark(finalUrl, brandKit.logo_url, 80);
            setVideoUrl(watermarked);
          } catch (e) {
            console.warn("Watermark failed, using original:", e);
            setVideoUrl(finalUrl);
          }
          setWatermarking(false);
        } else {
          setVideoUrl(finalUrl);
        }

        setSceneUrls([finalUrl]);
        setStatus("completed");
        return;
      }

      if (data.status === "failed") {
        setError(data.error || "Video generation failed.");
        setStatus("failed");
        return;
      }

      if (data.progress != null) {
        setProgress(data.progress);
      } else {
        setProgress((prev) => Math.min(prev + 3, 90));
      }
      pollTimerRef.current = setTimeout(pollForResult, 5000);
    } catch (err: any) {
      console.error("Poll error:", err);
      setError(err?.message || "Failed to check video status.");
      setStatus("failed");
    }
  }, []);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setStatus("submitting");
    setProgress(0);
    setProgressLabel("");
    setError(null);
    setVideoUrl(null);
    setSavedToLibrary(false);
    setAudioUrl(null);
    setAudioPrompt("");
    uploadedSceneUrlsRef.current = {};
    pollCountRef.current = 0;

    const brandedPrompt = prompt.trim();
    const requestedDuration = parseInt(duration);
    const isMultiScene = requestedDuration > currentModel.maxClipDuration;

    isMultiRef.current = isMultiScene;

    try {
      if (isMultiScene) {
        const sceneCount = Math.ceil(requestedDuration / currentModel.maxClipDuration);
        setProgressLabel(`Generating ${sceneCount} scenes...`);

        const data = await invokeEdgeFunction("generate-video", {
          action: "generate-multi",
          provider: currentModel.provider,
          prompt: brandedPrompt,
          duration: requestedDuration,
          model: currentModel.id === "sora-2-pro" ? "sora-2-pro" : "sora-2",
        });

        multiJobsRef.current = data.jobs;
        setStatus("processing");
        setProgress(5);
        setProgressLabel(`Generating ${data.totalScenes} scenes (${data.clipDuration}s each)...`);
        pollTimerRef.current = setTimeout(pollMultiScene, 5000);
      } else {
        const data = await invokeEdgeFunction("generate-video", {
          action: "generate",
          provider: currentModel.provider,
          prompt: brandedPrompt,
          duration: requestedDuration,
          model: currentModel.id === "sora-2-pro" ? "sora-2-pro" : "sora-2",
        });

        jobRef.current = { id: data.jobId, provider: data.provider };
        setStatus("processing");
        setProgress(5);
        setProgressLabel("Generating video...");
        pollTimerRef.current = setTimeout(pollForResult, 5000);
      }
    } catch (err: any) {
      console.error("Generate error:", err);
      setError(err?.message || "Failed to start video generation.");
      setStatus("failed");
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

      const { error } = await supabase.storage
        .from("generated-videos")
        .upload(fileName, blob, { contentType: "video/mp4", upsert: false });

      if (error) throw error;

      setSavedToLibrary(true);
      toast({ title: "Saved!", description: "Video saved to your library" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    }
  };

  const handleReset = () => {
    cleanup();
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
    setAudioPrompt("");
    setAudioGenerating(false);
    setAudioPlaying(false);
    setMerging(false);
    jobRef.current = null;
    multiJobsRef.current = null;
    isMultiRef.current = false;
    uploadedSceneUrlsRef.current = {};
    pollCountRef.current = 0;
  };

  const handleUseVideo = () => {
    if (videoUrl) {
      onVideoReady?.(videoUrl);
      handleClose();
    }
  };

  // ── Audio generation ──
  const handleGenerateAudio = async () => {
    if (!audioPrompt.trim()) return;
    setAudioGenerating(true);
    setAudioUrl(null);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-music`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            prompt: audioPrompt,
            duration: parseInt(audioDuration),
            type: audioType,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `Audio generation failed (${response.status})`);
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      toast({ title: "Audio ready!", description: `${audioType === "music" ? "Music" : "Sound effect"} generated successfully` });
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
      setSavedToLibrary(false); // needs re-saving
      toast({ title: "Merged!", description: "Audio has been added to your video" });
    } catch (err: any) {
      toast({ title: "Merge failed", description: err.message, variant: "destructive" });
    } finally {
      setMerging(false);
    }
  };

  const isGenerating = status === "submitting" || status === "processing" || watermarking;

  const { suggestions: promptSuggestions, isLoading: suggestionsLoading } = useSeoSuggestions("video");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </div>
            AI Video Studio
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="generate" className="flex-1 gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Generate
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
                handleClose();
              }}
            />
          </TabsContent>

          <TabsContent value="generate">
            <div className="space-y-4">
              {/* Idle — input form */}
              {status === "idle" && (
                <>
                  {/* Model selector */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Model</Label>
                    <div className="grid gap-2">
                      {modelOptions.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setSelectedModel(m.id)}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                            selectedModel === m.id
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{m.label}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {m.pricing}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedModel === m.id ? "border-primary" : "border-muted-foreground/30"
                            }`}
                          >
                            {selectedModel === m.id && (
                              <div className="w-2 h-2 rounded-full bg-primary" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prompt */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Describe your video</Label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="A cinematic drone shot over a modern construction site at sunset..."
                      className="min-h-[100px] resize-none"
                    />
                  </div>

                  {/* Quick suggestions */}
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
                            onClick={() => setPrompt(s)}
                            className="text-xs px-2.5 py-1.5 rounded-full border bg-card hover:bg-muted transition-colors text-left leading-tight"
                          >
                            {s.slice(0, 50)}…
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Duration</Label>
                    <Select value={duration} onValueChange={setDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currentModel.durationOptions.map((d) => (
                          <SelectItem key={d.value} value={d.value}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {parseInt(duration) > currentModel.maxClipDuration && (
                      <p className="text-xs text-amber-600">
                        ⚡ Multi-scene: {Math.ceil(parseInt(duration) / currentModel.maxClipDuration)} clips will be generated as separate scenes
                      </p>
                    )}
                  </div>

                  {/* Generate button */}
                  <Button
                    className="w-full gap-2"
                    disabled={!prompt.trim()}
                    onClick={handleGenerate}
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate with {currentModel.label}
                  </Button>
                </>
              )}

              {/* Progress */}
              {isGenerating && (() => {
                const sceneCount = isMultiRef.current
                  ? Math.ceil(parseInt(duration) / currentModel.maxClipDuration)
                  : 1;
                const estPerScene = currentModel.provider === "sora" ? 240 : 120;
                const estTotal = sceneCount * estPerScene;
                const simulated = Math.min(85, (elapsedSecs / estTotal) * 85);
                const displayProgress = Math.max(progress, simulated);
                const mins = Math.floor(elapsedSecs / 60);
                const secs = elapsedSecs % 60;
                const elapsed = mins > 0 ? `${mins}m ${secs.toString().padStart(2, "0")}s` : `${secs}s`;
                const estMins = Math.ceil(estTotal / 60);
                const providerHint = currentModel.provider === "sora"
                  ? `Sora typically takes 3–5 min per scene`
                  : `Veo typically takes 1–2 min per scene`;

                return (
                  <div className="space-y-4 py-6">
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center">
                        <Loader2 className="w-7 h-7 animate-spin text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {status === "submitting"
                            ? "Submitting request…"
                            : isMultiRef.current
                            ? `Generating ${sceneCount} scenes…`
                            : `Generating with ${currentModel.label}…`}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1 animate-pulse">
                          {progressLabel || providerHint}
                        </p>
                      </div>
                    </div>
                    <Progress value={displayProgress} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                      <span>{elapsed} elapsed</span>
                      <span>~{estMins} min estimated</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={() => {
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
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                );
              })()}

              {/* Completed */}
              {status === "completed" && videoUrl && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">
                      {isMultiRef.current ? "Multi-scene video ready!" : `Video generated with ${currentModel.label}!`}
                    </span>
                  </div>

                  <div className="rounded-lg overflow-hidden border bg-black">
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

                  {/* Scene navigation for multi-scene */}
                  {sceneUrls.length > 1 && (
                    <div className="flex items-center gap-2 justify-center">
                      <span className="text-xs text-muted-foreground">
                        Scene {currentScene + 1} of {sceneUrls.length}
                      </span>
                      <div className="flex gap-1">
                        {sceneUrls.map((url, i) => (
                          <button
                            key={i}
                            onClick={() => { setCurrentScene(i); setVideoUrl(url); }}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              i === currentScene ? "bg-primary" : "bg-muted-foreground/30"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Audio Generation Section */}
                  <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Music className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Add Audio / Music</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setAudioType("music")}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          audioType === "music" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                        }`}
                      >
                        🎵 Music
                      </button>
                      <button
                        onClick={() => setAudioType("sfx")}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                          audioType === "sfx" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                        }`}
                      >
                        🔊 Sound Effect
                      </button>
                    </div>

                    <Input
                      value={audioPrompt}
                      onChange={(e) => setAudioPrompt(e.target.value)}
                      placeholder={audioType === "music" ? "Upbeat corporate background music..." : "Construction machinery ambient sounds..."}
                      className="text-sm"
                    />

                    {audioType === "music" && (
                      <Select value={audioDuration} onValueChange={setAudioDuration}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 seconds</SelectItem>
                          <SelectItem value="15">15 seconds</SelectItem>
                          <SelectItem value="30">30 seconds</SelectItem>
                          <SelectItem value="60">60 seconds</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5"
                        disabled={!audioPrompt.trim() || audioGenerating}
                        onClick={handleGenerateAudio}
                      >
                        {audioGenerating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Music className="w-3.5 h-3.5" />
                        )}
                        {audioGenerating ? "Generating..." : "Generate Audio"}
                      </Button>
                    </div>

                    {/* Audio preview + merge */}
                    {audioUrl && (
                      <div className="flex items-center gap-2 p-2 rounded bg-background border">
                        <Button size="sm" variant="ghost" onClick={toggleAudioPlayback} className="h-8 w-8 p-0">
                          <Volume2 className={`w-4 h-4 ${audioPlaying ? "text-primary" : ""}`} />
                        </Button>
                        <span className="text-xs text-muted-foreground flex-1">
                          {audioPlaying ? "Playing..." : "Audio ready"}
                        </span>
                        <Button
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          disabled={merging}
                          onClick={handleMergeAudioVideo}
                        >
                          {merging ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          {merging ? "Merging..." : "Add to Video"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                          <a href={audioUrl} download="audio.mp3">
                            <Download className="w-3 h-3" />
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button className="flex-1 gap-2" onClick={handleUseVideo}>
                      <Video className="w-4 h-4" />
                      Use in Post
                    </Button>
                    {!savedToLibrary && (
                      <Button variant="outline" onClick={handleSaveToLibrary} className="gap-1.5">
                        <Save className="w-4 h-4" />
                        Save
                      </Button>
                    )}
                    {savedToLibrary && (
                      <Button variant="outline" disabled className="gap-1.5 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                        Saved
                      </Button>
                    )}
                    <Button variant="outline" asChild>
                      <a href={videoUrl} download target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button variant="outline" onClick={handleReset}>
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Error */}
              {status === "failed" && (
                <div className="space-y-4 py-4">
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                    <p className="text-sm font-medium text-destructive">{error}</p>
                  </div>
                  <Button variant="outline" className="w-full gap-2" onClick={handleReset}>
                    <RotateCcw className="w-4 h-4" />
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
