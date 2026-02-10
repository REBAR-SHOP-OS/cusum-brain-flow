import { ScrollArea } from "@/components/ui/scroll-area";
import { CEODashboardView } from "@/components/office/CEODashboardView";
import { DailyBriefingCard } from "@/components/ceo/DailyBriefingCard";
import { DailyAssignments } from "@/components/ceo/DailyAssignments";

export default function CEOPortal() {
  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-5 max-w-[1440px] mx-auto">
        {/* Daily Briefing + Assignments sit above the existing dashboard */}
        <DailyBriefingCard />
        <DailyAssignments />

        {/* Existing CEO Dashboard content (Health Score, KPIs, charts, etc.) */}
        <CEODashboardView />
      </div>
    </ScrollArea>
  );
}

