import { CheckCircle2, Target, Users, Workflow, Shield, Plug, Star, Layers, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AppPlan } from "@/data/appBuilderMockData";

interface Props {
  plan: AppPlan;
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-orange-400" />
        <h3 className="font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function AppBuilderPlanView({ plan }: Props) {
  const complexityColors = { low: "text-emerald-400", medium: "text-amber-400", high: "text-red-400" };

  return (
    <div className="space-y-0">
      {/* Summary */}
      <Section icon={Target} title="App Summary">
        <p className="text-sm text-muted-foreground leading-relaxed">{plan.summary}</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted p-3">
            <span className="text-xs text-muted-foreground block mb-1">Business Goal</span>
            <p className="text-sm text-foreground">{plan.businessGoal}</p>
          </div>
          <div className="rounded-xl bg-muted p-3">
            <span className="text-xs text-muted-foreground block mb-1">Target Users</span>
            <p className="text-sm text-foreground">{plan.targetUsers}</p>
          </div>
        </div>
      </Section>

      {/* Key Workflows */}
      <Section icon={Workflow} title="Key Workflows">
        <ul className="space-y-2">
          {plan.keyWorkflows.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs shrink-0 mt-0.5">{i + 1}</span>
              {w}
            </li>
          ))}
        </ul>
      </Section>

      {/* Roles */}
      <Section icon={Users} title="Roles">
        <div className="flex flex-wrap gap-2">
          {plan.roles.map((r) => (
            <Badge key={r} className="bg-muted text-foreground border-0">{r}</Badge>
          ))}
        </div>
      </Section>

      {/* Features */}
      <Section icon={Star} title="Feature Plan">
        <div className="space-y-4">
          <div>
            <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-2 block">Must-Have</span>
            {plan.features.mustHave.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-foreground py-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {f}
              </div>
            ))}
          </div>
          <div>
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-2 block">Secondary</span>
            {plan.features.secondary.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" /> {f}
              </div>
            ))}
          </div>
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">Future</span>
            {plan.features.future.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground py-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" /> {f}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Integrations */}
      <Section icon={Plug} title="Suggested Integrations">
        <div className="flex flex-wrap gap-2">
          {plan.suggestedIntegrations.map((i) => (
            <Badge key={i} className="bg-blue-500/10 text-blue-400 border-0">{i}</Badge>
          ))}
        </div>
      </Section>

      {/* Build Readiness */}
      <Section icon={Rocket} title="Build Readiness">
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="text-center">
            <span className={`text-2xl font-bold ${complexityColors[plan.buildReadiness.complexity]}`}>
              {plan.buildReadiness.complexity.toUpperCase()}
            </span>
            <p className="text-xs text-muted-foreground mt-1">Complexity</p>
          </div>
          <div className="text-center">
            <span className="text-2xl font-bold text-foreground">~{plan.buildReadiness.screenCount}</span>
            <p className="text-xs text-muted-foreground mt-1">Screens</p>
          </div>
          <div className="text-center">
            <Shield className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="text-xs text-muted-foreground mt-1">Plan Ready</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{plan.buildReadiness.recommendation}</p>
      </Section>
    </div>
  );
}
