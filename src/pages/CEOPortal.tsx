import { ScrollArea } from "@/components/ui/scroll-area";
import { CEODashboardView } from "@/components/office/CEODashboardView";
import { DailyBriefingCard } from "@/components/ceo/DailyBriefingCard";
import { DailyAssignments } from "@/components/ceo/DailyAssignments";
import { FixRequestQueue } from "@/components/ceo/FixRequestQueue";
import { AgentSuggestionsPanel } from "@/components/agent/AgentSuggestionsPanel";
import { OdooMigrationStatusCard } from "@/components/admin/OdooMigrationStatusCard";

export default function CEOPortal() {
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

