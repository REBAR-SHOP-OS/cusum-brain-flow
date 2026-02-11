import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { IntelligencePanel } from "./IntelligencePanel";
import { MobileNavV2 } from "./MobileNavV2";
import { AppTour } from "@/components/tour/AppTour";
import { VoiceVizzy } from "@/components/vizzy/VoiceVizzy";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { SmartErrorBoundary } from "@/components/error/SmartErrorBoundary";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <RoleGuard>
      <div className="flex flex-col h-screen bg-background">
        {/* Onboarding Tour */}
        <AppTour />

        {/* Top bar */}
        <TopBar />

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop sidebar */}
          <div className="hidden md:flex">
            <AppSidebar />
          </div>

          {/* Main content - add bottom padding on mobile for nav bar */}
          <main className="flex-1 overflow-hidden pb-14 md:pb-0">
            {children}
          </main>

          {/* Intelligence Panel (right side) */}
          <div className="hidden md:flex">
            <IntelligencePanel />
          </div>
        </div>

        {/* Mobile bottom nav */}
        <MobileNavV2 />

        {/* Voice Vizzy — Jarvis mode (sattar only) */}
        <SmartErrorBoundary level="component" maxAutoRetries={1}>
          <VoiceVizzy />
        </SmartErrorBoundary>
      </div>
    </RoleGuard>
  );
}
