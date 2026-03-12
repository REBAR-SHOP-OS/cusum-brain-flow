import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Scissors, Expand, RefreshCw, Palette, Sun, Eraser, Image,
  Loader2, ArrowLeft, Sparkles, Play, Pause, ChevronRight,
  Type, Subtitles, Maximize2
} from "lucide-react";
import { invokeEdgeFunction } from "@/lib/invokeEdgeFunction";
import { trimVideo } from "@/lib/videoTrim";
import { useToast } from "@/hooks/use-toast";

type EditTool =
  | "trim"
  | "extend"
  | "regenerate"
  | "change-style"
  | "change-lighting"
  | "remove-object"
  | "replace-background"
  | "subtitle"
  | "text-overlay"
  | "resize-platform"
  | null;

interface EditToolConfig {
  id: EditTool;
  label: string;
  description: string;
  icon: React.ReactNode;
  needsDetail: boolean;
  placeholder: string;
}

const editTools: EditToolConfig[] = [
  { id: "trim", label: "Trim", description: "Cut start/end of clip", icon: <Scissors className="w-4 h-4" />, needsDetail: false, placeholder: "" },
  { id: "extend", label: "Extend", description: "Generate more footage", icon: <Expand className="w-4 h-4" />, needsDetail: true, placeholder: "Continue the scene with a slow pan out..." },
  { id: "regenerate", label: "Regenerate", description: "New version of this clip", icon: <RefreshCw className="w-4 h-4" />, needsDetail: true, placeholder: "Make it more dramatic with faster action..." },
  { id: "change-style", label: "Style", description: "Change visual style", icon: <Palette className="w-4 h-4" />, needsDetail: true, placeholder: "cyberpunk neon, vintage film grain, anime..." },
  { id: "change-lighting", label: "Lighting", description: "Adjust lighting & mood", icon: <Sun className="w-4 h-4" />, needsDetail: true, placeholder: "golden hour, dramatic shadows, neon glow..." },
  { id: "remove-object", label: "Remove", description: "Remove an element", icon: <Eraser className="w-4 h-4" />, needsDetail: true, placeholder: "the background crane, the worker on the left..." },
  { id: "replace-background", label: "Background", description: "Swap environment", icon: <Image className="w-4 h-4" />, needsDetail: true, placeholder: "a futuristic factory, an outdoor construction site..." },
  { id: "subtitle", label: "Subtitle", description: "Auto-generate captions", icon: <Subtitles className="w-4 h-4" />, needsDetail: true, placeholder: "Language: English, style: bold white text..." },
  { id: "text-overlay", label: "Text", description: "Add text overlay", icon: <Type className="w-4 h-4" />, needsDetail: true, placeholder: "REBAR SHOP OS — bottom center, white bold..." },
  { id: "resize-platform", label: "Resize", description: "Resize for platform", icon: <Maximize2 className="w-4 h-4" />, needsDetail: true, placeholder: "9:16 for TikTok, 1:1 for Instagram..." },
];

const STYLE_PRESETS = [
  "Cinematic Documentary", "Cyberpunk Neon", "Vintage Film Grain",
  "Moody Industrial", "Clean Commercial", "Dramatic Slow-Mo",
];

const LIGHTING_PRESETS = [
  "Golden Hour", "Dramatic Side-Light", "Neon Glow",
  "Overcast Soft", "Studio Spotlight", "Harsh Industrial",
];

interface VideoEditorProps {
  videoUrl: string;
  engineeredPrompt: string;
  onEditComplete: (newVideoUrl: string, newPrompt: string) => void;
  onBack: () => void;
  onRegenerate: (prompt: string) => void;
  mode: string;
  duration: string;
}

