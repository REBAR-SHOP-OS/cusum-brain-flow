import { Clapperboard } from "lucide-react";
import { VideoStudioContent } from "@/components/social/VideoStudioContent";

export default function VideoStudio() {
  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Clapperboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Video Studio</h1>
            <p className="text-sm text-muted-foreground">
              Type anything — we'll engineer a cinematic prompt and generate your video
            </p>
          </div>
        </div>

        {/* Studio Content */}
        <VideoStudioContent fullPage />
      </div>
    </div>
  );
}
