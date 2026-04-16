import { useState, useRef } from "react";
import { Clapperboard, Sparkles, SkipForward } from "lucide-react";
import { AdDirectorContent } from "@/components/ad-director/AdDirectorContent";
import { AdDirectorErrorBoundary } from "@/components/ad-director/AdDirectorErrorBoundary";

export default function AdDirector() {
  const [isEditing, setIsEditing] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  if (showIntro) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          src="/videos/ad-director-intro.mp4"
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
          onEnded={() => setShowIntro(false)}
          onError={() => setShowIntro(false)}
        />
        <button
          onClick={() => setShowIntro(false)}
          className="absolute bottom-8 right-8 flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/20 transition-colors"
        >
          <SkipForward className="w-4 h-4" />
          Skip
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-950">
      {!isEditing && (
        <div className="max-w-6xl mx-auto w-full px-4 pt-4 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-800 text-white">
                <Clapperboard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-white">AI Video Director</h1>
                <p className="text-xs text-white/55">Turn one idea into a polished, editable B2B video ad.</p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Modernized idea flow
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className={isEditing ? "w-full px-2 pb-2 pt-1 h-full" : "max-w-6xl mx-auto w-full px-4 pb-8 pt-3"}>
          <AdDirectorErrorBoundary>
            <AdDirectorContent onEditingChange={setIsEditing} />
          </AdDirectorErrorBoundary>
        </div>
      </div>
    </div>
  );
}
