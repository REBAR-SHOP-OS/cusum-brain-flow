import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import {
  Play, Pause, Volume2, VolumeX, Maximize2,
  Sparkles, Send, Download, ArrowLeft, Undo2, Redo2, RotateCcw,
  Image, Music, FileText, Sliders, ImageIcon, Loader2,
  SkipBack, SkipForward, ChevronRight, ChevronLeft,
} from "lucide-react";
import type { StoryboardScene, ClipOutput, ScriptSegment, BrandProfile } from "@/types/adDirector";
import type { VideoOverlay } from "@/types/videoOverlay";
import { type EditorSettings, type LogoSettings, DEFAULT_EDITOR_SETTINGS, DEFAULT_LOGO_SETTINGS } from "@/types/editorSettings";
import { MediaTab } from "./editor/MediaTab";
import { MusicTab } from "./editor/MusicTab";
import { ScriptTab } from "./editor/ScriptTab";
import { SettingsTab } from "./editor/SettingsTab";
import { LogoTab } from "./editor/LogoTab";
import { TimelineBar, type AudioTrackItem } from "./editor/TimelineBar";
import { EffectsPanel } from "./editor/EffectsPanel";
import { TextOverlayDialog } from "./editor/TextOverlayDialog";
import { supabase } from "@/integrations/supabase/client";

type EditorTab = "media" | "music" | "script" | "settings" | "logo";

const TABS: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
  { id: "media", label: "Media", icon: <Image className="w-4 h-4" /> },
  { id: "music", label: "Music", icon: <Music className="w-4 h-4" /> },
  { id: "script", label: "Script", icon: <FileText className="w-4 h-4" /> },
  { id: "settings", label: "Settings", icon: <Sliders className="w-4 h-4" /> },
  { id: "logo", label: "Logo", icon: <ImageIcon className="w-4 h-4" /> },
];

interface ProVideoEditorProps {
  clips: ClipOutput[];
  storyboard: StoryboardScene[];
  segments: ScriptSegment[];
  brand: BrandProfile;
  finalVideoUrl: string | null;
  onBack: () => void;
  onExport: () => void;
  exporting: boolean;
  onRegenerateScene?: (sceneId: string) => void;
  onUpdateClipUrl?: (sceneId: string, url: string) => void;
  onUpdateSegment?: (id: string, text: string) => void;
  onUpdateStoryboard?: (storyboard: StoryboardScene[]) => void;
  onUpdateBrand?: (brand: BrandProfile) => void;
  onMusicSelect?: (url: string | null) => void;
}

