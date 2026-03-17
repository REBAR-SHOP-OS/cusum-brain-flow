import { useNavigate } from "react-router-dom";
import { Plus, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SAMPLE_PROJECT, TEMPLATE_PROJECTS } from "@/data/appBuilderMockData";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  planning: "bg-amber-500/20 text-amber-400",
  ready: "bg-emerald-500/20 text-emerald-400",
  exported: "bg-blue-500/20 text-blue-400",
};

export function AppBuilderDashboard() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      {/* Project Cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">Recent Projects</h2>
          <Button
            onClick={() => navigate("/app-builder/new")}
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white gap-2"
          >
            <Plus className="w-4 h-4" /> Create New App
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Sample project card */}
          <div
            onClick={() => navigate("/app-builder/contractor-crm")}
            className="group rounded-2xl border border-border bg-card p-5 cursor-pointer transition-all hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold text-foreground group-hover:text-orange-400 transition-colors">{SAMPLE_PROJECT.name}</h3>
              <Badge className={statusColors[SAMPLE_PROJECT.status]}>{SAMPLE_PROJECT.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{SAMPLE_PROJECT.description}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Updated {new Date(SAMPLE_PROJECT.updatedAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Empty state / create new */}
          <div
            onClick={() => navigate("/app-builder/new")}
            className="group rounded-2xl border border-dashed border-border bg-card/50 p-5 cursor-pointer transition-all hover:border-orange-500/30 flex flex-col items-center justify-center min-h-[160px]"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3 group-hover:bg-orange-500/20 transition-colors">
              <Plus className="w-5 h-5 text-muted-foreground group-hover:text-orange-400" />
            </div>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Start from scratch</span>
          </div>
        </div>
      </div>

      {/* Templates */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Quick Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TEMPLATE_PROJECTS.map((t) => (
            <div
              key={t.name}
              onClick={() => navigate("/app-builder/new")}
              className="group rounded-2xl border border-border bg-card p-5 cursor-pointer transition-all hover:border-orange-500/30"
            >
              <div className="text-2xl mb-3">{t.icon}</div>
              <h3 className="font-semibold text-foreground mb-1">{t.name}</h3>
              <p className="text-sm text-muted-foreground">{t.description}</p>
              <div className="mt-3 flex items-center gap-1 text-xs text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity">
                Use template <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: "Plan First", desc: "Generate structured app plans before writing any code" },
          { title: "AI-Powered", desc: "Describe your app in plain English — AI handles the architecture" },
          { title: "Export Ready", desc: "Export to React, Next.js, or Supabase schema when ready" },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border border-border bg-card/50 p-5">
            <h4 className="font-semibold text-foreground mb-1">{f.title}</h4>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
