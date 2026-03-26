import { format } from "date-fns";
import { Download, Play, AlertTriangle, Trash2, FileText } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { downloadFile } from "@/lib/downloadUtils";
import { Badge } from "@/components/ui/badge";
import type { AdProjectRow } from "@/hooks/useAdProjectHistory";

interface VideoHistoryProps {
  projects: AdProjectRow[];
  onSelect?: (url: string) => void;
  onSelectDraft?: (project: AdProjectRow) => void;
  onDelete?: (id: string) => void;
}

export function VideoHistory({ projects, onSelect, onSelectDraft, onDelete }: VideoHistoryProps) {
  // Show projects that have a valid final video URL OR have clips data (drafts)
  const visible = projects.filter((p) => {
    const hasVideo = p.final_video_url && !p.final_video_url.startsWith("blob:");
    const hasDraftClips = !p.final_video_url && Array.isArray(p.clips) && p.clips.length > 0;
    return hasVideo || hasDraftClips;
  });
  if (visible.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 animate-in fade-in duration-500">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">ویدئوهای قبلی شما</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {visible.map((p) => (
          <VideoCard key={p.id} project={p} onSelect={onSelect} onSelectDraft={onSelectDraft} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function VideoCard({ project, onSelect, onSelectDraft, onDelete }: {
  project: AdProjectRow;
  onSelect?: (url: string) => void;
  onSelectDraft?: (project: AdProjectRow) => void;
  onDelete?: (id: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovering, setHovering] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isDraft = !project.final_video_url;
  // For drafts, use the first completed clip's videoUrl as thumbnail
  const url = isDraft
    ? (Array.isArray(project.clips) ? (project.clips as any[]).find((c) => c.videoUrl || c.video_url || c.url)?.videoUrl || (project.clips as any[]).find((c) => c.video_url)?.video_url || (project.clips as any[]).find((c) => c.url)?.url : null)
    : project.final_video_url!;

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
    if (url) downloadFile(url, `${project.name || "video"}.mp4`);
  };

  const handleClick = () => {
    if (isDraft) {
      onSelectDraft?.(project);
    } else {
      onSelect?.(url!);
    }
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
        {!url || hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
            {isDraft ? <FileText className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            <span className="text-[10px]">{isDraft ? "پیش‌نویس" : "ویدیو در دسترس نیست"}</span>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              src={url}
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
        {/* Draft badge */}
        {isDraft && (
          <div className="absolute top-1.5 right-1.5">
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">پیش‌نویس</Badge>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{project.name || "Untitled"}</p>
          <p className="text-[10px] text-muted-foreground">
            {format(new Date(project.created_at), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          {!isDraft && url && !hasError && (
            <button
              onClick={handleDownload}
              className="shrink-0 p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
              title="دانلود"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
              className="shrink-0 p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
              title="حذف"
            >
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
