import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Download, Play, Film, Type, Image as ImageIcon, LayoutTemplate, Loader2, AlertTriangle, RefreshCw, FileDown } from "lucide-react";
import { type ClipOutput, type StoryboardScene, type ScriptSegment } from "@/types/adDirector";
import type { RenderStatus, RenderLogEntry, StitchProgress } from "@/hooks/useRenderPipeline";

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
  onOpenExportDialog?: () => void;
  // Render pipeline state (optional — backward compatible)
  renderStatus?: RenderStatus;
  renderError?: { message: string; stage: string } | null;
  renderProgress?: StitchProgress | null;
  renderLog?: RenderLogEntry[];
  onRetry?: () => void;
  onDownloadLog?: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  generating_voice: "Generating voiceover…",
  assembly_in_progress: "Stitching clips…",
  validating: "Validating output…",
  assembled: "Complete",
  render_failed: "Failed",
};

function RenderProgressBar({ status, progress }: { status?: RenderStatus; progress?: StitchProgress | null }) {
  if (!status || status === "idle" || status === "assembled" || status === "render_failed") return null;

  const stageLabel = STAGE_LABELS[status] || status;
  const clipInfo = progress?.clipIndex !== undefined && progress?.clipTotal
    ? ` (${progress.clipIndex + 1}/${progress.clipTotal})`
    : "";

  const pct = progress?.clipTotal && progress.clipIndex !== undefined
    ? Math.round(((progress.clipIndex + 1) / progress.clipTotal) * 100)
    : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        <span>{stageLabel}{clipInfo}</span>
        {pct !== undefined && <span className="ml-auto">{pct}%</span>}
      </div>
      {pct !== undefined && <Progress value={pct} className="h-1.5" />}
    </div>
  );
}

export function FinalPreview({
  clips, storyboard, segments,
  subtitlesEnabled, logoEnabled, endCardEnabled,
  onToggleSubtitles, onToggleLogo, onToggleEndCard,
  onExport, exporting, finalVideoUrl, onOpenExportDialog,
  renderStatus, renderError, renderProgress, renderLog,
  onRetry, onDownloadLog,
}: FinalPreviewProps) {
  const effectiveScenes = endCardEnabled && storyboard.length > 1
    ? storyboard.slice(0, -1)
    : storyboard;
  const completedClips = clips.filter(c => c.status === "completed" && c.videoUrl);
  const completedForExport = completedClips.filter(c => effectiveScenes.some(s => s.id === c.sceneId));
  const allCompleted = completedForExport.length === effectiveScenes.length && effectiveScenes.length > 0;
  const videoRef = useRef<HTMLVideoElement>(null);

  const isFailed = renderStatus === "render_failed";
  const isAssembled = renderStatus === "assembled" || (!renderStatus && !!finalVideoUrl);
  const isRendering = renderStatus === "generating_voice" || renderStatus === "assembly_in_progress" || renderStatus === "validating";

  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Final Preview</h3>
          <Badge variant="outline" className="text-[10px]">
            {completedForExport.length}/{effectiveScenes.length} clips ready
            {endCardEnabled && storyboard.length > 1 && " (+end card)"}
          </Badge>
        </div>
        <Badge variant="secondary" className="text-[9px] gap-1 font-medium">
          ⚡ Alibaba Wan 2.6
        </Badge>
      </div>

      {/* Render Progress */}
      {isRendering && (
        <RenderProgressBar status={renderStatus} progress={renderProgress} />
      )}

      {/* Render Failed */}
      {isFailed && renderError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="text-sm font-semibold text-destructive">Render failed</p>
              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">
                Stage: {renderError.stage}
              </Badge>
              <p className="text-xs text-muted-foreground break-words">{renderError.message}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Retry Render
              </Button>
            )}
            {onDownloadLog && renderLog && renderLog.length > 0 && (
              <Button size="sm" variant="ghost" onClick={onDownloadLog} className="gap-1.5 text-xs text-muted-foreground">
                <FileDown className="w-3.5 h-3.5" /> Download Log
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Video Player — only when validated */}
      {isAssembled && finalVideoUrl ? (
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
      ) : !isFailed && !isRendering ? (() => {
        const generatingCount = clips.filter(c => c.status === "generating").length;
        const isGenerating = generatingCount > 0;
        return (
          <div className="aspect-video bg-black/50 rounded-lg flex items-center justify-center">
            <div className="text-center space-y-2">
              {isGenerating ? (
                <>
                  <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" />
                  <p className="text-xs text-muted-foreground">
                    Generating scenes... {completedForExport.length}/{effectiveScenes.length} completed
                  </p>
                </>
              ) : completedForExport.length > 0 ? (
                <>
                  <Play className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground">
                    {allCompleted ? "Ready to stitch — click Export" : `${effectiveScenes.length - completedForExport.length} scenes remaining`}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Generate scenes to preview</p>
              )}
            </div>
          </div>
        );
      })() : null}

      {/* Overlay Toggles */}
      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <Badge variant={logoEnabled ? "default" : "outline"} className="text-[10px] gap-1">
            <ImageIcon className="w-3 h-3" /> Logo {logoEnabled ? "✓" : "Off"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={endCardEnabled} onCheckedChange={onToggleEndCard} />
          <Label className="text-xs flex items-center gap-1"><LayoutTemplate className="w-3.5 h-3.5" /> End Card</Label>
        </div>
      </div>

      {/* Export */}
      <Button
        onClick={() => {
          if (isAssembled && finalVideoUrl && onOpenExportDialog) {
            onOpenExportDialog();
          } else {
            onExport();
          }
        }}
        disabled={!allCompleted || exporting || isRendering}
        className="w-full h-10 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-sm font-semibold"
      >
        {exporting || isRendering ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {STAGE_LABELS[renderStatus || "assembly_in_progress"] || "Stitching…"}
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Export 30s Ad
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
