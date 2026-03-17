import { ArrowRight, Sparkles, ToggleLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function AppBuilderHero() {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 via-amber-500 to-orange-400 p-8 md:p-12 min-h-[320px] flex flex-col justify-between shadow-2xl shadow-orange-500/10">
      {/* Decorative circles */}
      <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-white/5 blur-xl" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-white/80" />
          <span className="text-sm font-medium text-white/80 uppercase tracking-wider">AI-Powered</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-3">
          App Builder
        </h1>
        <p className="text-lg text-white/70 max-w-md">
          Architect new ventures powered by your ERP data
        </p>
      </div>

      <div className="relative z-10 flex items-center justify-between mt-8">
        <div className="flex items-center gap-2 text-white/50">
          <ToggleLeft className="w-5 h-5" />
          <span className="text-xs font-medium">Plan-first workflow</span>
        </div>
        <Button
          onClick={() => navigate("/app-builder/contractor-crm")}
          className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm gap-2"
        >
          Try Demo <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
