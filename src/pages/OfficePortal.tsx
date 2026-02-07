import { useState } from "react";
import { OfficeSidebar, OfficeSection } from "@/components/office/OfficeSidebar";
import { CEODashboardView } from "@/components/office/CEODashboardView";
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
  "ceo-dashboard": CEODashboardView,
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
  const [activeSection, setActiveSection] = useState<OfficeSection>("ai-extract");

  const ActiveComponent = sectionComponents[activeSection];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <OfficeSidebar active={activeSection} onNavigate={setActiveSection} />
      <main className="flex-1 overflow-auto">
        <ActiveComponent />
      </main>
    </div>
  );
}
