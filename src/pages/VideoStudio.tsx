import { Clapperboard } from "lucide-react";
import { VideoStudioContent } from "@/components/social/VideoStudioContent";

export default function VideoStudio() {
  return (
    <div className="min-h-screen flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="max-w-5xl mx-auto w-full px-4 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Clapperboard className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Video Studio</h1>
            <p className="text-sm text-muted-foreground">
              Type anything — we'll engineer a cinematic prompt and generate your video
            </p>
          </div>
        </div>
      </div>

      {/* Studio Content — flex-1 so prompt bar sits at bottom */}
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 pb-6">
        <VideoStudioContent fullPage />
      </div>
    </div>
  );
}
