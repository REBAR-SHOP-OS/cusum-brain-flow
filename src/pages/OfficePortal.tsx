import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Menu, Shield } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { OfficeSidebar, OfficeSection } from "@/components/office/OfficeSidebar";
import { AIExtractView } from "@/components/office/AIExtractView";
import { DetailedListView } from "@/components/office/DetailedListView";
import { ProductionQueueView } from "@/components/office/ProductionQueueView";
import { InventoryView } from "@/components/office/InventoryView";
import { OptimizationView } from "@/components/office/OptimizationView";
import { TagsExportView } from "@/components/office/TagsExportView";
import { PackingSlipsView } from "@/components/office/PackingSlipsView";

import { PayrollAuditView } from "@/components/office/PayrollAuditView";
import { ScreenshotFeedbackButton } from "@/components/feedback/ScreenshotFeedbackButton";
import { useAuth } from "@/lib/auth";

const sectionComponents: Record<OfficeSection, React.ComponentType> = {
  "ai-extract": AIExtractView,
  "detailed-list": DetailedListView,
  "production-queue": ProductionQueueView,
  "inventory": InventoryView,
  "optimization": OptimizationView,
  "tags-export": TagsExportView,
  "packing-slips": PackingSlipsView,
  "payroll": PayrollAuditView,
};

export default function OfficePortal() {
  const { isAdmin, isOffice, isLoading: roleLoading } = useUserRole();
  const { user } = useAuth();
  const isRebarUser = (user?.email ?? "").endsWith("@rebar.shop");
  const location = useLocation();
  const rawSection = (location.state as any)?.section || "ai-extract";
  const initialSection = rawSection === "ceo-dashboard" ? "ai-extract" : rawSection;
  const [activeSection, setActiveSection] = useState<OfficeSection>(initialSection);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (roleLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isAdmin && !isOffice) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">Only administrators and office staff can access this portal.</p>
        </div>
      </div>
    );
  }

  const ActiveComponent = sectionComponents[activeSection];

  const handleNavigate = (section: OfficeSection) => {
    setActiveSection(section);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Mobile sidebar sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[200px]">
          <OfficeSidebar active={activeSection} onNavigate={handleNavigate} />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <OfficeSidebar active={activeSection} onNavigate={handleNavigate} />
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="flex md:hidden items-center gap-2 px-3 py-2 border-b border-border bg-card/50 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium truncate capitalize">
            {activeSection.replace(/-/g, " ")}
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <ActiveComponent />
        </div>
      </main>
      {isRebarUser && <ScreenshotFeedbackButton />}
    </div>
  );
}
