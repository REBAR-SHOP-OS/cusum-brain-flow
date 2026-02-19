import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SyncHealthDashboard } from "@/components/pipeline/intelligence/SyncHealthDashboard";
import { PipelineAlerts } from "@/components/pipeline/intelligence/PipelineAlerts";
import { PipelineAnalyticsDashboard } from "@/components/pipeline/intelligence/PipelineAnalyticsDashboard";
import { PipelineForecast } from "@/components/pipeline/intelligence/PipelineForecast";
import { SLAEnforcementDashboard } from "@/components/pipeline/intelligence/SLAEnforcementDashboard";
import { ClientPerformanceDashboard } from "@/components/pipeline/intelligence/ClientPerformanceDashboard";
import { PipelineAutomationRules } from "@/components/pipeline/intelligence/PipelineAutomationRules";
import { PipelineReporting } from "@/components/pipeline/intelligence/PipelineReporting";
import { LossPatternAnalysis } from "@/components/pipeline/intelligence/LossPatternAnalysis";
import { Activity, Bell, BarChart3, TrendingUp, Shield, Users, Zap, FileSpreadsheet, XCircle } from "lucide-react";
import { usePipelineRealtime } from "@/hooks/usePipelineRealtime";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

export default function PipelineIntelligence() {
  const [activeTab, setActiveTab] = useState("analytics");
  usePipelineRealtime();

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

  const tabClass = "data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 pb-2 text-[13px] gap-1.5";

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 sm:px-6 py-3 border-b border-border shrink-0 bg-background">
        <h1 className="text-lg font-bold text-foreground">Pipeline Intelligence</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Analytics, forecasting, SLA enforcement, client performance, automation &amp; exports
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-4 sm:px-6 bg-background overflow-x-auto">
          <TabsList className="bg-transparent h-9 p-0 gap-3">
            <TabsTrigger value="analytics" className={tabClass}>
              <BarChart3 className="w-3.5 h-3.5" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="forecast" className={tabClass}>
              <TrendingUp className="w-3.5 h-3.5" /> Forecast
            </TabsTrigger>
            <TabsTrigger value="sla" className={tabClass}>
              <Shield className="w-3.5 h-3.5" /> SLA
            </TabsTrigger>
            <TabsTrigger value="clients" className={tabClass}>
              <Users className="w-3.5 h-3.5" /> Clients
            </TabsTrigger>
            <TabsTrigger value="alerts" className={tabClass}>
              <Bell className="w-3.5 h-3.5" /> Alerts
            </TabsTrigger>
            <TabsTrigger value="losses" className={tabClass}>
              <XCircle className="w-3.5 h-3.5" /> Losses
            </TabsTrigger>
            <TabsTrigger value="automation" className={tabClass}>
              <Zap className="w-3.5 h-3.5" /> Automation
            </TabsTrigger>
            <TabsTrigger value="reports" className={tabClass}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Reports
            </TabsTrigger>
            <TabsTrigger value="sync" className={tabClass}>
              <Activity className="w-3.5 h-3.5" /> Sync
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
          <TabsContent value="sla" className="mt-0 p-4 sm:p-6">
            <SLAEnforcementDashboard leads={leads} />
          </TabsContent>
          <TabsContent value="clients" className="mt-0 p-4 sm:p-6">
            <ClientPerformanceDashboard />
          </TabsContent>
          <TabsContent value="alerts" className="mt-0 p-4 sm:p-6">
            <PipelineAlerts leads={leads} />
          </TabsContent>
          <TabsContent value="losses" className="mt-0 p-4 sm:p-6">
            <LossPatternAnalysis leads={leads} />
          </TabsContent>
          <TabsContent value="automation" className="mt-0 p-4 sm:p-6">
            <PipelineAutomationRules />
          </TabsContent>
          <TabsContent value="reports" className="mt-0 p-4 sm:p-6">
            <PipelineReporting leads={leads} outcomes={outcomes} />
          </TabsContent>
          <TabsContent value="sync" className="mt-0 p-4 sm:p-6">
            <SyncHealthDashboard syncLogs={syncLogs} leads={leads} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
