import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Mail, Loader2, Sparkles } from "lucide-react";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PipelineAnalytics } from "@/components/pipeline/PipelineAnalytics";
import { LeadFormModal } from "@/components/pipeline/LeadFormModal";
import { LeadDetailDrawer } from "@/components/pipeline/LeadDetailDrawer";
import { PipelineFilters, DEFAULT_FILTERS, type PipelineFilterState, type GroupByOption } from "@/components/pipeline/PipelineFilters";
import { PipelineAISheet } from "@/components/pipeline/PipelineAISheet";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, subDays } from "date-fns";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

// Pipeline stages (originally derived from Odoo, now native to ERP)
export const PIPELINE_STAGES = [
  { id: "new", label: "New", color: "bg-blue-500" },
  { id: "telephonic_enquiries", label: "Telephonic Enquiries", color: "bg-cyan-500" },
  { id: "qualified", label: "Qualified", color: "bg-teal-500" },
  { id: "rfi", label: "RFI", color: "bg-green-500" },
  { id: "proposal", label: "Proposal", color: "bg-green-600" },
  { id: "qc_ben", label: "QC - Ben", color: "bg-lime-500" },
  { id: "addendums", label: "Addendums", color: "bg-yellow-500" },
  { id: "estimation_ben", label: "Estimation - Ben", color: "bg-amber-500" },
  { id: "estimation_karthick", label: "Estimation - Karthick", color: "bg-orange-500" },
  { id: "hot_enquiries", label: "Hot Enquiries", color: "bg-red-500" },
  { id: "quotation_priority", label: "Quotation Priority", color: "bg-rose-500" },
  { id: "quotation_bids", label: "Quotation Bids", color: "bg-pink-500" },
  { id: "won", label: "Won", color: "bg-emerald-500" },
  { id: "lost", label: "Lost", color: "bg-zinc-500" },
  { id: "shop_drawing", label: "Shop Drawing", color: "bg-violet-500" },
  { id: "shop_drawing_approval", label: "Shop Drawing Sent for Approval", color: "bg-purple-500" },
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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadWithCustomer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isScanningRfq, setIsScanningRfq] = useState(false);
  
  const [pipelineFilters, setPipelineFilters] = useState<PipelineFilterState>({ ...DEFAULT_FILTERS });
  const [groupBy, setGroupBy] = useState<GroupByOption>("none");
  const [isAISheetOpen, setIsAISheetOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads", searchQuery],
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

        if (searchQuery) {
          query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        allLeads = allLeads.concat(data as LeadWithCustomer[]);
        if (data.length < PAGE) break;
        from += PAGE;
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

  // Apply client-side filters
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

      return true;
    });
  }, [leads, pipelineFilters]);

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


  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 sm:px-6 py-2.5 border-b border-border shrink-0 space-y-2">
        {/* Row 1: Title, stats, search, actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 mr-auto">
            <div>
              <h1 className="text-lg font-semibold leading-tight">Pipeline</h1>
              <p className="text-xs text-muted-foreground">
                {filteredLeads.length}{filteredLeads.length !== leads.length ? ` / ${leads.length}` : ""} leads
              </p>
            </div>
            <div className="hidden md:flex">
              <PipelineAnalytics leads={filteredLeads} />
            </div>
          </div>

          <div className="relative w-40 lg:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          <Button onClick={handleScanRfq} size="sm" variant="ghost" disabled={isScanningRfq} className="gap-1.5 h-8 px-2.5">
            {isScanningRfq ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            <span className="hidden lg:inline text-xs">Scan RFQ</span>
          </Button>
          <Button onClick={() => setIsAISheetOpen(true)} size="sm" variant="ghost" className="gap-1.5 h-8 px-2.5 text-primary hover:bg-primary/10">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden lg:inline text-xs">Blitz</span>
          </Button>
          <Button onClick={() => setIsFormOpen(true)} size="sm" className="gap-1.5 h-8">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">Add Lead</span>
          </Button>
        </div>

        {/* Row 2: Filters */}
        <PipelineFilters
          filters={pipelineFilters}
          onFiltersChange={setPipelineFilters}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          salespersons={salespersons}
          sources={sources}
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
