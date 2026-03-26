import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import {
  Play, Pause, Volume2, VolumeX, Maximize2,
  Sparkles, Send, Download, ArrowLeft, Undo2, Redo2, RotateCcw,
  Music, FileText, Loader2,
  SkipBack, SkipForward,
  FolderOpen, Type, Palette, SquarePen,
} from "lucide-react";
import type { StoryboardScene, ClipOutput, ScriptSegment, BrandProfile, IntroOutroCardSettings } from "@/types/adDirector";
import { DEFAULT_CARD_SETTINGS } from "@/types/adDirector";
import type { VideoOverlay } from "@/types/videoOverlay";
import { type LogoSettings, DEFAULT_LOGO_SETTINGS } from "@/types/editorSettings";
import { MediaTab } from "./editor/MediaTab";
import { MusicTab } from "./editor/MusicTab";
import { ScriptTab } from "./editor/ScriptTab";
import { TimelineBar, type AudioTrackItem } from "./editor/TimelineBar";
import { TextOverlayDialog } from "./editor/TextOverlayDialog";
import { TextTab } from "./editor/TextTab";
import { BrandKitTab } from "./editor/BrandKitTab";
import { IntroOutroEditor, drawCardToCanvas } from "./editor/IntroOutroEditor";
import { supabase } from "@/integrations/supabase/client";
import { uploadToStorage } from "@/lib/storageUpload";

type EditorTab = "media" | "text" | "music" | "brand-kit" | "script" | "card-editor";

const TABS: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
  { id: "media", label: "My Media", icon: <FolderOpen className="w-4 h-4" /> },
  { id: "text", label: "Text", icon: <Type className="w-4 h-4" /> },
  { id: "music", label: "Music", icon: <Music className="w-4 h-4" /> },
  { id: "script", label: "Script", icon: <FileText className="w-4 h-4" /> },
  { id: "brand-kit", label: "Brand Kit", icon: <Palette className="w-4 h-4" /> },
  { id: "card-editor", label: "Card Editor", icon: <SquarePen className="w-4 h-4" /> },
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
  onOpenExportDialog?: () => void;
  onRegenerateScene?: (sceneId: string) => void;
  onUpdateClipUrl?: (sceneId: string, url: string) => void;
  onUpdateSegment?: (id: string, text: string) => void;
  onUpdateSegmentTiming?: (id: string, startTime: number, endTime: number) => void;
  onUpdateStoryboard?: (storyboard: StoryboardScene[]) => void;
  onUpdateBrand?: (brand: BrandProfile) => void;
  onMusicSelect?: (url: string | null) => void;
  externalActiveTab?: string | null;
  onActiveTabChanged?: (tab: string | null) => void;
}

