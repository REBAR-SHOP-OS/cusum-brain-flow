import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { IntelligencePanel } from "./IntelligencePanel";
import { MobileNavV2 } from "./MobileNavV2";
import { AppTour } from "@/components/tour/AppTour";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { LiveChatWidget } from "./LiveChatWidget";
import { FloatingVizzyButton } from "@/components/vizzy/FloatingVizzyButton";
import { ScreenshotFeedbackButton } from "@/components/feedback/ScreenshotFeedbackButton";
import { VizzyCallHandler } from "@/components/vizzy/VizzyCallHandler";
import { useFixRequestMonitor } from "@/hooks/useFixRequestMonitor";
import { ChatPanelProvider } from "@/contexts/ChatPanelContext";
import { DockChatProvider } from "@/contexts/DockChatContext";
import { DockChatBar } from "@/components/chat/DockChatBar";
import { useAuth } from "@/lib/auth";
import { logNavigation } from "@/lib/activityLogger";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  // Background monitor — polls for user-actionable fix requests
  useFixRequestMonitor();

  const { user } = useAuth();
  const isInternal = (user?.email ?? "").endsWith("@rebar.shop");
  const location = useLocation();
  const isAppBuilderDashboard = location.pathname === "/app-builder";

  // Log navigation for all authenticated users
  useEffect(() => {
    if (user) {
      logNavigation(location.pathname);
    }
  }, [location.pathname, user]);

  return (
    <RoleGuard>
      <ChatPanelProvider>
        <DockChatProvider>
          <div
            className="flex h-screen flex-col bg-background"
            data-app-builder-dashboard={isAppBuilderDashboard ? "true" : undefined}
          >
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
              <main
                id="main-content"
                className="flex-1 overflow-hidden pb-14 md:pb-0"
                data-app-builder-dashboard={isAppBuilderDashboard ? "true" : undefined}
              >
                {children}
              </main>

              {/* Intelligence Panel (right side) */}
              <div className={isAppBuilderDashboard ? "hidden" : "hidden md:flex"}>
                <IntelligencePanel />
              </div>
            </div>

            {/* Mobile bottom nav */}
            <MobileNavV2 />

            {/* Vizzy Phone Manager — auto-answers calls on ext 101 */}
            {isInternal && <VizzyCallHandler />}

            {/* Floating Vizzy avatar — force visible on app builder dashboard to match reference */}
            {(user?.email === "sattar@rebar.shop" || user?.email === "radin@rebar.shop") && <FloatingVizzyButton />}

            {/* Screenshot Feedback button — force visible on app builder dashboard to match reference */}
            {(isInternal || isAppBuilderDashboard) && <ScreenshotFeedbackButton />}

            {/* Live Chat Widget — triggered by Vizzy button */}
            {(user?.email === "sattar@rebar.shop" || user?.email === "radin@rebar.shop") && <LiveChatWidget />}

            {/* Docked team chat boxes */}
            <DockChatBar />
          </div>
        </DockChatProvider>
      </ChatPanelProvider>
    </RoleGuard>
  );
}
