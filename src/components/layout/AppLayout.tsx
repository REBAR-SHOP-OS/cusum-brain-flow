import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { IntelligencePanel } from "./IntelligencePanel";
import { MobileNavV2 } from "./MobileNavV2";
import { AppTour } from "@/components/tour/AppTour";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { LiveChatWidget } from "./LiveChatWidget";

interface AppLayoutProps {
  children: React.ReactNode;
}

const VIZZY_ALLOWED_EMAIL = "sattar@rebar.shop";

export function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const showVizzyButton = user?.email === VIZZY_ALLOWED_EMAIL;

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

        {/* Live Chat Widget */}
        <LiveChatWidget />

        {/* Floating mic → opens /vizzy (sattar only) */}
        {showVizzyButton && (
          <button
            onClick={() => navigate("/vizzy")}
            className={cn(
              "fixed bottom-36 right-4 z-50 md:bottom-[5.5rem] md:right-6",
              "flex items-center justify-center w-12 h-12 rounded-full",
              "bg-secondary text-foreground shadow-lg border border-border",
              "hover:scale-105 active:scale-95 transition-transform"
            )}
            aria-label="Talk to Vizzy"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </RoleGuard>
  );
}
