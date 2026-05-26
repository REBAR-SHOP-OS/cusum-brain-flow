import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Bell, BarChart3, TrendingUp, Shield, Users, Zap, FileSpreadsheet, XCircle, Sparkles, Webhook, UserCheck, CalendarClock, Clock, AlertCircle } from "lucide-react";
import { usePipelineRealtime } from "@/hooks/usePipelineRealtime";
import { PipelineErrorBoundary } from "@/components/pipeline/intelligence/PipelineErrorBoundary";
import type { Tables } from "@/integrations/supabase/types";

import { SyncHealthDashboard } from "@/components/pipeline/intelligence/SyncHealthDashboard";
import { PipelineAlerts } from "@/components/pipeline/intelligence/PipelineAlerts";
import { PipelineAnalyticsDashboard } from "@/components/pipeline/intelligence/PipelineAnalyticsDashboard";
import { PipelineForecast } from "@/components/pipeline/intelligence/PipelineForecast";
import { SLAEnforcementDashboard } from "@/components/pipeline/intelligence/SLAEnforcementDashboard";
import { ClientPerformanceDashboard } from "@/components/pipeline/intelligence/ClientPerformanceDashboard";
import { PipelineAutomationRules } from "@/components/pipeline/intelligence/PipelineAutomationRules";
import { PipelineReporting } from "@/components/pipeline/intelligence/PipelineReporting";
import { LossPatternAnalysis } from "@/components/pipeline/intelligence/LossPatternAnalysis";
import { AICoachingDashboard } from "@/components/pipeline/intelligence/AICoachingDashboard";
import { PipelineWebhooks } from "@/components/pipeline/intelligence/PipelineWebhooks";
import { RepPerformanceDashboard } from "@/components/pipeline/intelligence/RepPerformanceDashboard";
import { ScheduledReportsManager } from "@/components/pipeline/intelligence/ScheduledReportsManager";
import { StalePipelineDashboard as StalePipelineDashboardComp } from "@/components/pipeline/intelligence/StalePipelineDashboard";
import { UnattendedLeadsDashboard } from "@/components/pipeline/intelligence/UnattendedLeadsDashboard";

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
    staleTime: 60_000, // Cache for 1 min
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
    staleTime: 120_000,
    enabled: activeTab === "sync", // Only fetch when sync tab is active
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

  const wrapTab = (children: React.ReactNode, label?: string) => (
    <PipelineErrorBoundary fallbackLabel={label}>
      <Suspense fallback={<TabLoadingSkeleton />}>
        {children}
      </Suspense>
    </PipelineErrorBoundary>
  );

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
            <TabsTrigger value="coaching" className={tabClass}>
              <Sparkles className="w-3.5 h-3.5" /> AI Coach
            </TabsTrigger>
            <TabsTrigger value="webhooks" className={tabClass}>
              <Webhook className="w-3.5 h-3.5" /> Webhooks
            </TabsTrigger>
            <TabsTrigger value="sync" className={tabClass}>
              <Activity className="w-3.5 h-3.5" /> Sync
            </TabsTrigger>
            <TabsTrigger value="reps" className={tabClass}>
              <UserCheck className="w-3.5 h-3.5" /> Reps
            </TabsTrigger>
            <TabsTrigger value="scheduled" className={tabClass}>
              <CalendarClock className="w-3.5 h-3.5" /> Scheduled
            </TabsTrigger>
            <TabsTrigger value="stale" className={tabClass}>
              <Clock className="w-3.5 h-3.5" /> Stale
            </TabsTrigger>
            <TabsTrigger value="unattended" className={tabClass}>
              <AlertCircle className="w-3.5 h-3.5" /> Unattended
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="analytics" className="mt-0 p-4 sm:p-6">
            {wrapTab(<PipelineAnalyticsDashboard leads={leads} outcomes={outcomes} isLoading={isLoading} />, "Failed to load Analytics")}
          </TabsContent>
          <TabsContent value="forecast" className="mt-0 p-4 sm:p-6">
            {wrapTab(<PipelineForecast leads={leads} outcomes={outcomes} isLoading={isLoading} />, "Failed to load Forecast")}
          </TabsContent>
          <TabsContent value="sla" className="mt-0 p-4 sm:p-6">
            {wrapTab(<SLAEnforcementDashboard leads={leads} />, "Failed to load SLA")}
          </TabsContent>
          <TabsContent value="clients" className="mt-0 p-4 sm:p-6">
            {wrapTab(<ClientPerformanceDashboard />, "Failed to load Clients")}
          </TabsContent>
          <TabsContent value="alerts" className="mt-0 p-4 sm:p-6">
            {wrapTab(<PipelineAlerts leads={leads} />, "Failed to load Alerts")}
          </TabsContent>
          <TabsContent value="losses" className="mt-0 p-4 sm:p-6">
            {wrapTab(<LossPatternAnalysis leads={leads} />, "Failed to load Loss Analysis")}
          </TabsContent>
          <TabsContent value="automation" className="mt-0 p-4 sm:p-6">
            {wrapTab(<PipelineAutomationRules />, "Failed to load Automation")}
          </TabsContent>
          <TabsContent value="reports" className="mt-0 p-4 sm:p-6">
            {wrapTab(<PipelineReporting leads={leads} outcomes={outcomes} />, "Failed to load Reports")}
          </TabsContent>
          <TabsContent value="coaching" className="mt-0 p-4 sm:p-6">
            {wrapTab(<AICoachingDashboard leads={leads} isLoading={isLoading} />, "Failed to load AI Coach")}
          </TabsContent>
          <TabsContent value="webhooks" className="mt-0 p-4 sm:p-6">
            {wrapTab(<PipelineWebhooks />, "Failed to load Webhooks")}
          </TabsContent>
          <TabsContent value="sync" className="mt-0 p-4 sm:p-6">
            {wrapTab(<SyncHealthDashboard syncLogs={syncLogs} leads={leads} />, "Failed to load Sync")}
          </TabsContent>
          <TabsContent value="reps" className="mt-0 p-4 sm:p-6">
            {wrapTab(<RepPerformanceDashboard leads={leads} isLoading={isLoading} />, "Failed to load Reps")}
          </TabsContent>
          <TabsContent value="scheduled" className="mt-0 p-4 sm:p-6">
            {wrapTab(<ScheduledReportsManager />, "Failed to load Scheduled Reports")}
          </TabsContent>
          <TabsContent value="stale" className="mt-0 p-4 sm:p-6">
            {wrapTab(<StalePipelineDashboardComp leads={leads} isLoading={isLoading} />, "Failed to load Stale Dashboard")}
          </TabsContent>
          <TabsContent value="unattended" className="mt-0 p-4 sm:p-6">
            {wrapTab(<UnattendedLeadsDashboard leads={leads} isLoading={isLoading} />, "Failed to load Unattended Leads")}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
