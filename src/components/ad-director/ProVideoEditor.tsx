import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Play, Pause, Volume2, VolumeX, Maximize2, SkipBack, SkipForward,
  Sparkles, Settings2, Send, Download, Edit3, ArrowLeft,
  Image, Music, FileText, Sliders, ImageIcon,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StoryboardScene, ClipOutput, ScriptSegment, BrandProfile } from "@/types/adDirector";
import { type EditorSettings, type LogoSettings, DEFAULT_EDITOR_SETTINGS, DEFAULT_LOGO_SETTINGS } from "@/types/editorSettings";
import { MediaTab } from "./editor/MediaTab";
import { MusicTab } from "./editor/MusicTab";
import { ScriptTab } from "./editor/ScriptTab";
import { SettingsTab } from "./editor/SettingsTab";
import { LogoTab } from "./editor/LogoTab";

type EditorTab = "media" | "music" | "script" | "settings" | "logo";

const TABS: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
  { id: "media", label: "Media", icon: <Image className="w-3.5 h-3.5" /> },
  { id: "music", label: "Music", icon: <Music className="w-3.5 h-3.5" /> },
  { id: "script", label: "Script", icon: <FileText className="w-3.5 h-3.5" /> },
  { id: "settings", label: "Settings", icon: <Sliders className="w-3.5 h-3.5" /> },
  { id: "logo", label: "Logo", icon: <ImageIcon className="w-3.5 h-3.5" /> },
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
}

export function ProVideoEditor({
  clips, storyboard, segments, brand,
  finalVideoUrl, onBack, onExport, exporting,
}: ProVideoEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("media");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [aiCommand, setAiCommand] = useState("");
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(DEFAULT_EDITOR_SETTINGS);
  const [logoSettings, setLogoSettings] = useState<LogoSettings>(DEFAULT_LOGO_SETTINGS);

  // Pick the video to show: final video or the selected scene clip
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

  const seekTo = (pct: number) => {
    if (videoRef.current && duration > 0) {
      videoRef.current.currentTime = (pct / 100) * duration;
    }
  };

  const handleAiSubmit = () => {
    if (!aiCommand.trim()) return;
    // TODO: integrate with AI edit edge function
    setAiCommand("");
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 h-8 px-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">Pro Editor</Badge>
        </div>
      </div>

      {/* Video Player */}
      <div className="rounded-xl overflow-hidden border border-border/30 bg-black relative">
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full aspect-video"
            muted={isMuted}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoaded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          <div className="w-full aspect-video flex items-center justify-center bg-muted/10">
            <span className="text-sm text-muted-foreground">No video available</span>
          </div>
        )}

        {/* Custom controls overlay */}
        {videoSrc && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 space-y-2">
            {/* Progress bar */}
            <div
              className="w-full h-1 bg-muted/40 rounded-full cursor-pointer group"
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                seekTo(((e.clientX - rect.left) / rect.width) * 100);
              }}
            >
              <div
                className="h-full bg-primary rounded-full transition-all relative"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-2">
              <button onClick={togglePlay} className="text-white/90 hover:text-white">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button onClick={toggleMute} className="text-white/90 hover:text-white">
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <span className="text-white/70 text-xs font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <div className="flex-1" />
              <button
                onClick={() => videoRef.current?.requestFullscreen?.()}
                className="text-white/90 hover:text-white"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Command Bar */}
      <div className="flex gap-2 items-center p-2 rounded-xl border border-border/30 bg-muted/10">
        <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
        <Input
          value={aiCommand}
          onChange={e => setAiCommand(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAiSubmit()}
          placeholder="Give me a command to edit this video..."
          className="border-0 bg-transparent h-8 text-sm focus-visible:ring-0 shadow-none"
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={handleAiSubmit}
          disabled={!aiCommand.trim()}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/30">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[250px]">
        {activeTab === "media" && (
          <MediaTab
            storyboard={storyboard}
            clips={clips}
            segments={segments}
            selectedSceneIndex={selectedSceneIndex}
            onSelectScene={setSelectedSceneIndex}
          />
        )}
        {activeTab === "music" && <MusicTab />}
        {activeTab === "script" && <ScriptTab segments={segments} />}
        {activeTab === "settings" && <SettingsTab settings={editorSettings} onChange={setEditorSettings} />}
        {activeTab === "logo" && <LogoTab logo={logoSettings} brand={brand} onChange={setLogoSettings} />}
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center gap-2 pt-2 border-t border-border/30">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem className="text-xs">Undo</DropdownMenuItem>
            <DropdownMenuItem className="text-xs">Redo</DropdownMenuItem>
            <DropdownMenuItem className="text-xs">Reset all edits</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        <Button
          size="sm"
          className="gap-1.5 text-xs h-8"
          onClick={onExport}
          disabled={exporting || clips.every(c => c.status !== "completed")}
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? "Exporting..." : "Export & Download"}
        </Button>
      </div>
    </div>
  );
}
