import { AppBuilderChrome } from "@/components/app-builder/AppBuilderChrome";
import { AppBuilderHero } from "@/components/app-builder/AppBuilderHero";
import { AppBuilderDashboard } from "@/components/app-builder/AppBuilderDashboard";

export default function AppBuilder() {
  return (
    <AppBuilderChrome>
      <div className="app-builder-page">
        <AppBuilderHero />
        <AppBuilderDashboard />
      </div>
    </AppBuilderChrome>
  );
}
