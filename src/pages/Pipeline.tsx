import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Mail, Loader2, Sparkles, RefreshCw, Pickaxe, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { LeadFormModal } from "@/components/pipeline/LeadFormModal";
import { LeadDetailDrawer } from "@/components/pipeline/LeadDetailDrawer";
import { PipelineFilters, DEFAULT_FILTERS, type PipelineFilterState, type GroupByOption } from "@/components/pipeline/PipelineFilters";
import { PipelineAISheet } from "@/components/pipeline/PipelineAISheet";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, subDays } from "date-fns";
import { parseSmartSearch, type SmartSearchResult } from "@/lib/smartSearchParser";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

// Pipeline stages (originally derived from Odoo, now native to ERP)
// Odoo-exact order first, then ERP-only stages at the end
export const PIPELINE_STAGES = [
  { id: "prospecting", label: "Prospecting", color: "bg-indigo-500" },
  { id: "new", label: "New", color: "bg-blue-500" },
  { id: "telephonic_enquiries", label: "Telephonic Enquiries", color: "bg-cyan-500" },
  { id: "qc_ben", label: "QC - Ben", color: "bg-lime-500" },
  { id: "estimation_ben", label: "Estimation - Ben", color: "bg-amber-500" },
  { id: "estimation_karthick", label: "Estimation - Karthick", color: "bg-orange-500" },
  { id: "hot_enquiries", label: "Hot Enquiries", color: "bg-red-500" },
  { id: "quotation_bids", label: "Quotation Bids", color: "bg-pink-500" },
  { id: "won", label: "Won", color: "bg-emerald-500" },
  { id: "lost", label: "Lost", color: "bg-zinc-500" },
  { id: "shop_drawing", label: "Shop Drawing", color: "bg-violet-500" },
  { id: "shop_drawing_approval", label: "Shop Drawing Sent for Approval", color: "bg-purple-500" },
  // ERP-only stages (not in Odoo) — kept to avoid orphaning existing leads
  { id: "qualified", label: "Qualified", color: "bg-teal-500" },
  { id: "rfi", label: "RFI", color: "bg-green-500" },
  { id: "addendums", label: "Addendums", color: "bg-yellow-500" },
  { id: "quotation_priority", label: "Quotation Priority", color: "bg-rose-500" },
];

function getDateCutoff(rangeId: string): Date | null {
  const now = new Date();
  switch (rangeId) {
    case "today": return startOfDay(now);
    case "this_week": return startOfWeek(now);
    case "this_month": return startOfMonth(now);
    case "this_quarter": return startOfQuarter(now);
    case "this_year": return startOfYear(now);
    case "last_7": return subDays(now, 7);
    case "last_30": return subDays(now, 30);
    case "last_365": return subDays(now, 365);
    default: return null;
  }
}

