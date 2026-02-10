import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { OfficeSidebar, OfficeSection } from "@/components/office/OfficeSidebar";
import { AIExtractView as FallbackView } from "@/components/office/AIExtractView";
import { AIExtractView } from "@/components/office/AIExtractView";
import { DetailedListView } from "@/components/office/DetailedListView";
import { ProductionQueueView } from "@/components/office/ProductionQueueView";
import { InventoryView } from "@/components/office/InventoryView";
import { OptimizationView } from "@/components/office/OptimizationView";
import { TagsExportView } from "@/components/office/TagsExportView";
import { PackingSlipsView } from "@/components/office/PackingSlipsView";
import { PayrollAuditView } from "@/components/office/PayrollAuditView";
import { LiveMonitorView } from "@/components/office/LiveMonitorView";
import { DiagnosticLogView } from "@/components/office/DiagnosticLogView";
import { MemberAreaView } from "@/components/office/MemberAreaView";

const sectionComponents: Record<OfficeSection, React.ComponentType> = {
  "ceo-dashboard": FallbackView,
  "ai-extract": AIExtractView,
  "detailed-list": DetailedListView,
  "production-queue": ProductionQueueView,
  "inventory": InventoryView,
  "optimization": OptimizationView,
  "tags-export": TagsExportView,
  "packing-slips": PackingSlipsView,
  "payroll-audit": PayrollAuditView,
  "live-monitor": LiveMonitorView,
  "diagnostic-log": DiagnosticLogView,
  "member-area": MemberAreaView,
};

export default function OfficePortal() {
  const location = useLocation();
  const rawSection = (location.state as any)?.section || "ai-extract";
  const initialSection = rawSection === "ceo-dashboard" ? "ai-extract" : rawSection;
  const [activeSection, setActiveSection] = useState<OfficeSection>(initialSection);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    </div>
  );
}
