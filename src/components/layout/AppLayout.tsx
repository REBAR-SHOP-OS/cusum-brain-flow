import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { IntelligencePanel } from "./IntelligencePanel";
import { MobileNavV2 } from "./MobileNavV2";
import { AppTour } from "@/components/tour/AppTour";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { LiveChatWidget } from "./LiveChatWidget";
import { FloatingVizzyButton } from "@/components/vizzy/FloatingVizzyButton";
import { useFixRequestMonitor } from "@/hooks/useFixRequestMonitor";
import { ChatPanelProvider } from "@/contexts/ChatPanelContext";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  // Background monitor — polls for user-actionable fix requests
  useFixRequestMonitor();

  return (
    <RoleGuard>
      <ChatPanelProvider>
        <div className="flex flex-col h-screen bg-background">
          {/* Skip to main content link for keyboard/screen-reader users */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium"
          >
            Skip to main content
          </a>

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
            <main id="main-content" className="flex-1 overflow-hidden pb-14 md:pb-0">
              {children}
            </main>

            {/* Intelligence Panel (right side) */}
            <div className="hidden md:flex">
              <IntelligencePanel />
            </div>
          </div>

          {/* Mobile bottom nav */}
          <MobileNavV2 />

          {/* Floating Vizzy avatar — always visible for super admin */}
          <FloatingVizzyButton />

          {/* Live Chat Widget — triggered by Vizzy button */}
          <LiveChatWidget />
        </div>
      </ChatPanelProvider>
    </RoleGuard>
  );
}
