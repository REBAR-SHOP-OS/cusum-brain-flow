import { format } from "date-fns";
import { Download, Play, AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { downloadFile } from "@/lib/downloadUtils";
import type { AdProjectRow } from "@/hooks/useAdProjectHistory";

interface VideoHistoryProps {
  projects: AdProjectRow[];
  onSelect?: (url: string) => void;
}

export function VideoHistory({ projects, onSelect }: VideoHistoryProps) {
  // Filter out blob: URLs (irrecoverable) and show only valid URLs
  const completed = projects.filter(
    (p) => p.final_video_url && !p.final_video_url.startsWith("blob:")
  );
  if (completed.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 animate-in fade-in duration-500">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">ویدئوهای قبلی شما</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {completed.map((p) => (
          <VideoCard key={p.id} project={p} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function VideoCard({ project, onSelect }: { project: AdProjectRow; onSelect?: (url: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovering, setHovering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const url = project.final_video_url!;

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
    downloadFile(url, `${project.name || "video"}.mp4`);
  };

  return (
    <div
      className={cn(
        "group relative rounded-xl border border-border/40 bg-card/60 overflow-hidden cursor-pointer",
        "hover:border-primary/40 hover:shadow-md transition-all duration-200"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelect?.(url)}
    >
      {/* Video thumbnail */}
      <div className="aspect-video bg-muted/30 relative">
        {hasError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground">
            <AlertTriangle className="w-6 h-6" />
            <span className="text-[10px]">ویدیو در دسترس نیست</span>
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
      </div>

      {/* Info */}
      <div className="p-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{project.name || "Untitled"}</p>
          <p className="text-[10px] text-muted-foreground">
            {format(new Date(project.created_at), "MMM d, yyyy")}
          </p>
        </div>
        {!hasError && (
          <button
            onClick={handleDownload}
            className="shrink-0 p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
            title="دانلود"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
