import { ArrowRight, Sparkles, ToggleLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AppBuilderHero() {
  const navigate = useNavigate();

  return (
    <section className="app-builder-hero">
      <div className="app-builder-hero__glow app-builder-hero__glow--top" />
      <div className="app-builder-hero__glow app-builder-hero__glow--bottom" />

      <div className="app-builder-hero__content">
        <div className="app-builder-hero__eyebrow">
          <Sparkles className="h-[17px] w-[17px]" />
          <span>AI-POWERED</span>
        </div>

        <h1 className="app-builder-hero__title">App Builder</h1>
        <p className="app-builder-hero__subtitle">
          Architect new ventures powered by your ERP data
        </p>
      </div>

      <div className="app-builder-hero__footer">
        <div className="app-builder-hero__label">
          <ToggleLeft className="h-[16px] w-[16px]" />
          <span>Plan-first workflow</span>
        </div>

        <button
          type="button"
          onClick={() => navigate("/app-builder/contractor-crm")}
          className="app-builder-hero__cta"
        >
          <span>Try Demo</span>
          <ArrowRight className="h-[15px] w-[15px]" />
        </button>

        <div className="app-builder-hero__assistant" aria-hidden="true">
          <div className="app-builder-hero__assistant-face">AI</div>
          <span className="app-builder-hero__assistant-dot" />
        </div>
      </div>
    </section>
  );
}
