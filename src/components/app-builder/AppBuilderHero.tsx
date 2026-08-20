import { ArrowRight, Sparkles, ToggleLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import vizzyAvatar from "@/assets/vizzy-avatar.png";

export function AppBuilderHero() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[276px] overflow-hidden rounded-[22px] border border-white/8 bg-gradient-to-r from-[hsl(var(--dashboard-reference-hero-start))] to-[hsl(var(--dashboard-reference-hero-end))] px-11 pb-12 pt-9 shadow-[0_18px_36px_rgba(0,0,0,0.18)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,235,165,0.26),transparent_34%)]" />
      <div className="pointer-events-none absolute right-[-72px] top-[34px] h-[208px] w-[208px] rounded-full bg-white/10 blur-[4px]" />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="max-w-[520px]">
          <div className="mb-5 flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-white/90" />
            <span className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white/88">
              AI-POWERED
            </span>
          </div>
          <h1 className="text-[58px] font-extrabold leading-[0.96] tracking-[-0.04em] text-white md:text-[60px]">
            App Builder
          </h1>
          <p className="mt-5 max-w-[520px] text-[15px] font-medium text-white/82 md:text-[17px]">
            Architect new ventures powered by your ERP data
          </p>
        </div>

        <div className="mt-12 flex items-end justify-between gap-6">
          <div className="flex items-center gap-2 text-white/72">
            <ToggleLeft className="h-4 w-4" />
            <span className="text-[13px] font-medium">Plan-first workflow</span>
          </div>

          <div className="relative pr-20">
            <Button
              onClick={() => navigate("/app-builder/contractor-crm")}
              className="h-10 rounded-xl border border-white/18 bg-white/22 px-5 text-[14px] font-semibold text-white shadow-none backdrop-blur-[2px] hover:bg-white/28"
            >
              Try Demo
              <ArrowRight className="h-4 w-4" />
            </Button>

            <div className="absolute -bottom-[14px] right-0 h-[74px] w-[74px] overflow-hidden rounded-full border-[3px] border-[rgba(18,177,164,0.9)] bg-[#ffe3c5] shadow-[0_10px_24px_rgba(0,0,0,0.25)]">
              <img src={vizzyAvatar} alt="Assistant avatar" className="h-full w-full object-cover" />
            </div>
            <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[rgba(7,16,33,0.95)] bg-[#35d39a]" />
          </div>
        </div>
      </div>
    </section>
  );
}