export function ProVideoEditor({
  clips, storyboard, segments, brand,
  finalVideoUrl, onBack, onExport, exporting, onOpenExportDialog,
  onRegenerateScene, onUpdateClipUrl, onUpdateSegment, onUpdateSegmentTiming,
  onUpdateStoryboard, onUpdateBrand, onMusicSelect,
  externalActiveTab, onActiveTabChanged,
}: ProVideoEditorProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("media");

  // Sync from external sidebar navigation
  useEffect(() => {
    if (externalActiveTab && TABS.some(t => t.id === externalActiveTab)) {
      setActiveTab(externalActiveTab as EditorTab);
    }
  }, [externalActiveTab]);

  // Notify parent of tab changes
  const handleSetActiveTab = useCallback((tab: EditorTab) => {
    setActiveTab(tab);
    onActiveTabChanged?.(tab);
  }, [onActiveTabChanged]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [aiCommand, setAiCommand] = useState("");
  const [aiProcessing, setAiProcessing] = useState(false);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [logoSettings, setLogoSettings] = useState<LogoSettings>(DEFAULT_LOGO_SETTINGS);
  const [overlays, setOverlays] = useState<VideoOverlay[]>([]);
  
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [audioTracks, setAudioTracks] = useState<AudioTrackItem[]>([]);
  const [generatingVoiceovers, setGeneratingVoiceovers] = useState(false);
  const audioUploadRef = useRef<HTMLInputElement>(null);

  const handleUploadAudio = useCallback(() => {
    audioUploadRef.current?.click();
  }, []);

  const handleAudioFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAudioTracks(prev => [
      ...prev,
      { kind: "music" as const, audioUrl: url, label: file.name, volume: 0.7, sceneId: `upload-${Date.now()}` },
    ]);
    e.target.value = "";
  }, []);
  const [videoVolume, setVideoVolume] = useState(1);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [mutedScenes, setMutedScenes] = useState<Set<string>>(new Set());
  const [clipDurations, setClipDurations] = useState<Record<string, number>>({});
  const [voiceoverDurations, setVoiceoverDurations] = useState<Record<string, number>>({});
  const [cardSettingsMap, setCardSettingsMap] = useState<Record<string, IntroOutroCardSettings>>({});
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  // Preload logo image for card rendering
  useEffect(() => {
    if (brand.logoUrl) {
      const img = document.createElement("img");
      img.crossOrigin = "anonymous";
      img.src = brand.logoUrl;
      img.onload = () => { logoImgRef.current = img; };
    } else {
      logoImgRef.current = null;
    }
  }, [brand.logoUrl]);

  // Get or create card settings for current scene
  const currentCardSettings = useMemo(() => {
    const scene = storyboard[selectedSceneIndex];
    if (!scene) return null;
    return cardSettingsMap[scene.id] || null;
  }, [storyboard, selectedSceneIndex, cardSettingsMap]);

  const handleCardSettingsChange = useCallback((s: IntroOutroCardSettings) => {
    const scene = storyboard[selectedSceneIndex];
    if (!scene) return;
    setCardSettingsMap(prev => ({ ...prev, [scene.id]: s }));
  }, [storyboard, selectedSceneIndex]);

  // Live canvas redraw when editing a static card
  useEffect(() => {
    const scene = storyboard[selectedSceneIndex];
    if (!scene) return;
    const settings = cardSettingsMap[scene.id];
    if (!settings || !liveCanvasRef.current) return;
    const canvas = liveCanvasRef.current;
    canvas.width = 1280;
    canvas.height = 720;
    drawCardToCanvas(canvas, settings, logoImgRef.current);
  }, [cardSettingsMap, storyboard, selectedSceneIndex]);

  const handleApplyCard = useCallback(() => {
    const scene = storyboard[selectedSceneIndex];
    if (!scene) return;
    const settings = cardSettingsMap[scene.id];
    if (!settings) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    drawCardToCanvas(canvas, settings, logoImgRef.current);
    const dataUrl = canvas.toDataURL("image/png");
    onUpdateClipUrl?.(scene.id, dataUrl);
    toast({ title: "Card updated", description: "Intro/outro card applied." });
  }, [storyboard, selectedSceneIndex, cardSettingsMap, onUpdateClipUrl, toast]);

  const openCardEditor = useCallback(() => {
    const scene = storyboard[selectedSceneIndex];
    if (!scene) return;
    if (!cardSettingsMap[scene.id]) {
      setCardSettingsMap(prev => ({ ...prev, [scene.id]: DEFAULT_CARD_SETTINGS(brand) }));
    }
    handleSetActiveTab("card-editor" as EditorTab);
  }, [storyboard, selectedSceneIndex, cardSettingsMap, brand, handleSetActiveTab]);

  // ─── Global timeline ───
  const sceneDurations = useMemo(() => {
    return storyboard.map((scene) => {
      const clipDur = clipDurations[scene.id];
      const voDur = voiceoverDurations[scene.id];
      const seg = segments.find(s => s.id === scene.segmentId);
      const segDur = seg ? seg.endTime - seg.startTime : 4;
      // Use the longest of clip vs voiceover duration, fall back to segment timing
      const mediaDur = clipDur && voDur ? Math.max(clipDur, voDur) : (clipDur || voDur);
      return mediaDur || segDur;
    });
  }, [storyboard, segments, clipDurations, voiceoverDurations]);

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
    const newOverlays: VideoOverlay[] = [];
    for (const scene of storyboard) {
      const hasLogo = overlays.some(o => o.sceneId === scene.id && o.kind === "logo");
      if (!hasLogo) {
        newOverlays.push({
          id: crypto.randomUUID(),
          kind: "logo",
          position: { x: 82, y: 85 },
          size: { w: 12, h: 10 },
          content: brand.logoUrl,
          opacity: 0.9,
          sceneId: scene.id,
          animated: false,
        });
      }
    }
    if (newOverlays.length > 0) {
      setOverlays(prev => [...prev, ...newOverlays]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyboard.length, brand.logoUrl]);

  // Helper: split text into caption chunks of ~4-6 words
  const splitIntoChunks = useCallback((text: string, maxWords = 5): string[] => {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += maxWords) {
      chunks.push(words.slice(i, i + maxWords).join(" "));
    }
    return chunks.length > 0 ? chunks : [text];
  }, []);

  // Build timed subtitle overlays from voiceover text
  const buildTimedOverlays = useCallback((sceneId: string, voText: string, totalDur: number): VideoOverlay[] => {
    const chunks = splitIntoChunks(voText);
    const chunkDur = totalDur / chunks.length;
    return chunks.map((chunk, i) => ({
      id: crypto.randomUUID(),
      kind: "text" as const,
      position: { x: 5, y: 82 },
      size: { w: 90, h: 12 },
      content: chunk,
      opacity: 0.95,
      sceneId,
      animated: false,
      startTime: +(i * chunkDur).toFixed(2),
      endTime: +((i + 1) * chunkDur).toFixed(2),
    }));
  }, [splitIntoChunks]);

  // Auto-seed & resync text overlays when voiceover durations change
  useEffect(() => {
    if (storyboard.length === 0 || segments.length === 0) return;
    const newOverlays: VideoOverlay[] = [];
    for (const scene of storyboard) {
      const seg = segments.find(s => s.id === scene.segmentId);
      const voText = seg?.voiceover || seg?.text;
      if (!voText?.trim()) continue;
      const voDur = voiceoverDurations[scene.id] || clipDurations[scene.id] || (seg ? seg.endTime - seg.startTime : 4);
      newOverlays.push(...buildTimedOverlays(scene.id, voText, voDur));
    }
    // Replace all text overlays, keep logos/shapes
    setOverlays(prev => [
      ...prev.filter(o => o.kind !== "text"),
      ...newOverlays,
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyboard.length, segments, voiceoverDurations, clipDurations]);

  // Auto-generate voiceovers on mount
  const voiceoverGenerated = useRef(false);
  useEffect(() => {
    if (voiceoverGenerated.current || segments.length === 0) return;
    if (audioTracks.some(a => a.kind === "voiceover")) return;
    voiceoverGenerated.current = true;
    generateAllVoiceovers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.length]);


  // Auto-play after scene change
  const autoPlayPending = useRef(false);
  const sceneTransitioning = useRef(false);
  useEffect(() => {
    if (autoPlayPending.current && videoRef.current && !sceneTransitioning.current) {
      videoRef.current.play().catch(() => {});
      autoPlayPending.current = false;
    }
  }, [selectedSceneIndex]);

  // Sync voiceover audio with video playback (time-locked)
  const currentVoUrlRef = useRef<string | null>(null);
  const voDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to hold current scene's VO data — avoids re-triggering playback effect on array changes
  const currentSceneVoRef = useRef<{ url: string; volume: number } | null>(null);

  // Lightweight effect: update VO ref when tracks/scene change (no Audio teardown)
  useEffect(() => {
    const sceneId = storyboard[selectedSceneIndex]?.id;
    const vo = audioTracks.find(a => a.kind === "voiceover" && a.sceneId === sceneId);
    currentSceneVoRef.current = vo ? { url: vo.audioUrl, volume: vo.volume ?? 1 } : null;
  }, [audioTracks, storyboard, selectedSceneIndex]);

  // Main playback effect — only re-runs on play state or scene change
  // NOTE: mutedScenes removed from deps to prevent audio teardown/restart glitches;
  // muted-scene volume is handled in the volume effect below.
  useEffect(() => {
    const sceneId = storyboard[selectedSceneIndex]?.id;
    const vo = currentSceneVoRef.current;

    // If same VO is already playing, don't touch it — no cleanup returned
    if (audioRef.current && currentVoUrlRef.current === vo?.url && !audioRef.current.paused) {
      return; // Keep playing, no teardown
    }

    let cancelled = false;
    let syncHandler: (() => void) | null = null;
    let vid: HTMLVideoElement | null = null;

    const cleanup = () => {
      cancelled = true;
      if (voDebounceRef.current) { clearTimeout(voDebounceRef.current); voDebounceRef.current = null; }
      if (vid && syncHandler) vid.removeEventListener("timeupdate", syncHandler);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current = null; }
      currentVoUrlRef.current = null;
    };

    // Don't start voiceover during scene transition
    if (sceneTransitioning.current) { cleanup(); return cleanup; }

    if (!vo || !isPlaying || isMuted) { cleanup(); return cleanup; }

    // Clean up previous instance
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; audioRef.current = null; }

    // Debounce to prevent double-trigger from rapid state changes
    voDebounceRef.current = setTimeout(() => {
      if (cancelled) return;
      const a = new Audio(vo.url);
      // Adjust voiceover playback rate if it's longer than the video clip
      const sceneClipDur = clipDurations[sceneId!];
      const sceneVoDur = voiceoverDurations[sceneId!];
      if (sceneClipDur && sceneVoDur && sceneVoDur > sceneClipDur) {
        a.playbackRate = Math.min(sceneVoDur / sceneClipDur, 1.6);
      } else {
        a.playbackRate = 1;
      }
      // Apply muted-scene volume inline
      if (sceneId && mutedScenes.has(sceneId)) {
        a.volume = 0;
      }
      audioRef.current = a;
      currentVoUrlRef.current = vo.url;

      // For video scenes, sync VO start to video's actual playing event
      const currentClip = clips.find(c => c.sceneId === sceneId);
      const isStaticCard = storyboard[selectedSceneIndex]?.generationMode === "static-card" || currentClip?.videoUrl?.startsWith("data:image/");
      let voStarted = false;

      if (!isStaticCard && videoRef.current) {
        const onPlaying = () => {
          if (cancelled || !audioRef.current || voStarted) return;
          voStarted = true;
          audioRef.current.currentTime = videoRef.current?.currentTime ?? 0;
          audioRef.current.play().catch(() => {});
          videoRef.current?.removeEventListener("playing", onPlaying);
        };
        // If video is already playing, start immediately
        if (!videoRef.current.paused && videoRef.current.readyState >= 3) {
          if (!voStarted) {
            voStarted = true;
            a.currentTime = videoRef.current.currentTime ?? 0;
            a.play().catch(() => {});
          }
        } else {
          videoRef.current.addEventListener("playing", onPlaying);
        }

        // No drift correction — VO is speed-matched to clip, drift is minimal
        vid = videoRef.current;
      } else {
        // Static card — play immediately
        a.currentTime = 0;
        a.play().catch(() => {});
      }
    }, 50);

    return cleanup;
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

  // Detect static-card scenes (end cards rendered as PNG data URLs)
  const currentScene = storyboard[selectedSceneIndex];
  const isStaticCard = !finalVideoUrl && (
    currentScene?.generationMode === "static-card" ||
    (videoSrc?.startsWith("data:image/") ?? false)
  );

  // Static card duration: use segment timing or default 4s
  const staticCardDuration = useMemo(() => {
    if (!isStaticCard || !currentScene) return 4;
    const seg = segments.find(s => s.id === currentScene.segmentId);
    return seg ? seg.endTime - seg.startTime : 4;
  }, [isStaticCard, currentScene, segments]);

  // Timer-based playback for static cards
  const staticTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleVideoEndedRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!isStaticCard || !isPlaying) {
      if (staticTimerRef.current) { clearInterval(staticTimerRef.current); staticTimerRef.current = null; }
      if (isStaticCard && !isPlaying) setCurrentTime(0);
      return;
    }
    setCurrentTime(0);
    setDuration(staticCardDuration);
    const start = Date.now();
    staticTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      if (elapsed >= staticCardDuration) {
        clearInterval(staticTimerRef.current!);
        staticTimerRef.current = null;
        setCurrentTime(staticCardDuration);
        handleVideoEndedRef.current();
      } else {
        setCurrentTime(elapsed);
      }
    }, 100);
    return () => { if (staticTimerRef.current) { clearInterval(staticTimerRef.current); staticTimerRef.current = null; } };
  }, [isStaticCard, isPlaying, staticCardDuration, selectedSceneIndex]);

  // Track static card durations in clipDurations
  useEffect(() => {
    if (isStaticCard && currentScene?.id) {
      setClipDurations(prev => ({ ...prev, [currentScene.id]: staticCardDuration }));
    }
  }, [isStaticCard, currentScene?.id, staticCardDuration]);

  const togglePlay = () => {
    if (isStaticCard) {
      setIsPlaying(prev => !prev);
      return;
    }
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause(); else videoRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
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

  // Apply per-track volume to voiceover audio (also handles mutedScenes)
  useEffect(() => {
    if (audioRef.current) {
      const sceneId = storyboard[selectedSceneIndex]?.id;
      const isMutedScene = sceneId ? mutedScenes.has(sceneId) : false;
      if (isMutedScene) {
        audioRef.current.volume = 0;
      } else {
        const vo = audioTracks.find(a => a.kind === "voiceover" && a.sceneId === sceneId);
        audioRef.current.volume = vo?.volume ?? 1;
      }
    }
  }, [audioTracks, selectedSceneIndex, storyboard, mutedScenes]);

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
  }, []);

  const handleEditVoiceover = useCallback((index: number) => {
    setSelectedSceneIndex(index);
    setActiveTab("script");
  }, []);

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
    const voiceoverText = scene.voiceover?.trim() || seg?.text?.trim();
    if (!voiceoverText) return;
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
          body: JSON.stringify({ text: voiceoverText }),
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
    }
  }, [storyboard]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoaded = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      // Track actual clip duration keyed by scene ID
      const sceneId = storyboard[selectedSceneIndex]?.id;
      if (sceneId && videoRef.current.duration > 0) {
        setClipDurations(prev => ({ ...prev, [sceneId]: videoRef.current!.duration }));
      }
    }
  };

  // ─── Auto-advance on video end with fade transition ───
  const [sceneTransition, setSceneTransition] = useState(false);

  const advanceToNextScene = useCallback(() => {
    const completedIndices = storyboard
      .map((s, i) => ({ i, clip: clips.find(c => c.sceneId === s.id) }))
      .filter(x => x.clip?.status === "completed" && x.clip?.videoUrl)
      .map(x => x.i);

    const nextIdx = completedIndices.find(i => i > selectedSceneIndex);
    if (nextIdx === undefined) {
      setIsPlaying(false);
      return;
    }

    // Stop VO cleanly instead of orphaning — VO is speed-matched so cutting tail is acceptable
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
      currentVoUrlRef.current = null;
    }

    doAdvance(nextIdx);

    function doAdvance(idx: number) {
      setSceneTransition(true);
      sceneTransitioning.current = true;
      setTimeout(() => {
        autoPlayPending.current = true;
        setSelectedSceneIndex(idx);
        const nextScene = storyboard[idx];
        const nextClip = clips.find(c => c.sceneId === nextScene?.id);
        const nextIsStatic = nextScene?.generationMode === "static-card" || nextClip?.videoUrl?.startsWith("data:image/");

        // Preload next scene's voiceover
        const nextVo = audioTracks.find(a => a.kind === "voiceover" && a.sceneId === nextScene?.id);
        if (nextVo) {
          const preload = new Audio(nextVo.audioUrl);
          preload.preload = "auto";
          preload.load();
        }

        if (nextIsStatic) {
          sceneTransitioning.current = false;
          setSceneTransition(false);
          setIsPlaying(true);
          autoPlayPending.current = false;
        } else {
          const checkReady = () => {
            if (videoRef.current && videoRef.current.readyState >= 3) {
              sceneTransitioning.current = false;
              setSceneTransition(false);
              if (autoPlayPending.current) {
                videoRef.current.play().catch(() => {});
                autoPlayPending.current = false;
              }
            } else {
              setTimeout(checkReady, 50);
            }
          };
          setTimeout(checkReady, 50);
        }
      }, 500);
    }
  }, [storyboard, clips, selectedSceneIndex, audioTracks]);

  const handleVideoEnded = useCallback(() => {
    advanceToNextScene();
  }, [advanceToNextScene]);
  // Keep ref in sync for static card timer
  handleVideoEndedRef.current = handleVideoEnded;

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
  // Helper to measure video clip duration from URL
  const measureVideoDuration = (videoUrl: string): Promise<number | null> => {
    return new Promise((resolve) => {
      const tempVid = document.createElement("video");
      tempVid.preload = "metadata";
      tempVid.addEventListener("loadedmetadata", () => {
        resolve(tempVid.duration && isFinite(tempVid.duration) ? tempVid.duration : null);
      });
      tempVid.addEventListener("error", () => resolve(null));
      tempVid.src = videoUrl;
    });
  };

  const generateAllVoiceovers = async () => {
    setGeneratingVoiceovers(true);
    const newTracks: AudioTrackItem[] = [];
    try {
      for (const seg of segments) {
        if (!seg.text.trim()) continue;
        const scene = storyboard.find(s => s.segmentId === seg.id);
        if (!scene) continue;

        // Prefer dedicated voiceover text from AI over generic segment text
        const voiceoverText = scene.voiceover?.trim() || seg.text.trim();
        if (!voiceoverText) continue;

        // Ensure we have clip duration — measure from URL if not cached
        let clipDur = clipDurations[scene.id];
        if (!clipDur) {
          const clip = clips.find(c => c.sceneId === scene.id);
          if (clip?.videoUrl && !clip.videoUrl.startsWith("data:image/")) {
            const measured = await measureVideoDuration(clip.videoUrl);
            if (measured && measured > 0) {
              clipDur = measured;
              setClipDurations(prev => ({ ...prev, [scene.id]: measured }));
            }
          }
        }

        // First pass: generate VO at normal speed
        let response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ text: voiceoverText }),
          }
        );
        if (!response.ok) throw new Error(`TTS failed for ${seg.label}`);
        let blob = await response.blob();
        let url = URL.createObjectURL(blob);

        // Measure VO duration
        let voDur = await measureAudioDuration(url);

        // Two-pass fitting: if VO is >20% longer than clip, regenerate with speed param
        if (clipDur && voDur && voDur > clipDur * 1.2) {
          const targetSpeed = Math.min(voDur / clipDur, 1.2); // ElevenLabs max speed is 1.2
          const retryResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({ text: seg.text, speed: parseFloat(targetSpeed.toFixed(2)) }),
            }
          );
          if (retryResponse.ok) {
            URL.revokeObjectURL(url); // Free old blob
            blob = await retryResponse.blob();
            url = URL.createObjectURL(blob);
            voDur = await measureAudioDuration(url);
          }
        }

        if (voDur && isFinite(voDur)) {
          setVoiceoverDurations(prev => ({ ...prev, [scene.id]: voDur! }));
        }
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

  // Helper to measure audio duration from a blob URL
  const measureAudioDuration = (url: string): Promise<number | null> => {
    return new Promise((resolve) => {
      const tempAudio = new Audio(url);
      tempAudio.addEventListener("loadedmetadata", () => {
        resolve(tempAudio.duration && isFinite(tempAudio.duration) ? tempAudio.duration : null);
      });
      tempAudio.addEventListener("error", () => resolve(null));
    });
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

  // Overlays for current scene — filter text overlays by currentTime
  const currentSceneId = storyboard[selectedSceneIndex]?.id;
  const sceneOverlays = overlays.filter(o => {
    if (o.sceneId !== currentSceneId) return false;
    if (o.kind === "text" && o.startTime != null && o.endTime != null) {
      return currentTime >= o.startTime && currentTime < o.endTime;
    }
    return true; // logos/shapes always visible
  });
  const textOverlays = overlays.filter(o => o.kind === "text");

  // Logo handlers
  const handleDeleteLogo = () => onUpdateBrand?.({ ...brand, logoUrl: null });

  const handleReplaceLogo = async (file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const path = `${user.id}/logo-${Date.now()}.${file.name.split('.').pop()}`;
      const { error } = await uploadToStorage("brand-assets", path, file, { upsert: true });
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

        <Badge variant="secondary" className="text-[9px]">Edit</Badge>

        <Button
          size="sm"
          className="gap-1.5 text-xs h-7 bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-400"
          onClick={() => onOpenExportDialog ? onOpenExportDialog() : onExport()}
          disabled={exporting || clips.every(c => c.status !== "completed")}
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? "Exporting…" : "Export"}
        </Button>
      </div>

      {/* ─── Main 3-Panel Area ─── */}
      <div className="flex flex-1 min-h-0">
        {/* ─── Left Sidebar ─── */}
        <div className={`flex shrink-0 border-r border-border/30 bg-card/60 transition-all ${activeTab ? "w-60" : "w-0"} overflow-hidden`}>
          {/* Tab content */}
          {activeTab && (
            <div className="w-60 overflow-y-auto p-3 min-w-0">
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
              {activeTab === "text" && <TextTab onAddText={() => setTextDialogOpen(true)} />}
              {activeTab === "music" && (
                <MusicTab onTrackSelect={(track) => handleMusicSelect(track?.url ?? null)} />
              )}
              {activeTab === "brand-kit" && (
                <BrandKitTab
                  brand={brand}
                  logo={logoSettings}
                  onLogoChange={setLogoSettings}
                  onDeleteLogo={handleDeleteLogo}
                  onReplaceLogo={handleReplaceLogo}
                />
              )}
              {activeTab === "script" && <ScriptTab segments={segments} onUpdateSegment={onUpdateSegment} />}
              {activeTab === "card-editor" && currentCardSettings && (
                <IntroOutroEditor
                  settings={currentCardSettings}
                  brand={brand}
                  onChange={handleCardSettingsChange}
                  onApply={handleApplyCard}
                />
              )}
            </div>
          )}
        </div>

        {/* ─── Center Canvas ─── */}
        <div className="flex-1 flex flex-col min-w-0 bg-black/90 relative">
          {/* AI Command Bar — floating at top */}
          <div className="absolute top-3 left-3 right-3 z-30 flex gap-2 items-center p-1.5 rounded-xl bg-black/40 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
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

          {/* Video / Static Card */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden max-h-[50vh]">
            {videoSrc ? (
              <>
                {isStaticCard ? (
                  <>
                    {currentCardSettings ? (
                      <canvas
                        ref={liveCanvasRef}
                        width={1280}
                        height={720}
                        className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${sceneTransition ? "opacity-0" : "opacity-100"}`}
                      />
                    ) : (
                      <img
                        src={videoSrc}
                        alt="End Card"
                        className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${sceneTransition ? "opacity-0" : "opacity-100"}`}
                      />
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute bottom-20 right-4 z-20 gap-1.5 text-xs"
                      onClick={openCardEditor}
                    >
                      <Palette className="w-3.5 h-3.5" /> Edit Card
                    </Button>
                  </>
                ) : (
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${sceneTransition ? "opacity-0" : "opacity-100"}`}
                    muted
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoaded}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={handleVideoEnded}
                  />
                )}
                {brand.logoUrl && (
                  <div className="absolute bottom-16 right-4 z-10 pointer-events-none">
                    <div className="bg-black/20 backdrop-blur-sm rounded-lg p-1.5 border border-white/[0.06]">
                      <img
                        src={brand.logoUrl}
                        alt="Brand watermark"
                        className="h-8 w-auto object-contain opacity-80"
                      />
                    </div>
                  </div>
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
                      <span className="text-white font-semibold text-sm drop-shadow-lg bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/[0.08]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
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
            <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-xl border-t border-white/[0.06] shadow-[0_-4px_24px_rgba(0,0,0,0.3)]">
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

      </div>

      {/* ─── Bottom Timeline ─── */}
      <TimelineBar
        sidebarTabs={TABS}
        activeSidebarTab={activeTab}
        onSidebarTabSelect={handleSetActiveTab}
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
        onAddAudio={handleUploadAudio}
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

      {/* Hidden audio file input */}
      <input
        ref={audioUploadRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleAudioFileSelected}
      />
    </div>
  );
}
