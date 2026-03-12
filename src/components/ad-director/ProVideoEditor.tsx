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
  FolderOpen, Video, Type, Film, ImagePlus, LayoutTemplate, Shapes, ArrowRightLeft, Palette, Settings,
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
import { RecordTab } from "./editor/RecordTab";
import { TextTab } from "./editor/TextTab";
import { StockVideoTab } from "./editor/StockVideoTab";
import { StockImagesTab } from "./editor/StockImagesTab";
import { TemplatesTab } from "./editor/TemplatesTab";
import { GraphicsTab } from "./editor/GraphicsTab";
import { TransitionsTab } from "./editor/TransitionsTab";
import { BrandKitTab } from "./editor/BrandKitTab";
import { supabase } from "@/integrations/supabase/client";

type EditorTab = "media" | "record" | "text" | "music" | "stock-video" | "stock-images" | "templates" | "graphics" | "transitions" | "brand-kit" | "script" | "settings";

const TABS: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
  { id: "media", label: "My Media", icon: <FolderOpen className="w-4 h-4" /> },
  { id: "record", label: "Record", icon: <Video className="w-4 h-4" /> },
  { id: "text", label: "Text", icon: <Type className="w-4 h-4" /> },
  { id: "music", label: "Music", icon: <Music className="w-4 h-4" /> },
  { id: "stock-video", label: "Stock Video", icon: <Film className="w-4 h-4" /> },
  { id: "stock-images", label: "Stock Images", icon: <ImagePlus className="w-4 h-4" /> },
  { id: "templates", label: "Templates", icon: <LayoutTemplate className="w-4 h-4" /> },
  { id: "graphics", label: "Graphics", icon: <Shapes className="w-4 h-4" /> },
  { id: "transitions", label: "Transitions", icon: <ArrowRightLeft className="w-4 h-4" /> },
  { id: "brand-kit", label: "Brand Kit", icon: <Palette className="w-4 h-4" /> },
  { id: "script", label: "Script", icon: <FileText className="w-4 h-4" /> },
  { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
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
  onUpdateSegmentTiming?: (id: string, startTime: number, endTime: number) => void;
  onUpdateStoryboard?: (storyboard: StoryboardScene[]) => void;
  onUpdateBrand?: (brand: BrandProfile) => void;
  onMusicSelect?: (url: string | null) => void;
}

