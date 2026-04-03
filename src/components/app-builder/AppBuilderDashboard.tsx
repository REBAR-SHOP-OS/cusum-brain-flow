import { useNavigate } from "react-router-dom";
import { Clock3, Plus, ShoppingCart, ClipboardList, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SAMPLE_PROJECT, TEMPLATE_PROJECTS } from "@/data/appBuilderMockData";

const templateIcons = [BarChart3, ShoppingCart, ClipboardList];

function SurfaceCard({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-[22px] border border-[hsl(var(--dashboard-reference-border))] bg-[hsl(var(--dashboard-reference-surface))] shadow-[0_16px_40px_rgba(0,0,0,0.14)] ${onClick ? "cursor-pointer transition-transform duration-200 hover:-translate-y-0.5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function AppBuilderDashboard() {
  const navigate = useNavigate();
  const updatedLabel = new Date(SAMPLE_PROJECT.updatedAt).toLocaleDateString("en-US");

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[18px] font-bold tracking-[-0.02em] text-white">Recent Projects</h2>
          <Button
            onClick={() => navigate("/app-builder/new")}
            className="h-9 rounded-[10px] border-0 bg-[linear-gradient(180deg,#ff8a1a_0%,#ff7517_100%)] px-5 text-[15px] font-semibold text-white shadow-[0_8px_16px_rgba(255,129,25,0.22)] hover:opacity-95"
          >
            <Plus className="h-4 w-4" />
            Create New App
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[308px_308px_1fr]">
          <SurfaceCard
            onClick={() => navigate("/app-builder/contractor-crm")}
            className="min-h-[138px] px-5 py-[18px]"
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="pt-1 text-[14px] font-semibold leading-none text-white">
                {SAMPLE_PROJECT.name}
              </h3>
              <span className="rounded-full bg-[hsl(var(--dashboard-reference-ready)/0.18)] px-[10px] py-[5px] text-[11px] font-semibold lowercase leading-none text-[hsl(var(--dashboard-reference-ready))]">
                {SAMPLE_PROJECT.status}
              </span>
            </div>

            <p className="mt-5 max-w-[220px] text-[14px] leading-[1.45] text-[hsl(var(--dashboard-reference-muted))]">
              {SAMPLE_PROJECT.description}
            </p>

            <div className="mt-6 flex items-center gap-1.5 text-[12px] text-[hsl(var(--dashboard-reference-muted))]">
              <Clock3 className="h-3.5 w-3.5" />
              <span>Updated {updatedLabel}</span>
            </div>
          </SurfaceCard>

          <SurfaceCard
            onClick={() => navigate("/app-builder/new")}
            className="min-h-[138px] border-dashed bg-[rgba(17,23,40,0.66)]"
          >
            <div className="flex h-full min-h-[138px] flex-col items-center justify-center px-6 text-center">
              <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/6">
                <Plus className="h-5 w-5 text-[hsl(var(--dashboard-reference-muted))]" />
              </div>
              <span className="text-[15px] font-medium text-[hsl(var(--dashboard-reference-muted))]">
                Start from scratch
              </span>
            </div>
          </SurfaceCard>

          <div className="hidden lg:block" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-white">Quick Templates</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {TEMPLATE_PROJECTS.map((template, index) => {
            const Icon = templateIcons[index] ?? BarChart3;

            return (
              <SurfaceCard
                key={template.name}
                onClick={() => navigate("/app-builder/new")}
                className="min-h-[156px] px-5 py-5"
              >
                <div className="mb-8 flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/6 bg-white/[0.03] text-[#f4d4c7]">
                  <Icon className="h-[18px] w-[18px] stroke-[1.8]" />
                </div>

                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-white">
                  {template.name}
                </h3>
                <p className="mt-2 max-w-[250px] text-[14px] leading-[1.45] text-[hsl(var(--dashboard-reference-muted))]">
                  {template.description}
                </p>
              </SurfaceCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}
