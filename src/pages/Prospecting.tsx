import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { SmartSearchInput } from "@/components/ui/SmartSearchInput";
import { Loader2, Pickaxe, Search } from "lucide-react";
import { ProspectTable } from "@/components/prospecting/ProspectTable";
import { ProspectIntroDialog } from "@/components/prospecting/ProspectIntroDialog";
import {
  ProspectingFilters,
  DEFAULT_PROSPECT_FILTERS,
  type ProspectingFilterState,
  type ProspectGroupByOption,
} from "@/components/prospecting/ProspectingFilters";

export default function Prospecting() {
  const region = "Ontario, Canada";
  const [introProspect, setIntroProspect] = useState<any | null>(null);
  const [emailMode, setEmailMode] = useState<"intro" | "followup">("intro");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<ProspectingFilterState>({ ...DEFAULT_PROSPECT_FILTERS });
  const [groupBy, setGroupBy] = useState<ProspectGroupByOption>("none");
  const { companyId } = useCompanyId();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch latest batch
  const { data: batches = [] } = useQuery({
    queryKey: ["prospect_batches", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const latestBatch = batches[0];

  // Fetch prospects for latest batch
  const { data: prospects = [], isLoading: loadingProspects } = useQuery({
    queryKey: ["prospects", latestBatch?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospects")
        .select("*")
        .eq("batch_id", latestBatch!.id)
        .neq("status", "emailed")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!latestBatch?.id,
  });

  // Unique industries & cities for filter dropdowns
  const industries = useMemo(() => {
    const set = new Set(prospects.map((p: any) => p.industry).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [prospects]);

  const cities = useMemo(() => {
    const set = new Set(prospects.map((p: any) => p.city).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [prospects]);

  // Filtered prospects
  const filteredProspects = useMemo(() => {
    let result = prospects as any[];

    // Search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((p: any) =>
        [p.company_name, p.contact_name, p.email, p.city, p.industry, p.fit_reason]
          .some((v) => v && String(v).toLowerCase().includes(q))
      );
    }

    // Status filters (OR logic: if any active, show only matching)
    const statusActive = filters.statusPending || filters.statusApproved || filters.statusRejected;
    if (statusActive) {
      result = result.filter((p: any) => {
        if (filters.statusPending && p.status === "pending") return true;
        if (filters.statusApproved && p.status === "approved") return true;
        if (filters.statusRejected && p.status === "rejected") return true;
        return false;
      });
    }

    if (filters.industry) {
      result = result.filter((p: any) => p.industry === filters.industry);
    }
    if (filters.city) {
      result = result.filter((p: any) => p.city === filters.city);
    }

    return result;
  }, [prospects, debouncedSearch, filters]);

  // Grouped prospects
  const groupedProspects = useMemo(() => {
    if (groupBy === "none") return { "": filteredProspects };
    return filteredProspects.reduce((acc: Record<string, any[]>, p: any) => {
      const key = p[groupBy] || "Unassigned";
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {} as Record<string, any[]>);
  }, [filteredProspects, groupBy]);

  // Dig leads mutation
  const digMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("prospect-leads", {
        body: { region },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      toast({ title: `${data.count} prospects generated!`, description: "Review and approve leads below." });
      qc.invalidateQueries({ queryKey: ["prospect_batches"] });
      qc.invalidateQueries({ queryKey: ["prospects"] });
    },
    onError: (err) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  // Approve prospect → create lead
  const approveMutation = useMutation({
    mutationFn: async (prospect: any) => {
      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .insert({
          title: `${prospect.company_name} — ${prospect.contact_name}`,
          description: prospect.fit_reason,
          source: "ai_prospecting",
          stage: "prospecting",
          company_id: prospect.company_id,
          expected_value: prospect.estimated_value,
          metadata: {
            prospect_id: prospect.id,
            intro_angle: prospect.intro_angle,
            contact_title: prospect.contact_title,
            email: prospect.email,
            phone: prospect.phone,
            city: prospect.city,
            industry: prospect.industry,
          },
        })
        .select("id")
        .single();
      if (leadErr) throw leadErr;

      const { error } = await supabase
        .from("prospects")
        .update({ status: "approved", lead_id: lead.id })
        .eq("id", prospect.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prospects"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err) => {
      toast({ title: "Approve failed", description: err.message, variant: "destructive" });
    },
  });

  // Reject prospect
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("prospects").update({ status: "rejected" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prospects"] }),
  });

  // Email + auto-approve + follow-up activity
  const emailAndFollowUpMutation = useMutation({
    mutationFn: async (prospect: any) => {
      // 1. Mark prospect as emailed
      const { error: emailErr } = await supabase
        .from("prospects")
        .update({ status: "emailed" })
        .eq("id", prospect.id);
      if (emailErr) throw emailErr;

      let leadId = prospect.lead_id;

      // 2. If no lead yet, auto-approve (create lead in prospecting stage)
      if (!leadId) {
        const { data: lead, error: leadErr } = await supabase
          .from("leads")
          .insert({
            title: `${prospect.company_name} — ${prospect.contact_name}`,
            description: prospect.fit_reason,
            source: "ai_prospecting",
            stage: "prospecting",
            company_id: prospect.company_id,
            expected_value: prospect.estimated_value,
            metadata: {
              prospect_id: prospect.id,
              intro_angle: prospect.intro_angle,
              contact_title: prospect.contact_title,
              email: prospect.email,
              phone: prospect.phone,
              city: prospect.city,
              industry: prospect.industry,
            },
          })
          .select("id")
          .single();
        if (leadErr) throw leadErr;
        leadId = lead.id;

        // Update prospect with lead_id and approved status
        await supabase
          .from("prospects")
          .update({ status: "emailed", lead_id: leadId })
          .eq("id", prospect.id);
      }

      // 3. Create follow-up activity (5 days out)
      const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

      const { error: actErr } = await supabase.from("lead_activities").insert({
        lead_id: leadId,
        company_id: prospect.company_id,
        activity_type: "follow_up",
        title: `Follow up with ${prospect.contact_name} at ${prospect.company_name}`,
        description: `Introduction email sent on ${today}. Follow up in 3-5 business days.`,
        due_date: dueDate.toISOString(),
      });
      if (actErr) throw actErr;
    },
    onSuccess: () => {
      toast({ title: "Email sent & follow-up scheduled", description: "A follow-up activity has been created on the lead." });
      qc.invalidateQueries({ queryKey: ["prospects"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err) => {
      toast({ title: "Follow-up failed", description: err.message, variant: "destructive" });
    },
  });

  const groupEntries = Object.entries(groupedProspects) as [string, any[]][];

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 sm:px-6 py-3 border-b border-border shrink-0 space-y-2">
        {/* Row 1: Title + controls */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="mr-auto">
            <h1 className="text-lg font-semibold">AI Lead Prospecting</h1>
            <p className="text-xs text-muted-foreground">
              {prospects.length > 0
                ? `${filteredProspects.length} of ${prospects.length} prospects · ${prospects.filter((p: any) => p.status === "approved").length} approved`
                : "Click Dig to generate 50 AI leads"}
            </p>
          </div>

          <SmartSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search: today, approved, pending..."
            hints={[
              { category: "Date", suggestions: ["today", "this week"] },
              { category: "Status", suggestions: ["pending", "approved", "rejected"] },
            ]}
            className="w-44 lg:w-56"
          />

          <Button
            onClick={() => digMutation.mutate()}
            disabled={digMutation.isPending}
            size="sm"
            className="gap-1.5 h-8"
          >
            {digMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Pickaxe className="w-3.5 h-3.5" />
            )}
            Dig 50 Leads
          </Button>
        </div>

        {/* Row 2: Filters */}
        <ProspectingFilters
          filters={filters}
          onFiltersChange={setFilters}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          industries={industries}
          cities={cities}
        />
      </header>

      <div className="flex-1 overflow-auto p-4">
        {digMutation.isPending ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI is researching prospects…</p>
          </div>
        ) : loadingProspects ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProspects.length === 0 && prospects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
            <Pickaxe className="w-10 h-10" />
            <p className="text-sm">No prospects yet. Click "Dig 50 Leads" to start.</p>
          </div>
        ) : filteredProspects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
            <Search className="w-10 h-10" />
            <p className="text-sm">No prospects match your search or filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupEntries.map(([label, groupProspects]) => (
              <ProspectTable
                key={label}
                prospects={groupProspects}
                groupLabel={groupBy !== "none" ? label : undefined}
                onApprove={(p) => approveMutation.mutate(p)}
                onReject={(id) => rejectMutation.mutate(id)}
                onSendIntro={(p) => { setEmailMode("intro"); setIntroProspect(p); }}
                onSendFollowup={(p) => { setEmailMode("followup"); setIntroProspect(p); }}
              />
            ))}
          </div>
        )}
      </div>

      {introProspect && (
        <ProspectIntroDialog
          prospect={introProspect}
          mode={emailMode}
          open={!!introProspect}
      onOpenChange={(open) => !open && setIntroProspect(null)}
          onSent={() => {
            emailAndFollowUpMutation.mutate(introProspect);
            setIntroProspect(null);
          }}
        />
      )}
    </div>
  );
}