export function ProVideoEditor({
  clips, storyboard, segments, brand,
  finalVideoUrl, onBack, onExport, exporting,
  onRegenerateScene, onUpdateClipUrl, onUpdateSegment, onUpdateSegmentTiming,
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
  const [videoVolume, setVideoVolume] = useState(1);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [mutedScenes, setMutedScenes] = useState<Set<string>>(new Set());

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

  // Auto-seed text overlays from script segments
  useEffect(() => {
    if (storyboard.length === 0 || segments.length === 0) return;
    const newOverlays: VideoOverlay[] = [];
    for (const scene of storyboard) {
      const seg = segments.find(s => s.id === scene.segmentId);
      if (!seg?.text?.trim()) continue;
      const hasText = overlays.some(o => o.sceneId === scene.id && o.kind === "text");
      if (!hasText) {
        newOverlays.push({
          id: crypto.randomUUID(),
          kind: "text",
          position: { x: 10, y: 80 },
          size: { w: 80, h: 15 },
          content: seg.text,
          opacity: 0.95,
          sceneId: scene.id,
          animated: true,
        });
      }
    }
    if (newOverlays.length > 0) setOverlays(prev => [...prev, ...newOverlays]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyboard.length, segments]);

  // Auto-generate voiceovers on mount
  const voiceoverGenerated = useRef(false);
  useEffect(() => {
    if (voiceoverGenerated.current || segments.length === 0) return;
    if (audioTracks.some(a => a.kind === "voiceover")) return;
    voiceoverGenerated.current = true;
    generateAllVoiceovers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.length]);

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

  // Sync voiceover audio with video playback (time-locked)
  useEffect(() => {
    const sceneId = storyboard[selectedSceneIndex]?.id;
    // Skip voiceover if scene is muted
    if (sceneId && mutedScenes.has(sceneId)) {
      return;
    }
    const vo = audioTracks.find(a => a.kind === "voiceover" && a.sceneId === sceneId);
    if (vo && isPlaying && !isMuted) {
      const a = new Audio(vo.audioUrl);
      a.currentTime = videoRef.current?.currentTime ?? 0;
      a.play().catch(() => {});
      audioRef.current = a;

      // Keep voiceover in sync with video time
      const syncHandler = () => {
        if (audioRef.current && videoRef.current) {
          const drift = Math.abs(audioRef.current.currentTime - videoRef.current.currentTime);
          if (drift > 0.3) {
            audioRef.current.currentTime = videoRef.current.currentTime;
          }
        }
      };
      const vid = videoRef.current;
      vid?.addEventListener("timeupdate", syncHandler);
      return () => {
        vid?.removeEventListener("timeupdate", syncHandler);
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
      };
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSceneIndex, isPlaying, isMuted, mutedScenes]);

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

  // Apply videoVolume and mute state to the video element
  useEffect(() => {
    if (videoRef.current) {
      const sceneId = storyboard[selectedSceneIndex]?.id;
      const isMutedScene = sceneId ? mutedScenes.has(sceneId) : false;
      videoRef.current.volume = isMutedScene ? 0 : videoVolume;
    }
  }, [videoVolume, selectedSceneIndex, mutedScenes, storyboard]);

  // Apply per-track volume to voiceover audio
  useEffect(() => {
    if (audioRef.current) {
      const sceneId = storyboard[selectedSceneIndex]?.id;
      const vo = audioTracks.find(a => a.kind === "voiceover" && a.sceneId === sceneId);
      if (vo) audioRef.current.volume = vo.volume ?? 1;
    }
  }, [audioTracks, selectedSceneIndex, storyboard]);

  const handleVideoVolumeChange = useCallback((v: number) => {
    setVideoVolume(v);
  }, []);

  const handleAudioTrackVolumeChange = useCallback((index: number, v: number) => {
    setAudioTracks(prev => prev.map((t, i) => i === index ? { ...t, volume: v } : t));
  }, []);

  const handleRemoveAudioTrack = useCallback((index: number) => {
    setAudioTracks(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDeleteOverlay = useCallback((id: string) => {
    setOverlays(prev => prev.filter(o => o.id !== id));
  }, []);


  const handleTrimScene = useCallback((index: number) => {
    const scene = storyboard[index];
    if (!scene) return;
    const seg = segments.find(s => s.id === scene.segmentId);
    if (!seg || (seg.endTime - seg.startTime) <= 1) {
      toast({ title: "Cannot trim", description: "Scene is already at minimum duration", variant: "destructive" });
      return;
    }
    pushHistory(storyboard);
    onUpdateSegmentTiming?.(seg.id, seg.startTime, seg.endTime - 1);
    toast({ title: "Scene trimmed", description: `Scene ${index + 1} shortened by 1s` });
  }, [storyboard, segments, toast, pushHistory, onUpdateSegmentTiming]);

  const handleStretchScene = useCallback((index: number) => {
    const scene = storyboard[index];
    if (!scene) return;
    const seg = segments.find(s => s.id === scene.segmentId);
    if (!seg) return;
    pushHistory(storyboard);
    onUpdateSegmentTiming?.(seg.id, seg.startTime, seg.endTime + 1);
    toast({ title: "Scene stretched", description: `Scene ${index + 1} extended by 1s` });
  }, [storyboard, segments, toast, pushHistory, onUpdateSegmentTiming]);

  const handleResizeScene = useCallback((index: number, newDuration: number) => {
    const scene = storyboard[index];
    if (!scene) return;
    const seg = segments.find(s => s.id === scene.segmentId);
    if (!seg) return;
    const clamped = Math.max(1, Math.round(newDuration * 10) / 10);
    pushHistory(storyboard);
    onUpdateSegmentTiming?.(seg.id, seg.startTime, seg.startTime + clamped);
  }, [storyboard, segments, pushHistory, onUpdateSegmentTiming]);

  const handleSplitScene = useCallback((index: number) => {
    const scene = storyboard[index];
    if (!scene) return;
    const seg = segments.find(s => s.id === scene.segmentId);
    if (!seg) return;
    const midTime = (seg.startTime + seg.endTime) / 2;
    const newSceneId = crypto.randomUUID();
    const newSegId = crypto.randomUUID();
    const newScene: StoryboardScene = {
      ...scene,
      id: newSceneId,
      segmentId: newSegId,
    };
    pushHistory(storyboard);
    const updated = [...storyboard];
    updated.splice(index + 1, 0, newScene);
    onUpdateStoryboard?.(updated);
    toast({ title: "Scene split", description: `Scene ${index + 1} divided at ${midTime.toFixed(1)}s` });
  }, [storyboard, segments, pushHistory, onUpdateStoryboard, toast]);

  const handleDuplicateScene = useCallback((index: number) => {
    const scene = storyboard[index];
    if (!scene) return;
    const newScene: StoryboardScene = { ...scene, id: crypto.randomUUID() };
    pushHistory(storyboard);
    const updated = [...storyboard];
    updated.splice(index + 1, 0, newScene);
    onUpdateStoryboard?.(updated);
    toast({ title: "Scene duplicated" });
  }, [storyboard, pushHistory, onUpdateStoryboard, toast]);

  const handleMoveScene = useCallback((index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= storyboard.length) return;
    pushHistory(storyboard);
    const updated = [...storyboard];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    onUpdateStoryboard?.(updated);
    setSelectedSceneIndex(target);
    toast({ title: "Scene moved" });
  }, [storyboard, pushHistory, onUpdateStoryboard, toast]);

  const handleEditPrompt = useCallback((index: number) => {
    setSelectedSceneIndex(index);
    setActiveTab("media");
    if (sidebarCollapsed) setSidebarCollapsed(false);
  }, [sidebarCollapsed]);

  const handleEditVoiceover = useCallback((index: number) => {
    setSelectedSceneIndex(index);
    setActiveTab("script");
    if (sidebarCollapsed) setSidebarCollapsed(false);
  }, [sidebarCollapsed]);

  const handleMuteScene = useCallback((index: number) => {
    const sceneId = storyboard[index]?.id;
    if (!sceneId) return;
    setMutedScenes(prev => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId); else next.add(sceneId);
      return next;
    });
    toast({ title: mutedScenes.has(storyboard[index]?.id) ? "Scene unmuted" : "Scene muted" });
  }, [storyboard, mutedScenes, toast]);

  const handleDeleteScene = useCallback((index: number) => {
    if (storyboard.length <= 1) {
      toast({ title: "Cannot delete", description: "At least one scene required", variant: "destructive" });
      return;
    }
    pushHistory(storyboard);
    const updated = storyboard.filter((_, i) => i !== index);
    onUpdateStoryboard?.(updated);
    if (selectedSceneIndex >= updated.length) setSelectedSceneIndex(updated.length - 1);
    toast({ title: "Scene deleted" });
  }, [storyboard, pushHistory, onUpdateStoryboard, selectedSceneIndex, toast]);

  const handleEditOverlayPosition = useCallback((id: string, position: "top" | "center" | "bottom") => {
    const posMap = { top: { x: 25, y: 5 }, center: { x: 25, y: 45 }, bottom: { x: 25, y: 85 } };
    setOverlays(prev => prev.map(o => o.id === id ? { ...o, position: posMap[position] } : o));
  }, []);

  const handleResizeOverlay = useCallback((id: string, size: "small" | "medium" | "large") => {
    const sizeMap = { small: { w: 30, h: 8 }, medium: { w: 50, h: 10 }, large: { w: 80, h: 15 } };
    setOverlays(prev => prev.map(o => o.id === id ? { ...o, size: sizeMap[size] } : o));
  }, []);

  const handleToggleOverlayAnimation = useCallback((id: string) => {
    setOverlays(prev => prev.map(o => o.id === id ? { ...o, animated: !o.animated } : o));
  }, []);

  const handleReRecordVoiceover = useCallback(async (sceneId: string) => {
    const scene = storyboard.find(s => s.id === sceneId);
    if (!scene) return;
    const seg = segments.find(s => s.id === scene.segmentId);
    if (!seg?.text?.trim()) return;
    toast({ title: "Re-recording voiceover…" });
    try {
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
      if (!response.ok) throw new Error(`TTS failed: ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioTracks(prev => prev.map(t =>
        t.kind === "voiceover" && t.sceneId === sceneId ? { ...t, audioUrl: url } : t
      ));
      toast({ title: "Voiceover re-recorded" });
    } catch (err: any) {
      toast({ title: "Re-record failed", description: err.message, variant: "destructive" });
    }
  }, [storyboard, segments, toast]);

  const handleEditVoiceoverText = useCallback((sceneId: string) => {
    const sceneIdx = storyboard.findIndex(s => s.id === sceneId);
    if (sceneIdx >= 0) {
      setSelectedSceneIndex(sceneIdx);
      setActiveTab("script");
      if (sidebarCollapsed) setSidebarCollapsed(false);
    }
  }, [storyboard, sidebarCollapsed]);

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

  // ─── Auto-advance on video end with fade transition ───
  const [sceneTransition, setSceneTransition] = useState(false);

  const handleVideoEnded = () => {
    const completedIndices = storyboard
      .map((s, i) => ({ i, clip: clips.find(c => c.sceneId === s.id) }))
      .filter(x => x.clip?.status === "completed" && x.clip?.videoUrl)
      .map(x => x.i);

    const nextIdx = completedIndices.find(i => i > selectedSceneIndex);
    if (nextIdx !== undefined) {
      // Fade out current scene
      setSceneTransition(true);
      setTimeout(() => {
        autoPlayPending.current = true;
        setSelectedSceneIndex(nextIdx);
        // Fade in next scene
        setTimeout(() => setSceneTransition(false), 50);
      }, 300);
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
                  className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${sceneTransition ? "opacity-0" : "opacity-100"}`}
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
        videoVolume={videoVolume}
        onVideoVolumeChange={handleVideoVolumeChange}
        onAudioTrackVolumeChange={handleAudioTrackVolumeChange}
        onDeleteOverlay={handleDeleteOverlay}
        onRemoveAudioTrack={handleRemoveAudioTrack}
        onRegenerateScene={onRegenerateScene}
        onDeleteScene={handleDeleteScene}
        onTrimScene={handleTrimScene}
        onStretchScene={handleStretchScene}
        onSplitScene={handleSplitScene}
        onDuplicateScene={handleDuplicateScene}
        onMoveScene={handleMoveScene}
        onEditPrompt={handleEditPrompt}
        onEditVoiceover={handleEditVoiceover}
        onMuteScene={handleMuteScene}
        onResizeScene={handleResizeScene}
        mutedScenes={mutedScenes}
        onEditOverlayPosition={handleEditOverlayPosition}
        onResizeOverlay={handleResizeOverlay}
        onToggleOverlayAnimation={handleToggleOverlayAnimation}
        onReRecordVoiceover={handleReRecordVoiceover}
        onEditVoiceoverText={handleEditVoiceoverText}
        onEditOverlay={(ov) => {
          const newText = prompt("Edit overlay text:", ov.content);
          if (newText !== null) setOverlays(prev => prev.map(o => o.id === ov.id ? { ...o, content: newText } : o));
        }}
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