export function ProVideoEditor({
  clips, storyboard, segments, brand,
  finalVideoUrl, onBack, onExport, exporting,
  onRegenerateScene, onUpdateClipUrl, onUpdateSegment,
  onUpdateStoryboard, onUpdateBrand, onMusicSelect,
}: ProVideoEditorProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("media");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [aiCommand, setAiCommand] = useState("");
  const [aiProcessing, setAiProcessing] = useState(false);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS);
  const [logoSettings, setLogoSettings] = useState<LogoSettings>(DEFAULT_LOGO_SETTINGS);
  const [overlays, setOverlays] = useState<VideoOverlay[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioTrackItem[]>([]);
  const [generatingVoiceovers, setGeneratingVoiceovers] = useState(false);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);

  // ─── Global timeline ───
  const sceneDurations = useMemo(() => {
    return storyboard.map((scene, i) => {
      const seg = segments.find(s => s.id === scene.segmentId);
      return seg ? seg.endTime - seg.startTime : 4;
    });
  }, [storyboard, segments]);

  const cumulativeStarts = useMemo(() => {
    const starts: number[] = [0];
    for (let i = 0; i < sceneDurations.length - 1; i++) {
      starts.push(starts[i] + sceneDurations[i]);
    }
    return starts;
  }, [sceneDurations]);

  const totalDuration = useMemo(() => sceneDurations.reduce((a, b) => a + b, 0), [sceneDurations]);

  const globalTime = (cumulativeStarts[selectedSceneIndex] || 0) + currentTime;

  // Auto-seed mandatory logo overlays for intro/outro scenes
  useEffect(() => {
    if (!brand.logoUrl || storyboard.length === 0 || segments.length === 0) return;
    const introOutroScenes = storyboard.filter(scene => {
      const seg = segments.find(s => s.id === scene.segmentId);
      if (!seg) return false;
      const lbl = seg.label.toLowerCase();
      return lbl.includes("intro") || lbl.includes("hook") || lbl.includes("end card") || lbl.includes("closing") || lbl.includes("outro");
    });
    const newOverlays: VideoOverlay[] = [];
    for (const scene of introOutroScenes) {
      const hasLogo = overlays.some(o => o.sceneId === scene.id && o.kind === "logo");
      if (!hasLogo) {
        newOverlays.push({
          id: crypto.randomUUID(),
          kind: "logo",
          position: { x: 35, y: 40 },
          size: { w: 30, h: 20 },
          content: brand.logoUrl,
          opacity: 0.9,
          sceneId: scene.id,
          animated: true,
        });
      }
    }
    if (newOverlays.length > 0) {
      setOverlays(prev => [...prev, ...newOverlays]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyboard.length, brand.logoUrl]);

  // Apply speed to video
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  // Auto-play after scene change
  const autoPlayPending = useRef(false);
  useEffect(() => {
    if (autoPlayPending.current && videoRef.current) {
      videoRef.current.play().catch(() => {});
      autoPlayPending.current = false;
    }
  }, [selectedSceneIndex]);

  // Sync voiceover audio with playback
  useEffect(() => {
    const sceneId = storyboard[selectedSceneIndex]?.id;
    const vo = audioTracks.find(a => a.kind === "voiceover" && a.sceneId === sceneId);
    if (vo && isPlaying && !isMuted) {
      const a = new Audio(vo.audioUrl);
      a.play().catch(() => {});
      audioRef.current = a;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneIndex, isPlaying, isMuted]);

  // Undo/Redo history
  const [history, setHistory] = useState<StoryboardScene[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pushHistory = useCallback((newStoryboard: StoryboardScene[]) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newStoryboard]);
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      onUpdateStoryboard?.(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      onUpdateStoryboard?.(history[historyIndex + 1]);
    }
  };

  const resetAll = () => {
    if (history.length > 0) {
      onUpdateStoryboard?.(history[0]);
      setHistoryIndex(0);
      toast({ title: "All edits reset" });
    }
  };

  // Pick the video to show
  const selectedClip = clips.find(c => c.sceneId === storyboard[selectedSceneIndex]?.id);
  const videoSrc = finalVideoUrl || selectedClip?.videoUrl || null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause(); else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoaded = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  // ─── Auto-advance on video end ───
  const handleVideoEnded = () => {
    // Find the next completed clip
    const completedIndices = storyboard
      .map((s, i) => ({ i, clip: clips.find(c => c.sceneId === s.id) }))
      .filter(x => x.clip?.status === "completed" && x.clip?.videoUrl)
      .map(x => x.i);

    const nextIdx = completedIndices.find(i => i > selectedSceneIndex);
    if (nextIdx !== undefined) {
      autoPlayPending.current = true;
      setSelectedSceneIndex(nextIdx);
    } else {
      setIsPlaying(false);
    }
  };

  // ─── Global seek from timeline ───
  const handleGlobalSeek = (globalTimeSec: number) => {
    // Find which scene this falls into
    let targetScene = 0;
    for (let i = 0; i < cumulativeStarts.length; i++) {
      if (globalTimeSec >= cumulativeStarts[i]) targetScene = i;
      else break;
    }
    const offset = globalTimeSec - cumulativeStarts[targetScene];
    setSelectedSceneIndex(targetScene);
    // Defer seek until video loads the new source
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.min(offset, videoRef.current.duration || offset);
      }
    }, 100);
  };

  const seekTo = (pct: number) => {
    if (videoRef.current && duration > 0) {
      videoRef.current.currentTime = (pct / 100) * duration;
    }
  };

  const skipScene = (dir: -1 | 1) => {
    const next = selectedSceneIndex + dir;
    if (next >= 0 && next < storyboard.length) setSelectedSceneIndex(next);
  };

  // ─── Generate all voiceovers ───
  const generateAllVoiceovers = async () => {
    setGeneratingVoiceovers(true);
    const newTracks: AudioTrackItem[] = [];
    try {
      for (const seg of segments) {
        if (!seg.text.trim()) continue;
        const scene = storyboard.find(s => s.segmentId === seg.id);
        if (!scene) continue;

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ text: seg.text }),
          }
        );
        if (!response.ok) throw new Error(`TTS failed for ${seg.label}`);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        newTracks.push({ sceneId: scene.id, label: seg.label, audioUrl: url, kind: "voiceover" });
      }
      // Replace voiceover tracks, keep music
      setAudioTracks(prev => [...prev.filter(a => a.kind !== "voiceover"), ...newTracks]);
      toast({ title: "Voiceovers generated", description: `${newTracks.length} audio tracks created` });
    } catch (err: any) {
      toast({ title: "Voiceover generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingVoiceovers(false);
    }
  };

  // Handle music selection — also add to audio tracks
  const handleMusicSelect = (url: string | null) => {
    setMusicUrl(url);
    onMusicSelect?.(url);
    setAudioTracks(prev => {
      const withoutMusic = prev.filter(a => a.kind !== "music");
      if (url) {
        return [...withoutMusic, { sceneId: "", label: "Music", audioUrl: url, kind: "music" as const }];
      }
      return withoutMusic;
    });
  };

  // AI Command Bar
  const handleAiSubmit = async () => {
    if (!aiCommand.trim() || aiProcessing) return;
    const scene = storyboard[selectedSceneIndex];
    if (!scene) return;

    setAiProcessing(true);
    try {
      const result = await invokeEdgeFunction<any>(
        "edit-video-prompt",
        { originalPrompt: scene.prompt, editAction: "custom", editDetail: aiCommand }
      );

      if (result.type === "overlay") {
        const overlay = result.overlay as { kind: string; position: string; size: string; content: string; animated?: boolean };
        const posMap: Record<string, { x: number; y: number }> = {
          "top-left": { x: 5, y: 5 }, "top-right": { x: 80, y: 5 },
          "bottom-left": { x: 5, y: 80 }, "bottom-right": { x: 80, y: 80 },
          "center": { x: 40, y: 40 },
        };
        const sizeMap: Record<string, { w: number; h: number }> = {
          small: { w: 10, h: 10 }, medium: { w: 15, h: 15 }, large: { w: 25, h: 25 },
        };
        const content = overlay.content === "brand_logo" && brand.logoUrl ? brand.logoUrl : overlay.content;
        const newOverlay: VideoOverlay = {
          id: crypto.randomUUID(),
          kind: (overlay.kind as VideoOverlay["kind"]) || "logo",
          position: posMap[overlay.position] || posMap["bottom-right"],
          size: sizeMap[overlay.size] || sizeMap["medium"],
          content,
          opacity: 0.85,
          sceneId: scene.id,
          animated: overlay.animated || false,
        };
        setOverlays(prev => [...prev, newOverlay]);
        toast({ title: "Overlay added", description: `${overlay.kind} overlay applied${overlay.animated ? " with animation" : ""}.` });
      } else {
        const newPrompt = result.editedPrompt;
        if (typeof newPrompt === "string" && newPrompt.length > 0) {
          pushHistory(storyboard);
          const updated = storyboard.map((s, i) =>
            i === selectedSceneIndex ? { ...s, prompt: newPrompt, promptQuality: undefined } : s
          );
          onUpdateStoryboard?.(updated);
          onRegenerateScene?.(scene.id);
          toast({ title: "Regenerating scene", description: "AI is applying your edit…" });
        }
      }
      setAiCommand("");
    } catch (err: any) {
      toast({ title: "AI edit failed", description: err.message, variant: "destructive" });
    } finally {
      setAiProcessing(false);
    }
  };

  // Overlays for current scene
  const currentSceneId = storyboard[selectedSceneIndex]?.id;
  const sceneOverlays = overlays.filter(o => o.sceneId === currentSceneId);
  const textOverlays = overlays.filter(o => o.kind === "text");

  // Logo handlers
  const handleDeleteLogo = () => onUpdateBrand?.({ ...brand, logoUrl: null });

  const handleReplaceLogo = async (file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `${user.id}/logo-${Date.now()}.${file.name.split('.').pop()}`;
      const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);
      onUpdateBrand?.({ ...brand, logoUrl: data.publicUrl });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] rounded-xl border border-border/30 overflow-hidden bg-background">
      {/* ─── Top Bar ─── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-card/80 shrink-0">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 h-7 px-2 text-xs">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Button>

        <div className="flex items-center gap-1 ml-2">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={undo} disabled={historyIndex <= 0} title="Undo">
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo">
            <Redo2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={resetAll} title="Reset all">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Generate Voiceovers button */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[10px] gap-1 ml-2"
          onClick={generateAllVoiceovers}
          disabled={generatingVoiceovers || segments.length === 0}
        >
          {generatingVoiceovers ? <Loader2 className="w-3 h-3 animate-spin" /> : <Music className="w-3 h-3" />}
          {generatingVoiceovers ? "Generating…" : "Auto Voiceover"}
        </Button>

        <div className="flex-1" />

        <Badge variant="secondary" className="text-[9px]">Pro Editor</Badge>

        <Button
          size="sm"
          className="gap-1.5 text-xs h-7 bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-400"
          onClick={onExport}
          disabled={exporting || clips.every(c => c.status !== "completed")}
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? "Exporting…" : "Export"}
        </Button>
      </div>

      {/* ─── Main 3-Panel Area ─── */}
      <div className="flex flex-1 min-h-0">
        {/* ─── Left Sidebar ─── */}
        <div className={`flex shrink-0 border-r border-border/30 bg-card/60 transition-all ${sidebarCollapsed ? "w-12" : "w-60"}`}>
          {/* Icon strip */}
          <div className="w-12 shrink-0 flex flex-col items-center py-2 gap-1 border-r border-border/20">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); if (sidebarCollapsed) setSidebarCollapsed(false); }}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors
                  ${activeTab === tab.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}
                title={tab.label}
              >
                {tab.icon}
              </button>
            ))}
            <div className="flex-1" />
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/30"
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Tab content */}
          {!sidebarCollapsed && (
            <div className="flex-1 overflow-y-auto p-3 min-w-0">
              <h3 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                {TABS.find(t => t.id === activeTab)?.label}
              </h3>
              {activeTab === "media" && (
                <MediaTab
                  storyboard={storyboard}
                  clips={clips}
                  segments={segments}
                  selectedSceneIndex={selectedSceneIndex}
                  onSelectScene={setSelectedSceneIndex}
                  onRegenerateScene={onRegenerateScene}
                  onUpdateClipUrl={onUpdateClipUrl}
                />
              )}
              {activeTab === "music" && (
                <MusicTab onTrackSelect={(track) => handleMusicSelect(track?.url ?? null)} />
              )}
              {activeTab === "script" && <ScriptTab segments={segments} onUpdateSegment={onUpdateSegment} />}
              {activeTab === "settings" && <SettingsTab settings={editorSettings} onChange={setEditorSettings} />}
              {activeTab === "logo" && (
                <LogoTab
                  logo={logoSettings}
                  brand={brand}
                  onChange={setLogoSettings}
                  onDeleteLogo={handleDeleteLogo}
                  onReplaceLogo={handleReplaceLogo}
                />
              )}
            </div>
          )}
        </div>

        {/* ─── Center Canvas ─── */}
        <div className="flex-1 flex flex-col min-w-0 bg-black/90 relative">
          {/* AI Command Bar — floating at top */}
          <div className="absolute top-3 left-3 right-3 z-30 flex gap-2 items-center p-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10">
            {aiProcessing ? (
              <Loader2 className="w-4 h-4 text-primary shrink-0 animate-spin ml-1.5" />
            ) : (
              <Sparkles className="w-4 h-4 text-primary shrink-0 ml-1.5" />
            )}
            <Input
              value={aiCommand}
              onChange={e => setAiCommand(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAiSubmit()}
              placeholder="AI: Edit this scene…"
              className="border-0 bg-transparent h-7 text-xs text-white placeholder:text-white/40 focus-visible:ring-0 shadow-none"
              disabled={aiProcessing}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-white/70 hover:text-white"
              onClick={handleAiSubmit}
              disabled={!aiCommand.trim() || aiProcessing}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Video */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            {videoSrc ? (
              <>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className="max-w-full max-h-full object-contain"
                  muted={isMuted}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoaded}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={handleVideoEnded}
                />
                {brand.logoUrl && (
                  <img
                    src={brand.logoUrl}
                    alt="Brand watermark"
                    className="absolute bottom-14 right-4 h-10 w-auto object-contain opacity-70 pointer-events-none z-10"
                  />
                )}
                {sceneOverlays.map(ov => (
                  <div
                    key={ov.id}
                    className={`absolute pointer-events-none z-20 ${ov.animated ? "animate-logo-reveal" : ""}`}
                    style={{
                      left: `${ov.position.x}%`,
                      top: `${ov.position.y}%`,
                      width: `${ov.size.w}%`,
                      opacity: ov.opacity,
                    }}
                  >
                    {ov.kind === "logo" ? (
                      <img src={ov.content} alt="Overlay" className="w-full h-auto object-contain" />
                    ) : (
                      <span className="text-white font-bold text-sm drop-shadow-lg bg-black/40 px-2 py-1 rounded">
                        {ov.content}
                      </span>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center space-y-3">
                <span className="text-sm text-muted-foreground">No video — generate scenes first</span>
                <Button variant="outline" size="sm" onClick={onBack}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Storyboard
                </Button>
              </div>
            )}
          </div>

          {/* Playback Controls */}
          {videoSrc && (
            <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-black/70 backdrop-blur-sm border-t border-white/5">
              <button onClick={() => skipScene(-1)} className="text-white/60 hover:text-white" disabled={selectedSceneIndex === 0}>
                <SkipBack className="w-4 h-4" />
              </button>
              <button onClick={togglePlay} className="text-white/90 hover:text-white">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button onClick={() => skipScene(1)} className="text-white/60 hover:text-white" disabled={selectedSceneIndex >= storyboard.length - 1}>
                <SkipForward className="w-4 h-4" />
              </button>

              <span className="text-white/50 text-[10px] font-mono min-w-[60px]">
                {formatTime(globalTime)} / {formatTime(totalDuration)}
              </span>

              {/* Scrub bar */}
              <div
                className="flex-1 h-1 bg-white/20 rounded-full cursor-pointer group relative"
                onClick={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  seekTo(((e.clientX - rect.left) / rect.width) * 100);
                }}
              >
                <div
                  className="h-full bg-primary rounded-full transition-all relative"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              <button onClick={toggleMute} className="text-white/60 hover:text-white">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => videoRef.current?.requestFullscreen?.()}
                className="text-white/60 hover:text-white"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ─── Right Panel ─── */}
        {rightPanelOpen && (
          <div className="w-56 shrink-0 border-l border-border/30 bg-card/60 overflow-y-auto">
            <EffectsPanel
              fadeIn={fadeIn}
              fadeOut={fadeOut}
              speed={speed}
              onFadeInChange={setFadeIn}
              onFadeOutChange={setFadeOut}
              onSpeedChange={setSpeed}
            />
          </div>
        )}
      </div>

      {/* ─── Bottom Timeline ─── */}
      <TimelineBar
        clips={clips}
        storyboard={storyboard}
        segments={segments}
        globalTime={globalTime}
        totalDuration={totalDuration}
        cumulativeStarts={cumulativeStarts}
        selectedSceneIndex={selectedSceneIndex}
        onSeek={handleGlobalSeek}
        onSelectScene={setSelectedSceneIndex}
        onAddText={() => setTextDialogOpen(true)}
        onAddAudio={generateAllVoiceovers}
        textOverlays={textOverlays}
        audioTracks={audioTracks}
      />

      {/* Text Overlay Dialog */}
      <TextOverlayDialog
        open={textDialogOpen}
        onClose={() => setTextDialogOpen(false)}
        storyboard={storyboard}
        segments={segments}
        selectedSceneIndex={selectedSceneIndex}
        onAdd={(overlay) => setOverlays(prev => [...prev, overlay])}
      />
    </div>
  );
}
