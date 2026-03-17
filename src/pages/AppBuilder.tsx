import { AppBuilderHero } from "@/components/app-builder/AppBuilderHero";
import { AppBuilderDashboard } from "@/components/app-builder/AppBuilderDashboard";

export default function AppBuilder() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <AppBuilderHero />
        <AppBuilderDashboard />
      </div>
    </div>
  );
}
