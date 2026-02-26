import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Mail, Loader2, Sparkles, RefreshCw, Pickaxe, MoreVertical, Bot, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePipelineBulkActions } from "@/hooks/usePipelineBulkActions";
import { PipelineBulkBar } from "@/components/pipeline/PipelineBulkBar";
import { usePipelineKeyboardShortcuts } from "@/hooks/usePipelineKeyboardShortcuts";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { LeadFormModal } from "@/components/pipeline/LeadFormModal";
import { LeadDetailDrawer } from "@/components/pipeline/LeadDetailDrawer";
import { PipelineFilters, DEFAULT_FILTERS, type PipelineFilterState, type GroupByOption } from "@/components/pipeline/PipelineFilters";
import { PipelineAISheet } from "@/components/pipeline/PipelineAISheet";
import { PipelineAIActions } from "@/components/pipeline/PipelineAIActions";
import { usePipelineAI } from "@/hooks/usePipelineAI";
import { useToast } from "@/hooks/use-toast";
import { useUserRole } from "@/hooks/useUserRole";
import { usePipelineStageOrder } from "@/hooks/usePipelineStageOrder";
import type { Tables } from "@/integrations/supabase/types";
import { startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, subDays, differenceInCalendarDays, formatDistanceToNow, differenceInMinutes } from "date-fns";
import { parseSmartSearch, type SmartSearchResult } from "@/lib/smartSearchParser";
import { getRequiredGates, type GateType } from "@/lib/pipelineTransitionGates";
import { usePipelineMemory } from "@/hooks/usePipelineMemory";
import { logPipelineTransition } from "@/lib/logPipelineTransition";
import { QualificationGateModal } from "@/components/pipeline/gates/QualificationGateModal";
import { PricingGateModal } from "@/components/pipeline/gates/PricingGateModal";
import { LossGateModal } from "@/components/pipeline/gates/LossGateModal";
import { DeliveryGateModal } from "@/components/pipeline/gates/DeliveryGateModal";
import { MobilePipelineView } from "@/components/pipeline/MobilePipelineView";
import { KeyboardShortcutHelp } from "@/components/pipeline/KeyboardShortcutHelp";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

