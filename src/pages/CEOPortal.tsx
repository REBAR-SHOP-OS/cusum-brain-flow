import { ScrollArea } from "@/components/ui/scroll-area";
import { CEODashboardView } from "@/components/office/CEODashboardView";
import { DailyBriefingCard } from "@/components/ceo/DailyBriefingCard";
import { DailyAssignments } from "@/components/ceo/DailyAssignments";
import { FixRequestQueue } from "@/components/ceo/FixRequestQueue";
import { AgentSuggestionsPanel } from "@/components/agent/AgentSuggestionsPanel";
import { OdooMigrationStatusCard } from "@/components/admin/OdooMigrationStatusCard";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import { Shield } from "lucide-react";

export default function CEOPortal() {
  const { isAdmin, isLoading } = useUserRole();

  if (isLoading) return null;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
          <p className="text-muted-foreground">Only administrators can access the CEO Portal.</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-5 max-w-[1440px] mx-auto">
        <DailyBriefingCard />
        <AgentSuggestionsPanel agentCode="vizzy" agentName="Vizzy" />
        <FixRequestQueue />
        <DailyAssignments />
        <CEODashboardView />

        {/* System Status – temporary decommission monitoring */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">System Status</h2>
          <OdooMigrationStatusCard />
        </div>
      </div>
    </ScrollArea>
  );
}

