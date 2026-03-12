import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Download, Play, Film, Type, Image as ImageIcon, LayoutTemplate, Loader2 } from "lucide-react";
import { type ClipOutput, type StoryboardScene, type ScriptSegment } from "@/types/adDirector";

interface FinalPreviewProps {
  clips: ClipOutput[];
  storyboard: StoryboardScene[];
  segments: ScriptSegment[];
  subtitlesEnabled: boolean;
  logoEnabled: boolean;
  endCardEnabled: boolean;
  onToggleSubtitles: () => void;
  onToggleLogo: () => void;
  onToggleEndCard: () => void;
  onExport: () => void;
  exporting: boolean;
  finalVideoUrl: string | null;
}

export function FinalPreview({
  clips, storyboard, segments,
  subtitlesEnabled, logoEnabled, endCardEnabled,
  onToggleSubtitles, onToggleLogo, onToggleEndCard,
  onExport, exporting, finalVideoUrl,
}: FinalPreviewProps) {
  // When end card is enabled, the last scene is replaced (not appended)
  const effectiveScenes = endCardEnabled && storyboard.length > 1
    ? storyboard.slice(0, -1)
    : storyboard;
  const completedClips = clips.filter(c => c.status === "completed" && c.videoUrl);
  const completedForExport = completedClips.filter(c => effectiveScenes.some(s => s.id === c.sceneId));
  const allCompleted = completedForExport.length === effectiveScenes.length && effectiveScenes.length > 0;
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Final Preview</h3>
          <Badge variant="outline" className="text-[10px]">
            {completedForExport.length}/{effectiveScenes.length} clips ready
            {endCardEnabled && storyboard.length > 1 && " (+end card)"}
          </Badge>
        </div>
      </div>

      {/* Video Player */}
      {finalVideoUrl ? (
        <div className="space-y-2">
          <video
            ref={videoRef}
            src={finalVideoUrl}
            controls
            className="w-full rounded-lg aspect-video bg-black"
          />
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Badge variant="secondary" className="text-[10px]">
              ✅ Final ad assembled — {completedForExport.length} scenes{endCardEnabled ? " + end card" : ""}
            </Badge>
            <span>Expected: ~{Math.round(
              effectiveScenes.reduce((sum, scene) => {
                const seg = segments.find(s => s.id === scene.segmentId);
                return sum + (seg ? seg.endTime - seg.startTime : 0);
              }, 0) + (endCardEnabled ? 4 : 0)
            )}s</span>
          </div>
        </div>
      ) : (() => {
        const generatingCount = clips.filter(c => c.status === "generating").length;
        const slideshowCount = clips.filter(c => c.status === "completed" && storyboard.find(s => s.id === c.sceneId)?.sceneIntelligence?.videoEngine === "Slideshow Fallback").length;
        const isGenerating = generatingCount > 0;
        return (
          <div className="aspect-video bg-black/50 rounded-lg flex items-center justify-center">
            <div className="text-center space-y-2">
              {isGenerating ? (
                <>
                  <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
                  <p className="text-xs text-muted-foreground">
                    Generating scenes... {completedClips.length}/{storyboard.length} completed
                  </p>
                </>
              ) : completedClips.length > 0 ? (
                <>
                  <Play className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    {allCompleted ? "Ready to stitch — click Export" : `${storyboard.length - completedClips.length} scenes remaining`}
                  </p>
                  {slideshowCount > 0 && (
                    <p className="text-[10px] text-yellow-500">
                      ⚠ {slideshowCount} scene(s) are static images (slideshow fallback)
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Generate scenes to preview</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Overlay Toggles */}
      <div className="flex gap-4">
        <div className="flex items-center gap-1.5">
          <Switch checked={subtitlesEnabled} onCheckedChange={onToggleSubtitles} className="scale-75" />
          <Label className="text-[10px] flex items-center gap-1"><Type className="w-3 h-3" /> Subtitles</Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch checked={logoEnabled} onCheckedChange={onToggleLogo} className="scale-75" />
          <Label className="text-[10px] flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Logo</Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch checked={endCardEnabled} onCheckedChange={onToggleEndCard} className="scale-75" />
          <Label className="text-[10px] flex items-center gap-1"><LayoutTemplate className="w-3 h-3" /> End Card</Label>
        </div>
      </div>

      {/* Export */}
      <Button
        onClick={onExport}
        disabled={!allCompleted || exporting}
        className="w-full h-10 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-sm font-semibold"
      >
        {exporting ? (
          <>Stitching Final Video…</>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Export 30s Ad (MP4)
          </>
        )}
      </Button>

      {/* Scene Timeline Scrubber */}
      {completedClips.length > 0 && (
        <div className="flex gap-1">
          {storyboard.map((scene, i) => {
            const clip = clips.find(c => c.sceneId === scene.id);
            const segment = segments.find(s => s.id === scene.segmentId);
            const dur = (segment?.endTime ?? 0) - (segment?.startTime ?? 0);
            return (
              <div
                key={scene.id}
                className={`h-1.5 rounded-full transition-colors ${
                  clip?.status === "completed" ? "bg-emerald-500" :
                  clip?.status === "generating" ? "bg-blue-500 animate-pulse" :
                  clip?.status === "failed" ? "bg-destructive" : "bg-muted"
                }`}
                style={{ flex: dur }}
                title={`Scene ${i + 1}: ${segment?.label}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