export function VideoEditor({
  videoUrl,
  engineeredPrompt,
  onEditComplete,
  onBack,
  onRegenerate,
  mode,
  duration,
}: VideoEditorProps) {
  const { toast } = useToast();
  const [activeTool, setActiveTool] = useState<EditTool>(null);
  const [editDetail, setEditDetail] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Trim state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 100]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    setEditDetail("");
    if (activeTool === "trim" && videoRef.current) {
      setTrimRange([0, 100]);
    }
  }, [activeTool]);

  const handleVideoLoaded = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  const togglePlayback = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
  };

  const handleTrim = async () => {
    if (!videoRef.current || videoDuration <= 0) return;
    const startSec = (trimRange[0] / 100) * videoDuration;
    const endSec = (trimRange[1] / 100) * videoDuration;
    if (endSec - startSec < 0.5) {
      toast({ title: "Selection too short", description: "Select at least 0.5 seconds", variant: "destructive" });
      return;
    }
    setIsProcessing(true);
    try {
      const trimmedUrl = await trimVideo(videoUrl, startSec, endSec);
      onEditComplete(trimmedUrl, engineeredPrompt);
      toast({ title: "Trimmed!", description: `Clip trimmed to ${formatTime(endSec - startSec)}` });
    } catch (err: any) {
      toast({ title: "Trim failed", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAIEdit = async () => {
    if (!activeTool || activeTool === "trim") return;
    if (!editDetail.trim() && activeTool !== "extend") {
      toast({ title: "Enter edit details", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const data = await invokeEdgeFunction("edit-video-prompt", {
        originalPrompt: engineeredPrompt,
        editAction: activeTool,
        editDetail: editDetail.trim(),
      });

      if (data.editedPrompt) {
        toast({ title: "Prompt updated!", description: "Regenerating with your changes..." });
        onRegenerate(data.editedPrompt);
      }
    } catch (err: any) {
      toast({ title: "Edit failed", description: err.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const currentToolConfig = editTools.find(t => t.id === activeTool);
  const presets = activeTool === "change-style" ? STYLE_PRESETS
    : activeTool === "change-lighting" ? LIGHTING_PRESETS
    : null;

  return (
    <div className="space-y-4">
      {/* Back + Title */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 h-8 px-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </Button>
        <span className="text-sm font-semibold">Video Editor</span>
        <Badge variant="secondary" className="text-[10px]">{mode}</Badge>
      </div>

      {/* Video Preview */}
      <div className="rounded-xl overflow-hidden border bg-black relative">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full aspect-video"
          onLoadedMetadata={handleVideoLoaded}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          controls={activeTool !== "trim"}
          muted
        />
        {activeTool === "trim" && (
          <button
            onClick={togglePlayback}
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
          >
            {isPlaying ? <Pause className="w-12 h-12 text-white/80" /> : <Play className="w-12 h-12 text-white/80" />}
          </button>
        )}
      </div>

      {/* Trim Controls */}
      {activeTool === "trim" && videoDuration > 0 && (
        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Start: {formatTime((trimRange[0] / 100) * videoDuration)}</span>
            <span>End: {formatTime((trimRange[1] / 100) * videoDuration)}</span>
          </div>
          <Slider
            value={trimRange}
            onValueChange={(v) => setTrimRange(v as [number, number])}
            min={0}
            max={100}
            step={0.5}
            className="w-full"
          />
          <div className="text-xs text-center text-muted-foreground">
            Duration: {formatTime(((trimRange[1] - trimRange[0]) / 100) * videoDuration)}
          </div>
          <Button className="w-full gap-2" disabled={isProcessing} onClick={handleTrim}>
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
            {isProcessing ? "Trimming..." : "Apply Trim"}
          </Button>
        </div>
      )}

      {/* AI Edit Controls */}
      {activeTool && activeTool !== "trim" && (
        <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-2 text-sm font-medium">
            {currentToolConfig?.icon}
            {currentToolConfig?.label}
          </div>

          {/* Presets */}
          {presets && (
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p}
                  onClick={() => setEditDetail(p)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    editDetail === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-muted"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          <Input
            value={editDetail}
            onChange={(e) => setEditDetail(e.target.value)}
            placeholder={currentToolConfig?.placeholder}
            className="text-sm"
          />

          <Button className="w-full gap-2" disabled={isProcessing} onClick={handleAIEdit}>
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isProcessing ? "Applying edit..." : "Apply & Regenerate"}
          </Button>
        </div>
      )}

      {/* Tool Grid */}
      <div>
        <Label className="text-xs text-muted-foreground mb-2 block">Editing Tools</Label>
        <div className="grid grid-cols-4 gap-2">
          {editTools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
              disabled={isProcessing}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all text-center ${
                activeTool === tool.id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
              }`}
            >
              <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                activeTool === tool.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {tool.icon}
              </div>
              <span className="text-[11px] font-medium leading-tight">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
