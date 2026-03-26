import { format } from "date-fns";
import { Download, Play, AlertTriangle, Trash2, FileText, Pencil, Check, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { downloadFile } from "@/lib/downloadUtils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { AdProjectRow } from "@/hooks/useAdProjectHistory";

interface VideoHistoryProps {
  projects: AdProjectRow[];
  onSelect?: (url: string) => void;
  onSelectDraft?: (project: AdProjectRow) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
}

/** Resolve the best preview video URL from a project */
function resolvePreviewUrl(project: AdProjectRow): string | null {
  // Completed videos: use final_video_url
  if (project.final_video_url && !project.final_video_url.startsWith("blob:")) {
    return project.final_video_url;
  }
  // Drafts: scan clips for a playable URL
  if (Array.isArray(project.clips) && project.clips.length > 0) {
    const clips = project.clips as any[];
    // Prefer completed clips first
    const completed = clips.filter((c) => c.status === "completed");
    const pool = completed.length > 0 ? completed : clips;
    for (const c of pool) {
      const url = c.videoUrl || c.video_url || c.url;
      if (url && typeof url === "string" && !url.startsWith("blob:")) return url;
    }
  }
  return null;
}

/** Extract a short text preview from the storyboard for drafts without video */
function resolvePreviewText(project: AdProjectRow): string | null {
  if (Array.isArray(project.storyboard) && project.storyboard.length > 0) {
    const scene = (project.storyboard as any[])[0];
    const text = scene?.prompt || scene?.voiceover || scene?.objective;
    if (text && typeof text === "string") {
      return text.length > 80 ? text.substring(0, 80).replace(/\s+\S*$/, "…") : text;
    }
  }
  return project.name || null;
}

export function VideoHistory({ projects, onSelect, onSelectDraft, onDelete, onRename }: VideoHistoryProps) {
  const visible = projects.filter((p) => {
    const hasVideo = p.final_video_url && !p.final_video_url.startsWith("blob:");
    const hasDraftClips = !p.final_video_url && Array.isArray(p.clips) && p.clips.length > 0;
    return hasVideo || hasDraftClips;
  });
  if (visible.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 animate-in fade-in duration-500">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Your Previous Videos</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {visible.map((p) => (
          <VideoCard
            key={p.id}
            project={p}
            previewUrl={resolvePreviewUrl(p)}
            onSelect={onSelect}
            onSelectDraft={onSelectDraft}
            onDelete={onDelete}
            onRename={onRename}
          />
        ))}
      </div>
    </div>
  );
}

function VideoCard({ project, previewUrl, onSelect, onSelectDraft, onDelete, onRename }: {
  project: AdProjectRow;
  previewUrl: string | null;
  onSelect?: (url: string) => void;
  onSelectDraft?: (project: AdProjectRow) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, newName: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovering, setHovering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name || "");

  const isDraft = !project.final_video_url;

  const handleMouseEnter = () => {
    setHovering(true);
    videoRef.current?.play().catch(() => {});
  };
  const handleMouseLeave = () => {
    setHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewUrl) downloadFile(previewUrl, `${project.name || "video"}.mp4`);
  };

  const handleClick = () => {
    if (isRenaming) return;
    if (isDraft) {
      onSelectDraft?.(project);
    } else if (previewUrl) {
      onSelect?.(previewUrl);
    }
  };

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(project.name || "");
    setIsRenaming(true);
  };

  const confirmRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== project.name) {
      onRename?.(project.id, trimmed);
    }
    setIsRenaming(false);
  };

  const cancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRenameValue(project.name || "");
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") confirmRename();
    if (e.key === "Escape") cancelRename();
  };

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border/40 bg-card/60 overflow-hidden cursor-pointer",
        "hover:border-primary/40 hover:shadow-md transition-all duration-200"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Video thumbnail */}
      <div className="aspect-video bg-muted/30 relative">
        {!previewUrl || hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
            {isDraft ? <FileText className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            <span className="text-[10px]">{isDraft ? "Draft" : "Video unavailable"}</span>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              src={previewUrl}
              preload="metadata"
              muted
              loop
              playsInline
              crossOrigin="anonymous"
              className="w-full h-full object-cover"
              onError={() => setHasError(true)}
            />
            {!hovering && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Play className="w-8 h-8 text-white/80 fill-white/80" />
              </div>
            )}
          </>
        )}
        {isDraft && (
          <div className="absolute top-1.5 right-1.5">
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Draft</Badge>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={() => confirmRename()}
                autoFocus
                className="h-6 text-xs px-1.5 py-0"
              />
              <button onClick={confirmRename} className="shrink-0 p-0.5 rounded hover:bg-muted/60" title="Save">
                <Check className="w-3.5 h-3.5 text-primary" />
              </button>
              <button onMouseDown={cancelRename} className="shrink-0 p-0.5 rounded hover:bg-muted/60" title="Cancel">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <p className="text-xs font-medium truncate">{project.name || "Untitled"}</p>
              {onRename && (
                <button
                  onClick={startRename}
                  className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted/60 transition-opacity"
                  title="Rename"
                >
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
          )}
          {!isRenaming && (
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(project.created_at), "MMM d, yyyy")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {!isDraft && previewUrl && !hasError && (
            <button
              onClick={handleDownload}
              className="shrink-0 p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
              title="Download"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
              className="shrink-0 p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