export default function Pipeline() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [smartResult, setSmartResult] = useState<SmartSearchResult | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadWithCustomer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isScanningRfq, setIsScanningRfq] = useState(false);
  const [isSyncingOdoo, setIsSyncingOdoo] = useState(false);
  
  const [pipelineFilters, setPipelineFilters] = useState<PipelineFilterState>({ ...DEFAULT_FILTERS });
  const [groupBy, setGroupBy] = useState<GroupByOption>("none");
  const [isAISheetOpen, setIsAISheetOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Smart search: parse query, apply filter tokens, debounce remaining text
  useEffect(() => {
    const parsed = parseSmartSearch(searchQuery);
    setSmartResult(parsed);

    // Merge smart-parsed filters into pipeline filters
    if (Object.keys(parsed.filters).length > 0) {
      setPipelineFilters((prev) => ({ ...prev, ...parsed.filters }));
    }

    // Only debounce the leftover text query (not the filter tokens)
    const timer = setTimeout(() => setDebouncedSearch(parsed.textQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", debouncedSearch],
    queryFn: async () => {
      const PAGE = 1000;
      let allLeads: LeadWithCustomer[] = [];
      let from = 0;

      while (true) {
        let query = supabase
          .from("leads")
          .select("*, customers(name, company_name)")
          .order("updated_at", { ascending: false })
          .range(from, from + PAGE - 1);

        if (debouncedSearch) {
          query = query.or(`title.ilike.%${debouncedSearch}%,description.ilike.%${debouncedSearch}%,source.ilike.%${debouncedSearch}%,notes.ilike.%${debouncedSearch}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allLeads = allLeads.concat(data as LeadWithCustomer[]);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      // Client-side filter for customer name/company (joined table can't be filtered server-side)
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        allLeads = allLeads.filter((lead) => {
          // Already matched by server-side filter on title/description/source/notes
          // But also include if customer name or company matches
          const titleMatch = lead.title?.toLowerCase().includes(q);
          const descMatch = lead.description?.toLowerCase().includes(q);
          const sourceMatch = lead.source?.toLowerCase().includes(q);
          const notesMatch = lead.notes?.toLowerCase().includes(q);
          const custNameMatch = lead.customers?.name?.toLowerCase().includes(q);
          const custCompanyMatch = lead.customers?.company_name?.toLowerCase().includes(q);
          return titleMatch || descMatch || sourceMatch || notesMatch || custNameMatch || custCompanyMatch;
        });
      }

      return allLeads;
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase.from("leads").update({ stage }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (error) => {
      toast({ title: "Error moving lead", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Lead deleted" });
    },
    onError: (error) => {
      toast({ title: "Error deleting lead", description: error.message, variant: "destructive" });
    },
  });

  // Extract unique salespersons and sources for filter dropdowns
  const salespersons = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      const meta = l.metadata as Record<string, unknown> | null;
      const sp = meta?.salesperson as string || meta?.odoo_salesperson as string;
      if (sp) set.add(sp);
    });
    return Array.from(set).sort();
  }, [leads]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => { if (l.source) set.add(l.source); });
    return Array.from(set).sort();
  }, [leads]);

  // Apply client-side filters (including smart search extras)
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const meta = lead.metadata as Record<string, unknown> | null;
      const sp = (meta?.salesperson as string) || (meta?.odoo_salesperson as string) || "";

      if (pipelineFilters.unassigned && sp) return false;
      if (pipelineFilters.myPipeline && !sp) return false; // would need current user mapping
      if (pipelineFilters.won && lead.stage !== "won") return false;
      if (pipelineFilters.lost && lead.stage !== "lost") return false;
      if (pipelineFilters.openOpportunities && (lead.stage === "won" || lead.stage === "lost")) return false;
      if (pipelineFilters.salesperson && sp !== pipelineFilters.salesperson) return false;

      if (pipelineFilters.stage) {
        const stageMatch = PIPELINE_STAGES.find((s) => s.label === pipelineFilters.stage);
        if (stageMatch && lead.stage !== stageMatch.id) return false;
      }

      if (pipelineFilters.source && lead.source !== pipelineFilters.source) return false;

      // Date range filters
      if (pipelineFilters.creationDateRange) {
        const cutoff = getDateCutoff(pipelineFilters.creationDateRange);
        if (cutoff && new Date(lead.created_at) < cutoff) return false;
      }
      if (pipelineFilters.closedDateRange && lead.expected_close_date) {
        const cutoff = getDateCutoff(pipelineFilters.closedDateRange);
        if (cutoff && new Date(lead.expected_close_date) < cutoff) return false;
      }

      // Smart search: stage filter
      if (smartResult?.stageFilter && lead.stage !== smartResult.stageFilter) return false;

      // Smart search: stale filter (not updated in N days)
      if (smartResult?.staleThresholdDays) {
        const threshold = subDays(new Date(), smartResult.staleThresholdDays);
        if (new Date(lead.updated_at) > threshold) return false;
      }

      // Smart search: revenue filter
      if (smartResult?.revenueFilter) {
        const rev = (lead.expected_value as number) || 0;
        if (smartResult.revenueFilter.op === "gt" && rev <= smartResult.revenueFilter.value) return false;
        if (smartResult.revenueFilter.op === "lt" && rev >= smartResult.revenueFilter.value) return false;
      }

      return true;
    });
  }, [leads, pipelineFilters, smartResult]);

  const leadsByStage = useMemo(() => {
    const grouped: Record<string, LeadWithCustomer[]> = {};
    PIPELINE_STAGES.forEach((stage) => {
      grouped[stage.id] = filteredLeads
        .filter((lead) => lead.stage === stage.id)
        .sort((a, b) => {
          const getStars = (l: LeadWithCustomer) => {
            const meta = l.metadata as Record<string, unknown> | null;
            const op = meta?.priority as string || meta?.odoo_priority as string | undefined;
            if (op) return Math.min(parseInt(op) || 0, 3);
            if (l.priority === "high") return 3;
            if (l.priority === "medium") return 2;
            return 0;
          };
          const diff = getStars(b) - getStars(a);
          if (diff !== 0) return diff;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
    });
    return grouped;
  }, [filteredLeads]);

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this lead?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingLead(null);
  };

  const handleStageChange = (leadId: string, newStage: string) => {
    updateStageMutation.mutate({ id: leadId, stage: newStage });
    // Update selected lead in drawer if open
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => prev ? { ...prev, stage: newStage } : null);
    }
  };

  const handleLeadClick = (lead: LeadWithCustomer) => {
    setSelectedLead(lead);
    setIsDetailOpen(true);
  };

  const handleScanRfq = async () => {
    setIsScanningRfq(true);
    try {
      const { data, error } = await supabase.functions.invoke("process-rfq-emails");
      if (error) throw error;

      if (data.created > 0) {
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        toast({
          title: `${data.created} new lead${data.created > 1 ? "s" : ""} created`,
          description: `Scanned ${data.total} emails — ${data.prefiltered || 0} system, ${data.filtered} AI-filtered, ${data.skipped} already processed`,
        });
      } else {
        toast({
          title: "No new leads found",
          description: `Scanned ${data.total} emails — ${data.prefiltered || 0} system, ${data.filtered} filtered, ${data.skipped} already processed`,
        });
      }
    } catch (err) {
      console.error("RFQ scan error:", err);
      toast({
        title: "Scan failed",
        description: err instanceof Error ? err.message : "Failed to scan RFQ emails",
        variant: "destructive",
      });
    } finally {
      setIsScanningRfq(false);
    }
  };
  const handleOdooSync = async () => {
    setIsSyncingOdoo(true);
    try {
      const { data, error } = await supabase.functions.invoke("odoo-crm-sync", { body: { mode: "full" } });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: `Odoo Sync Complete`,
        description: `${data.created} created, ${data.updated} updated, ${data.reconciled || 0} reconciled, ${data.errors} errors (${data.total} total, ${data.mode} mode)`,
      });
    } catch (err) {
      console.error("Odoo sync error:", err);
      toast({
        title: "Odoo sync failed",
        description: err instanceof Error ? err.message : "Failed to sync",
        variant: "destructive",
      });
    } finally {
      setIsSyncingOdoo(false);
    }
  };


  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 sm:px-6 py-2.5 border-b border-border shrink-0 space-y-2">
      {/* Row 1: Title, stats, actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 mr-auto">
            <div>
              <h1 className="text-lg font-semibold leading-tight">Pipeline</h1>
              <p className="text-xs text-muted-foreground">
                {filteredLeads.length}{filteredLeads.length !== leads.length ? ` / ${leads.length}` : ""} leads
              </p>
            </div>
          </div>

          {/* Overflow actions menu — keeps header clean like Odoo */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={handleScanRfq} disabled={isScanningRfq}>
                {isScanningRfq ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Mail className="w-3.5 h-3.5 mr-2" />}
                Scan RFQ
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOdooSync} disabled={isSyncingOdoo}>
                {isSyncingOdoo ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                Odoo Sync
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/prospecting")}>
                <Pickaxe className="w-3.5 h-3.5 mr-2" />
                Prospect
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsAISheetOpen(true)}>
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                Blitz (AI)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => setIsFormOpen(true)} size="sm" className="gap-1.5 h-8">
            <Plus className="w-3.5 h-3.5" />
            New
          </Button>
        </div>

        {/* Row 2: Odoo-style search bar with integrated filter dropdown */}
        <PipelineFilters
          filters={pipelineFilters}
          onFiltersChange={setPipelineFilters}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          salespersons={salespersons}
          sources={sources}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </header>

      {/* Pipeline Board */}
      <div className="flex-1 overflow-hidden">
        <PipelineBoard
          stages={PIPELINE_STAGES}
          leadsByStage={leadsByStage}
          isLoading={isLoading}
          onStageChange={handleStageChange}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onLeadClick={handleLeadClick}
        />
      </div>

      {/* Form Modal */}
      <LeadFormModal
        open={isFormOpen}
        onOpenChange={handleFormClose}
        lead={editingLead}
      />

      {/* Detail Drawer */}
      <LeadDetailDrawer
        lead={selectedLead}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onStageChange={handleStageChange}
      />

      {/* Blitz AI Sheet */}
      <PipelineAISheet
        open={isAISheetOpen}
        onOpenChange={setIsAISheetOpen}
        leads={filteredLeads}
      />
    </div>
  );
}
