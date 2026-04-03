import { format } from "date-fns";
import { Download, Play, AlertTriangle, Trash2, Pencil, Check, X, Sparkles, Clock3 } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { downloadFile } from "@/lib/downloadUtils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { AdProjectRow } from "@/hooks/useAdProjectHistory";

type LegacyClipPreview = {
  status?: string;
  videoUrl?: string | null;
  video_url?: string | null;
  url?: string | null;
};

type LegacyStoryboardPreview = {
  prompt?: string | null;
  voiceover?: string | null;
  objective?: string | null;
};

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
    const clips = project.clips as LegacyClipPreview[];
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
    const scene = project.storyboard[0] as LegacyStoryboardPreview | undefined;
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
    // Draft: only show if at least one clip is completed with a valid videoUrl
    const hasDraftClips = !p.final_video_url && Array.isArray(p.clips) && (p.clips as LegacyClipPreview[]).some(
      (c) => c.status === "completed" && c.videoUrl && typeof c.videoUrl === "string" && !c.videoUrl.startsWith("blob:")
    );
    const hasThumbnail = !!p.thumbnail_url;
    return hasVideo || hasDraftClips || hasThumbnail;
  });

  // Deduplicate: keep only the most recent project per script/name
  const deduped = Object.values(
    visible.reduce((acc, p) => {
      const key = p.script || p.name || p.id;
      if (!acc[key] || new Date(p.updated_at) > new Date(acc[key].updated_at)) {
        acc[key] = p;
      }
      return acc;
    }, {} as Record<string, AdProjectRow>)
  );
  if (deduped.length === 0) return null;

  return (
    <div className="mt-6 animate-in fade-in duration-500">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-white/90">Recent concepts</h3>
          <p className="text-xs text-white/46">
            Open a draft to continue refining it, or jump back into a completed render.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/55">
          <Clock3 className="h-3.5 w-3.5 text-primary" />
          {deduped.length} saved {deduped.length === 1 ? "project" : "projects"}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {deduped.map((p) => (
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
        "group relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04] cursor-pointer transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-[0_24px_60px_-42px_rgba(0,0,0,0.9)]"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Video thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-black/30">
        {!previewUrl || hasError ? (
          project.thumbnail_url ? (
            <img
              src={project.thumbnail_url}
              alt={project.name || "Project thumbnail"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : isDraft ? (
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.09),transparent_30%),linear-gradient(180deg,rgba(11,15,25,0.38),rgba(6,8,14,0.92))]" />
              <div className="absolute inset-0 flex flex-col justify-between p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-white/45">Draft concept</p>
                  <p className="text-sm leading-6 text-white/78 line-clamp-3">
                    {resolvePreviewText(project) || "Draft project"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 text-white/55">
              <AlertTriangle className="w-6 h-6" />
              <span className="text-[10px] uppercase tracking-[0.18em]">Video unavailable</span>
            </div>
          )
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
            {!hovering && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-black/35 backdrop-blur-md">
                  <Play className="w-5 h-5 text-white/90 fill-white/90" />
                </div>
              </div>
            )}
          </>
        )}
        <div className="absolute left-3 top-3">
          <Badge
            variant="secondary"
            className={cn(
              "border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em]",
              isDraft ? "bg-white/[0.08] text-white/80" : "bg-emerald-500/15 text-emerald-200"
            )}
          >
            {isDraft ? "Draft" : "Ready"}
          </Badge>
        </div>
      </div>

      {/* Info */}
      <div className="flex items-center justify-between gap-3 p-3.5">
        <div className="min-w-0 flex-1">
          {isRenaming ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                onBlur={() => confirmRename()}
                autoFocus
                className="h-8 border-white/10 bg-black/20 px-2 text-xs text-white"
              />
              <button onClick={confirmRename} className="shrink-0 rounded-lg p-1 hover:bg-white/10" title="Save">
                <Check className="w-3.5 h-3.5 text-primary" />
              </button>
              <button onMouseDown={cancelRename} className="shrink-0 rounded-lg p-1 hover:bg-white/10" title="Cancel">
                <X className="w-3.5 h-3.5 text-white/55" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-white truncate">{project.name || "Untitled"}</p>
              {onRename && (
                <button
                  onClick={startRename}
                  className="shrink-0 rounded-lg p-1 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
                  title="Rename"
                >
                  <Pencil className="w-3 h-3 text-white/55" />
                </button>
              )}
            </div>
          )}
          {!isRenaming && (
            <p className="text-[11px] text-white/45">
              {format(new Date(project.created_at), "MMM d, yyyy")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {!isDraft && previewUrl && !hasError && (
            <button
              onClick={handleDownload}
              className="shrink-0 rounded-xl p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              title="Download"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
              className="shrink-0 rounded-xl p-2 text-white/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