// Pipeline stages — 1:1 parity with Odoo, in exact Odoo order
export const PIPELINE_STAGES = [
  { id: "prospecting", label: "Prospecting", color: "bg-indigo-500" },
  { id: "new", label: "New", color: "bg-blue-500" },
  { id: "telephonic_enquiries", label: "Telephonic Enquiries", color: "bg-cyan-500" },
  { id: "qc_ben", label: "QC - Ben", color: "bg-lime-500" },
  { id: "estimation_ben", label: "Estimation - Ben", color: "bg-amber-500" },
  { id: "estimation_karthick", label: "Estimation - Karthick", color: "bg-orange-500" },
  { id: "estimation_others", label: "Estimation - Others", color: "bg-amber-600" },
  { id: "estimation_partha", label: "Estimation Partha", color: "bg-amber-400" },
  { id: "hot_enquiries", label: "Hot Enquiries", color: "bg-red-500" },
  { id: "qualified", label: "Qualified", color: "bg-teal-500" },
  { id: "rfi", label: "RFI", color: "bg-green-500" },
  { id: "addendums", label: "Addendums", color: "bg-yellow-500" },
  { id: "quotation_priority", label: "Quotation Priority", color: "bg-rose-500" },
  { id: "quotation_bids", label: "Quotation Bids", color: "bg-pink-500" },
  { id: "won", label: "Won", color: "bg-emerald-500" },
  { id: "lost", label: "Lost", color: "bg-zinc-500" },
  { id: "loss", label: "Loss", color: "bg-zinc-400" },
  { id: "merged", label: "Merged", color: "bg-zinc-600" },
  { id: "shop_drawing", label: "Shop Drawing", color: "bg-violet-500" },
  { id: "shop_drawing_approval", label: "Shop Drawing Sent for Approval", color: "bg-purple-500" },
  { id: "fabrication_in_shop", label: "Fabrication In Shop", color: "bg-violet-600" },
  { id: "ready_to_dispatch", label: "Ready To Dispatch/Pickup", color: "bg-emerald-400" },
  { id: "delivered_pickup_done", label: "Delivered/Pickup Done", color: "bg-emerald-600" },
  { id: "out_for_delivery", label: "Out for Delivery", color: "bg-sky-500" },
  { id: "no_rebars_out_of_scope", label: "No rebars (Out of Scope)", color: "bg-stone-500" },
  { id: "temp_ir_vam", label: "Temp: IR/VAM", color: "bg-fuchsia-500" },
  { id: "migration_others", label: "Migration-Others", color: "bg-slate-500" },
  { id: "dreamers", label: "Dreamers", color: "bg-sky-400" },
  { id: "archived_orphan", label: "Archived / Orphan", color: "bg-zinc-700" },
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
  const [aiMode, setAiMode] = useState(() => localStorage.getItem("pipeline_ai_mode") === "true");
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // ── Gate state for transition-gated memory capture ──
  const [pendingTransition, setPendingTransition] = useState<{ leadId: string; targetStage: string; lead: LeadWithCustomer | null } | null>(null);
  const [activeGates, setActiveGates] = useState<GateType[]>([]);
  const [currentGateIndex, setCurrentGateIndex] = useState(0);

  // Look up memory for the lead pending a gated transition
  const { memory: pendingMemory } = usePipelineMemory(pendingTransition?.leadId ?? null);
  
  const [pipelineFilters, setPipelineFilters] = useState<PipelineFilterState>({ ...DEFAULT_FILTERS });
  const [groupBy, setGroupBy] = useState<GroupByOption>("none");
  const [isAISheetOpen, setIsAISheetOpen] = useState(false);
  const { toast } = useToast();
  const { isAdmin } = useUserRole();
  const { orderedStages, saveOrder, canReorder } = usePipelineStageOrder();

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Bulk actions
  const bulk = usePipelineBulkActions();

  // Keyboard shortcuts (filteredLeads ref used lazily via callback)
  const filteredLeadsRef = useRef<LeadWithCustomer[]>([]);
  usePipelineKeyboardShortcuts({
    onSearch: () => {
      const input = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
      input?.focus();
    },
    onNewLead: () => setIsFormOpen(true),
    onEscape: () => {
      bulk.clearSelection();
      setIsDetailOpen(false);
    },
    onSelectAll: () => {
      bulk.selectAll(filteredLeadsRef.current.map(l => l.id));
    },
    onHelp: () => setShortcutHelpOpen(true),
  });

  // AI Autopilot hook
  const {
    actions: aiActions,
    isLoading: aiLoading,
    isScanning,
    runScan,
    approveAction,
    dismissAction,
    executeAction,
    approveAll,
    dismissAll,
    pendingCount,
  } = usePipelineAI(aiMode);

  const toggleAiMode = (on: boolean) => {
    setAiMode(on);
    localStorage.setItem("pipeline_ai_mode", on.toString());
  };
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

      // Always fetch all leads (no server-side text filter) so we can match
      // on joined customer name/company which can't be filtered server-side.
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

      // Client-side search across lead fields + customer name/company
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        allLeads = allLeads.filter((lead) => {
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

  // Last Synced: fetch the most recent updated_at from odoo_sync leads, refresh every 5 min
  const { data: lastSyncedAt } = useQuery({
    queryKey: ["odoo-last-synced"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("updated_at")
        .eq("source", "odoo_sync")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      if (error || !data) return null;
      return new Date(data.updated_at);
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const syncStatusColor = useMemo(() => {
    if (!lastSyncedAt) return "text-muted-foreground";
    const minutesAgo = differenceInMinutes(new Date(), lastSyncedAt);
    if (minutesAgo < 30) return "text-emerald-500 dark:text-emerald-400";
    if (minutesAgo < 60) return "text-amber-500 dark:text-amber-400";
    return "text-destructive";
  }, [lastSyncedAt]);

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage, fromStage }: { id: string; stage: string; fromStage?: string }) => {
      const lead = leads.find((l) => l.id === id);
      const companyId = (lead as any)?.company_id;
      // R15-5: Optimistic lock — only update if stage hasn't changed
      const { data: updated, error } = await supabase
        .from("leads").update({ stage }).eq("id", id).eq("stage", fromStage ?? stage)
        .select("id").maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error("Lead was modified by another user. Please refresh.");
      // Fire-and-forget audit log
      if (companyId) {
        logPipelineTransition({
          leadId: id,
          companyId,
          fromStage: fromStage ?? lead?.stage ?? null,
          toStage: stage,
          result: "allowed",
        });
      }
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
      // R15-1: Check for linked quotes before deletion
      // @ts-ignore -- deep type instantiation on quotes table
      const quoteCheck = await supabase.from("quotes").select("id", { count: "exact", head: true }).eq("lead_id", id);
      const quoteCount = quoteCheck.count as number | null;
      if ((quoteCount || 0) > 0) {
        throw new Error(`Cannot delete lead with ${quoteCount} linked quote(s). Remove quotes first.`);
      }
      // Clean up orphanable child records
      await supabase.from("lead_activities").delete().eq("lead_id", id);
      await supabase.from("lead_events").delete().eq("lead_id", id);
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

  // Keep ref in sync for keyboard shortcuts
  filteredLeadsRef.current = filteredLeads;

  const leadsByStage = useMemo(() => {
    const activityOrder: Record<string, number> = { overdue: 0, today: 1, planned: 2, none: 3 };
    const getActivityStatus = (l: LeadWithCustomer) => {
      if (l.stage === "won" || l.stage === "lost") return "none";
      if (!l.expected_close_date) return "none";
      const diff = differenceInCalendarDays(new Date(l.expected_close_date), new Date());
      if (diff < 0) return "overdue";
      if (diff === 0) return "today";
      return "planned";
    };

    const grouped: Record<string, LeadWithCustomer[]> = {};
    const knownStageIds = new Set(PIPELINE_STAGES.map(s => s.id));

    const sortLeads = (list: LeadWithCustomer[]) =>
      list.sort((a, b) => {
        const actDiff = activityOrder[getActivityStatus(a)] - activityOrder[getActivityStatus(b)];
        if (actDiff !== 0) return actDiff;
        const getStars = (l: LeadWithCustomer) => {
          const meta = l.metadata as Record<string, unknown> | null;
          const hasOdooId = !!meta?.odoo_id;
          const odooPriority = meta?.odoo_priority as string | undefined;
          if (odooPriority !== undefined && odooPriority !== null) {
            return Math.min(parseInt(odooPriority) || 0, 3);
          }
          if (hasOdooId) return 0;
          if (l.priority === "high") return 3;
          if (l.priority === "medium") return 2;
          return 0;
        };
        const starDiff = getStars(b) - getStars(a);
        if (starDiff !== 0) return starDiff;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

    PIPELINE_STAGES.forEach((stage) => {
      grouped[stage.id] = sortLeads(filteredLeads.filter((lead) => lead.stage === stage.id));
    });

    // Catch-all for leads with unmapped stages
    const unmappedLeads = filteredLeads.filter(l => !knownStageIds.has(l.stage));
    if (unmappedLeads.length > 0) {
      grouped["__unmapped__"] = sortLeads(unmappedLeads);
    }

    return grouped;
  }, [filteredLeads]);

  const finalStages = useMemo(() => {
    if (leadsByStage["__unmapped__"]?.length > 0) {
      return [...orderedStages, { id: "__unmapped__", label: "Unmapped Stage", color: "bg-red-500" }];
    }
    return orderedStages;
  }, [orderedStages, leadsByStage]);

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!isAdmin) {
      toast({ title: "Permission denied", description: "Only admins can delete leads.", variant: "destructive" });
      return;
    }
    deleteMutation.mutate(id);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingLead(null);
  };

  const handleStageChange = useCallback((leadId: string, newStage: string) => {
    // Find the lead to get company_id / customer_id for gate modals
    const lead = leads.find((l) => l.id === leadId) ?? null;

    // Check if this transition requires memory gates
    // Use a quick synchronous check — we re-check after memory loads
    const gates = getRequiredGates(newStage, { hasQualification: false, hasPricing: false, hasLoss: false, hasOutcome: false });

    if (gates.length > 0) {
      // Open gate flow — set pending transition, will check actual memory in effect
      setPendingTransition({ leadId, targetStage: newStage, lead });
      return;
    }

    updateStageMutation.mutate({ id: leadId, stage: newStage, fromStage: lead?.stage });
    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => prev ? { ...prev, stage: newStage } : null);
    }
  }, [leads, selectedLead, updateStageMutation]);

  // Effect: when pendingTransition is set and memory loads, determine which gates are actually needed
  useEffect(() => {
    if (!pendingTransition) return;
    const gates = getRequiredGates(pendingTransition.targetStage, pendingMemory);
    if (gates.length === 0) {
      // All memory already exists — proceed with transition
      updateStageMutation.mutate({ id: pendingTransition.leadId, stage: pendingTransition.targetStage, fromStage: pendingTransition.lead?.stage });
      if (selectedLead?.id === pendingTransition.leadId) {
        setSelectedLead((prev) => prev ? { ...prev, stage: pendingTransition.targetStage } : null);
      }
      setPendingTransition(null);
      setActiveGates([]);
      setCurrentGateIndex(0);
    } else {
      setActiveGates(gates.map((g) => g.type));
      setCurrentGateIndex(0);
    }
  }, [pendingTransition, pendingMemory]);

  const currentGate = activeGates[currentGateIndex] ?? null;
  const pendingLead = pendingTransition?.lead;
  const pendingCompanyId = (pendingLead as any)?.company_id ?? "";
  const pendingCustomerId = (pendingLead as any)?.customer_id ?? null;

  const handleGateComplete = () => {
    if (currentGateIndex < activeGates.length - 1) {
      // Move to next gate
      setCurrentGateIndex((i) => i + 1);
    } else {
      // All gates passed — proceed with transition
      if (pendingTransition) {
        updateStageMutation.mutate({ id: pendingTransition.leadId, stage: pendingTransition.targetStage, fromStage: pendingTransition.lead?.stage });
        if (selectedLead?.id === pendingTransition.leadId) {
          setSelectedLead((prev) => prev ? { ...prev, stage: pendingTransition.targetStage } : null);
        }
      }
      setPendingTransition(null);
      setActiveGates([]);
      setCurrentGateIndex(0);
    }
  };

  const handleGateCancel = () => {
    setPendingTransition(null);
    setActiveGates([]);
    setCurrentGateIndex(0);
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


  // Build pipeline stats for AI scan
  const pipelineStats = useMemo(() => {
    const stats: Record<string, unknown> = {};
    const stages = PIPELINE_STAGES.map((s) => {
      const stageLeads = leadsByStage[s.id] || [];
      return {
        id: s.id,
        label: s.label,
        count: stageLeads.length,
        totalRevenue: stageLeads.reduce((sum, l) => sum + ((l.expected_value as number) || 0), 0),
        leads: stageLeads.slice(0, 5).map((l) => ({
          id: l.id,
          title: l.title,
          customer: l.customers?.name || l.customers?.company_name || "Unknown",
          updated_at: l.updated_at,
          expected_value: l.expected_value,
          stage: l.stage,
        })),
      };
    });
    stats.stages = stages;
    stats.totalLeads = filteredLeads.length;
    return stats;
  }, [leadsByStage, filteredLeads]);

  const handleExecuteAIAction = (action: any) => {
    const data = action.suggested_data as Record<string, unknown>;
    if (action.action_type === "move_stage" && data?.target_stage) {
      executeAction({
        actionId: action.id,
        onExecute: async () => {
          handleStageChange(action.lead_id, data.target_stage as string);
        },
      });
    } else {
      executeAction({
        actionId: action.id,
        onExecute: async () => {
          // Generic execute — just mark as executed
        },
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="px-4 sm:px-6 py-2 border-b border-border shrink-0 space-y-1.5 bg-background">
      {/* Row 1: Title, stats, actions — Odoo style */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 mr-auto flex-wrap">
            <h1 className="text-[15px] font-semibold leading-tight text-foreground">Pipeline</h1>
            <span className="text-[11px] text-muted-foreground">
              ({filteredLeads.length}{filteredLeads.length !== leads.length ? ` / ${leads.length}` : ""})
            </span>
            {isAdmin && lastSyncedAt && (
              <span className={`hidden sm:flex items-center gap-1 text-[10px] font-medium ${syncStatusColor}`}>
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                  differenceInMinutes(new Date(), lastSyncedAt) < 30 ? "bg-emerald-500" :
                  differenceInMinutes(new Date(), lastSyncedAt) < 60 ? "bg-amber-500" : "bg-destructive"
                }`} />
                Synced {formatDistanceToNow(lastSyncedAt, { addSuffix: true })}
              </span>
            )}
          </div>

          {/* AI Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Manual</span>
            <Switch
              checked={aiMode}
              onCheckedChange={toggleAiMode}
              className="data-[state=checked]:bg-primary"
            />
            <div className="flex items-center gap-1">
              <Bot className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium">AI</span>
              {pendingCount > 0 && (
                <Badge variant="destructive" className="text-[10px] h-4 px-1 ml-0.5">
                  {pendingCount}
                </Badge>
              )}
            </div>
          </div>

          {/* Overflow actions menu */}
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
              {isAdmin && (
                <DropdownMenuItem onClick={handleOdooSync} disabled={isSyncingOdoo}>
                  {isSyncingOdoo ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <RefreshCw className="w-3.5 h-3.5 mr-2" />}
                  <span>Odoo Sync</span>
                  {lastSyncedAt && (
                    <span className={`ml-auto text-[10px] ${syncStatusColor}`}>
                      {formatDistanceToNow(lastSyncedAt, { addSuffix: true })}
                    </span>
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => navigate("/prospecting")}>
                <Pickaxe className="w-3.5 h-3.5 mr-2" />
                Prospect
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/pipeline/intelligence")}>
                <BarChart3 className="w-3.5 h-3.5 mr-2" />
                Intelligence
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsAISheetOpen(true)}>
                <Sparkles className="w-3.5 h-3.5 mr-2" />
                Blitz (AI)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => setIsFormOpen(true)} size="sm" className="gap-1.5 h-7 rounded-sm text-[13px] font-medium">
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

      {/* Pipeline Board + AI Panel */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden">
          {isMobile ? (
            <MobilePipelineView
              stages={finalStages}
              leadsByStage={leadsByStage}
              isLoading={isLoading}
              onStageChange={handleStageChange}
              onLeadClick={handleLeadClick}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : (
            <PipelineBoard
              stages={finalStages}
              leadsByStage={leadsByStage}
              isLoading={isLoading}
              onStageChange={handleStageChange}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onLeadClick={handleLeadClick}
              canReorder={canReorder}
              onReorder={saveOrder}
              aiMode={aiMode}
              aiActionLeadIds={new Set(aiActions.filter(a => a.status === "pending").map(a => a.lead_id))}
            />
          )}
        </div>

        {/* AI Autopilot Panel */}
        {aiMode && (
          <PipelineAIActions
            actions={aiActions}
            isLoading={aiLoading}
            isScanning={isScanning}
            onScan={() => runScan(pipelineStats)}
            onApprove={approveAction}
            onDismiss={dismissAction}
            onApproveAll={approveAll}
            onDismissAll={dismissAll}
            onExecuteAction={handleExecuteAIAction}
          />
        )}
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

      {/* ── Pipeline Memory Gate Modals ── */}
      {pendingTransition && pendingCompanyId && (
        <>
          <QualificationGateModal
            open={currentGate === "qualification"}
            onOpenChange={(open) => { if (!open) handleGateCancel(); }}
            leadId={pendingTransition.leadId}
            companyId={pendingCompanyId}
            onComplete={handleGateComplete}
            gateStep={currentGateIndex}
            gateTotalSteps={activeGates.length}
          />
          <PricingGateModal
            open={currentGate === "pricing"}
            onOpenChange={(open) => { if (!open) handleGateCancel(); }}
            leadId={pendingTransition.leadId}
            companyId={pendingCompanyId}
            onComplete={handleGateComplete}
            gateStep={currentGateIndex}
            gateTotalSteps={activeGates.length}
          />
          <LossGateModal
            open={currentGate === "loss"}
            onOpenChange={(open) => { if (!open) handleGateCancel(); }}
            leadId={pendingTransition.leadId}
            companyId={pendingCompanyId}
            onComplete={handleGateComplete}
            gateStep={currentGateIndex}
            gateTotalSteps={activeGates.length}
          />
          <DeliveryGateModal
            open={currentGate === "delivery"}
            onOpenChange={(open) => { if (!open) handleGateCancel(); }}
            leadId={pendingTransition.leadId}
            companyId={pendingCompanyId}
            customerId={pendingCustomerId}
            onComplete={handleGateComplete}
            gateStep={currentGateIndex}
            gateTotalSteps={activeGates.length}
            expectedValue={pendingLead?.expected_value ?? null}
          />
          <LossGateModal
            open={currentGate === "loss"}
            onOpenChange={(open) => { if (!open) handleGateCancel(); }}
            leadId={pendingTransition.leadId}
            companyId={pendingCompanyId}
            onComplete={handleGateComplete}
          />
          <DeliveryGateModal
            open={currentGate === "delivery"}
            onOpenChange={(open) => { if (!open) handleGateCancel(); }}
            leadId={pendingTransition.leadId}
            companyId={pendingCompanyId}
            customerId={pendingCustomerId}
            onComplete={handleGateComplete}
          />
        </>
      )}

      {/* Bulk Actions Bar */}
      <PipelineBulkBar
        count={bulk.selectionCount}
        onMove={bulk.bulkMove}
        onDelete={bulk.bulkDelete}
        onClear={bulk.clearSelection}
        isMoving={bulk.isMoving}
        isDeleting={bulk.isDeleting}
      />

      {/* Keyboard Shortcut Help */}
      <KeyboardShortcutHelp open={shortcutHelpOpen} onOpenChange={setShortcutHelpOpen} />
    </div>
  );
}
