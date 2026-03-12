import { Clapperboard } from "lucide-react";
import { AdDirectorContent } from "@/components/ad-director/AdDirectorContent";

export default function AdDirector() {
  return (
    <div className="min-h-screen flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="max-w-6xl mx-auto w-full px-4 pt-6 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Clapperboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Video Director</h1>
            <p className="text-sm text-muted-foreground">
              Intelligent 30-second B2B ad production — from script to cinematic video
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 pb-8 pt-4">
        <AdDirectorContent />
      </div>
    </div>
  );
}
