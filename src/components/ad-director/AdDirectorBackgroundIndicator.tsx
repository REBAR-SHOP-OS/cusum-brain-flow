import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Clapperboard, Eye, Loader2 } from "lucide-react";
import { backgroundAdDirectorService, type AdDirectorPipelineState } from "@/lib/backgroundAdDirectorService";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Floating global indicator — visible on every route EXCEPT /ad-director,
 * shown whenever the Ad Director pipeline is running or has just finished
 * with a result the user hasn't viewed yet.
 */
export function AdDirectorBackgroundIndicator() {
  const [state, setState] = useState<AdDirectorPipelineState>(backgroundAdDirectorService.getState());
  const [running, setRunning] = useState<boolean>(backgroundAdDirectorService.isRunning());
  const [dismissedFinalUrl, setDismissedFinalUrl] = useState<string | null>(null);
  const [lastNotifiedUrl, setLastNotifiedUrl] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Subscribe but DO NOT replace AdDirectorContent's listener while it's mounted.
    // We poll lightly instead so multiple consumers can coexist.
    const tick = () => {
      setState(backgroundAdDirectorService.getState());
      setRunning(backgroundAdDirectorService.isRunning());
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Toast once when a new final video appears while user is off the page
  useEffect(() => {
    if (!state.finalVideoUrl) return;
    if (location.pathname === "/ad-director") return;
    if (state.finalVideoUrl === lastNotifiedUrl) return;
    setLastNotifiedUrl(state.finalVideoUrl);
    toast.success("🎬 Your video is ready!", {
      description: "Click View to open the result.",
      action: { label: "View", onClick: () => navigate("/ad-director") },
      duration: 10_000,
    });
  }, [state.finalVideoUrl, location.pathname, lastNotifiedUrl, navigate]);

  // On /ad-director, hide ONLY when the page is showing its own full-screen
  // generating overlay (avoid duplicate). In editor/result views, still show
  // the floating indicator so background regenerations are visible.
  const onAdDirectorPage = location.pathname === "/ad-director";
  const pageShowsOwnProgress =
    onAdDirectorPage && state.flowState === "generating" && (state.progressValue ?? 0) < 100;
  if (pageShowsOwnProgress) return null;

  const isFinishedUnviewed =
    !running && !!state.finalVideoUrl && state.finalVideoUrl !== dismissedFinalUrl;

  if (!running && !isFinishedUnviewed) return null;

  const progress = Math.max(0, Math.min(100, state.progressValue || 0));
  const status = running ? (state.statusText || "Working...") : "Video ready";

  return (
    <div className="fixed bottom-20 right-4 z-[100] md:bottom-6 md:right-6 pointer-events-auto">
      <div className="flex items-center gap-3 rounded-full border border-cyan-400/30 bg-slate-900/95 px-4 py-2.5 shadow-2xl backdrop-blur-md">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-300">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clapperboard className="h-4 w-4" />}
        </div>
        <div className="min-w-[160px] max-w-[240px]">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-200">
            {running ? "Generating video" : "Video ready"}
          </div>
          <div className="truncate text-xs text-white/75">{status}</div>
          {running && (
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="h-8 gap-1 rounded-full bg-white/10 text-white hover:bg-white/20"
          onClick={() => {
            if (isFinishedUnviewed) setDismissedFinalUrl(state.finalVideoUrl);
            navigate("/ad-director");
          }}
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </Button>
      </div>
    </div>
  );
}
