import { useNavigate } from "react-router-dom";
import { Clock3, Plus, ShoppingCart } from "lucide-react";
import { SAMPLE_PROJECT, TEMPLATE_PROJECTS } from "@/data/appBuilderMockData";

export function AppBuilderDashboard() {
  const navigate = useNavigate();

  return (
    <div className="app-builder-dashboard">
      <section className="app-builder-section">
        <div className="app-builder-section__header">
          <h2 className="app-builder-section__title">Recent Projects</h2>

          <button
            type="button"
            className="app-builder-primary-button"
            onClick={() => navigate("/app-builder/new")}
          >
            <Plus className="h-[16px] w-[16px]" />
            <span>Create New App</span>
          </button>
        </div>

        <div className="app-builder-project-grid">
          <button
            type="button"
            onClick={() => navigate("/app-builder/contractor-crm")}
            className="app-builder-project-card app-builder-project-card--filled"
          >
            <div className="app-builder-project-card__top">
              <h3 className="app-builder-project-card__title">{SAMPLE_PROJECT.name}</h3>
              <span className="app-builder-status-pill">ready</span>
            </div>

            <p className="app-builder-project-card__description">{SAMPLE_PROJECT.description}</p>

            <div className="app-builder-project-card__meta">
              <Clock3 className="h-[13px] w-[13px]" />
              <span>Updated 3/17/2026</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/app-builder/new")}
            className="app-builder-project-card app-builder-project-card--empty"
          >
            <div className="app-builder-project-card__plus">
              <Plus className="h-[24px] w-[24px]" />
            </div>
            <span className="app-builder-project-card__empty-label">Start from scratch</span>
          </button>
        </div>
      </section>

      <section className="app-builder-section">
        <h2 className="app-builder-section__title">Quick Templates</h2>

        <div className="app-builder-template-grid">
          {TEMPLATE_PROJECTS.map((template, index) => {
            const icon =
              index === 0 ? (
                <span className="app-builder-template-card__emoji" aria-hidden="true">
                  {template.icon}
                </span>
              ) : index === 1 ? (
                <ShoppingCart className="h-[22px] w-[22px] text-[#aebad5]" aria-hidden="true" />
              ) : (
                <span className="app-builder-template-card__emoji" aria-hidden="true">
                  {template.icon}
                </span>
              );

            return (
              <button
                key={template.name}
                type="button"
                onClick={() => navigate("/app-builder/new")}
                className="app-builder-template-card"
              >
                <div className="app-builder-template-card__icon">{icon}</div>
                <h3 className="app-builder-template-card__title">{template.name}</h3>
                <p className="app-builder-template-card__description">{template.description}</p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
