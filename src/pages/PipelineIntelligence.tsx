import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SyncHealthDashboard } from "@/components/pipeline/intelligence/SyncHealthDashboard";
import { PipelineAlerts } from "@/components/pipeline/intelligence/PipelineAlerts";
import { PipelineAnalyticsDashboard } from "@/components/pipeline/intelligence/PipelineAnalyticsDashboard";
import { PipelineForecast } from "@/components/pipeline/intelligence/PipelineForecast";
import { Activity, Bell, BarChart3, TrendingUp } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

export default function PipelineIntelligence() {
  const [activeTab, setActiveTab] = useState("analytics");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["pipeline-intelligence-leads"],
    queryFn: async () => {
      const PAGE = 1000;
      let allLeads: LeadWithCustomer[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("leads")
          .select("*, customers(name, company_name)")
          .order("updated_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allLeads = allLeads.concat(data as LeadWithCustomer[]);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return allLeads;
    },
  });

  const { data: syncLogs = [] } = useQuery({
    queryKey: ["sync-validation-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sync_validation_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) {
        console.warn("sync_validation_log not available:", error.message);
        return [];
      }
      return data || [];
    },
  });

  // Derive outcomes from leads (won/lost stages) instead of separate table
  const outcomes = useMemo(() => {
    return leads
      .filter(l => l.stage === "won" || l.stage === "lost" || l.stage === "loss")
      .map(l => ({
        outcome: l.stage === "won" ? "won" : "lost",
        expected_value: l.expected_value,
        created_at: l.created_at,
        updated_at: l.updated_at,
      }));
  }, [leads]);

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 sm:px-6 py-3 border-b border-border shrink-0 bg-background">
        <h1 className="text-lg font-bold text-foreground">Pipeline Intelligence</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Sync health, proactive alerts, analytics &amp; AI forecasting
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-4 sm:px-6 bg-background">
          <TabsList className="bg-transparent h-9 p-0 gap-4">
            <TabsTrigger value="analytics" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-2 text-[13px] gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="forecast" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-2 text-[13px] gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Forecast
            </TabsTrigger>
            <TabsTrigger value="alerts" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-2 text-[13px] gap-1.5">
              <Bell className="w-3.5 h-3.5" /> Alerts
            </TabsTrigger>
            <TabsTrigger value="sync" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-2 text-[13px] gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Sync Health
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="analytics" className="mt-0 p-4 sm:p-6">
            <PipelineAnalyticsDashboard leads={leads} outcomes={outcomes} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="forecast" className="mt-0 p-4 sm:p-6">
            <PipelineForecast leads={leads} outcomes={outcomes} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="alerts" className="mt-0 p-4 sm:p-6">
            <PipelineAlerts leads={leads} />
          </TabsContent>
          <TabsContent value="sync" className="mt-0 p-4 sm:p-6">
            <SyncHealthDashboard syncLogs={syncLogs} leads={leads} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
