import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Video, Image as ImageIcon, Link2, FileText, Layers,
  Lock, Unlock, RotateCcw, Pencil, CheckCircle2, Loader2, XCircle, Clock, ChevronRight
} from "lucide-react";
import { type StoryboardScene, type ClipOutput, type GenerationMode } from "@/types/adDirector";
import { PromptQualityBadge } from "./PromptQualityBadge";
import { SceneIntelligenceBar } from "./SceneIntelligenceBar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const modeIcons: Record<GenerationMode, React.ReactNode> = {
  "text-to-video": <Video className="w-3.5 h-3.5" />,
  "image-to-video": <ImageIcon className="w-3.5 h-3.5" />,
  "reference-continuation": <Link2 className="w-3.5 h-3.5" />,
  "static-card": <FileText className="w-3.5 h-3.5" />,
  "motion-graphics": <Layers className="w-3.5 h-3.5" />,
};

const modeLabels: Record<GenerationMode, string> = {
  "text-to-video": "T2V",
  "image-to-video": "I2V",
  "reference-continuation": "Ref",
  "static-card": "Card",
  "motion-graphics": "MoGfx",
};

const modeColors: Record<GenerationMode, string> = {
  "text-to-video": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "image-to-video": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "reference-continuation": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "static-card": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "motion-graphics": "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

const statusIcons: Record<string, React.ReactNode> = {
  idle: <Clock className="w-3.5 h-3.5 text-muted-foreground" />,
  queued: <Clock className="w-3.5 h-3.5 text-amber-400" />,
  generating: <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  failed: <XCircle className="w-3.5 h-3.5 text-destructive" />,
};

interface SceneCardProps {
  scene: StoryboardScene;
  clip: ClipOutput;
  index: number;
  startTime: number;
  endTime: number;
  segmentLabel: string;
  onPromptChange: (id: string, prompt: string) => void;
  onContinuityToggle: (id: string) => void;
  onRegenerate: (id: string) => void;
  canRegenerate: boolean;
  onImprovePrompt?: (id: string) => void;
  improvingSceneId?: string | null;
}

export function SceneCard({
  scene, clip, index, startTime, endTime, segmentLabel,
  onPromptChange, onContinuityToggle, onRegenerate, canRegenerate,
  onImprovePrompt, improvingSceneId,
}: SceneCardProps) {
  const [editing, setEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState(scene.prompt);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSavePrompt = () => {
    onPromptChange(scene.id, editPrompt);
    setEditing(false);
  };

  return (
    <div className={cn(
      "rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden transition-all hover:border-primary/30",
      clip.status === "generating" && "border-blue-500/40 shadow-lg shadow-blue-500/10",
      clip.status === "completed" && "border-emerald-500/30",
      clip.status === "failed" && "border-destructive/40",
    )}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">
            {formatTime(startTime)}–{formatTime(endTime)}
          </span>
          <Badge variant="outline" className="text-[10px] font-medium">
            Scene {index + 1}
          </Badge>
          <Badge className={cn("text-[10px] border", modeColors[scene.generationMode])}>
            {modeIcons[scene.generationMode]}
            <span className="ml-1">{modeLabels[scene.generationMode]}</span>
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {statusIcons[clip.status]}
          {clip.status === "generating" && (
            <span className="text-[10px] text-blue-400 font-medium">Generating…</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Segment Label */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold capitalize text-foreground">{segmentLabel}</span>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {scene.continuityLock ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            <button onClick={() => onContinuityToggle(scene.id)} className="hover:text-foreground">
              Continuity {scene.continuityLock ? "Locked" : "Free"}
            </button>
          </div>
        </div>

        {/* Collapsible Scene Details */}
        <Collapsible>
          <CollapsibleTrigger className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
            <span>Scene details ▸</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">{scene.objective}</p>
            <div className="grid grid-cols-3 gap-2 text-[10px]">
              <div>
                <span className="text-muted-foreground block">Shot</span>
                <span className="text-foreground">{scene.shotType}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Camera</span>
                <span className="text-foreground">{scene.cameraMovement}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Tone</span>
                <span className="text-foreground">{scene.emotionalTone}</span>
              </div>
            </div>
            {/* Scene Intelligence Bar */}
            <SceneIntelligenceBar intelligence={scene.sceneIntelligence} />
          </CollapsibleContent>
        </Collapsible>

        {/* Prompt */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Generation Prompt</Label>
            <Button variant="ghost" size="sm" className="h-5 px-1" onClick={() => { setEditPrompt(scene.prompt); setEditing(!editing); }}>
              <Pencil className="w-3 h-3" />
            </Button>
          </div>
          {editing ? (
            <div className="space-y-2">
              <Textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                className="text-xs min-h-[80px] bg-background/50"
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-6 text-[10px]" onClick={handleSavePrompt}>Save</Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-foreground/80 leading-relaxed bg-background/30 rounded-lg p-2 line-clamp-3">
              {scene.prompt}
            </p>
          )}
        </div>

        {/* Prompt Quality Badge */}
        <PromptQualityBadge
          quality={scene.promptQuality}
          onImprove={onImprovePrompt ? () => onImprovePrompt(scene.id) : undefined}
          improving={improvingSceneId === scene.id}
        />

        {/* Completed video thumbnail */}
        {clip.status === "completed" && clip.videoUrl && (
          <video
            src={clip.videoUrl}
            className="w-full rounded-lg aspect-video object-cover"
            muted
            playsInline
            onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
            onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
          />
        )}

        {clip.status === "failed" && clip.error && (
          <p className="text-[10px] text-destructive bg-destructive/10 rounded-lg p-2">{clip.error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            disabled={!canRegenerate || clip.status === "generating"}
            onClick={() => onRegenerate(scene.id)}
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            {clip.status === "completed" ? "Regenerate" : "Generate"}
          </Button>
        </div>

      </div>
    </div>
  );
}
