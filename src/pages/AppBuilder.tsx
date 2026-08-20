import { AppBuilderHero } from "@/components/app-builder/AppBuilderHero";
import { AppBuilderDashboard } from "@/components/app-builder/AppBuilderDashboard";

export default function AppBuilder() {
  return (
    <div className="h-full overflow-y-auto bg-[hsl(var(--dashboard-reference-bg))]">
      <div className="mx-auto flex min-h-full max-w-[1100px] flex-col px-5 pb-10 pt-6 md:px-6 md:pb-12 md:pt-7">
        <div className="space-y-9">
          <AppBuilderHero />
          <AppBuilderDashboard />
        </div>
      </div>
    </div>
  );
}
