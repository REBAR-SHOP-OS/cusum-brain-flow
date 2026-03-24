import { useState, useCallback, useEffect, useMemo } from "react";
import { useSalesLeads, SALES_STAGES, SalesLead } from "@/hooks/useSalesLeads";
import { useAuth } from "@/lib/auth";
import { ACCESS_POLICIES } from "@/lib/accessPolicies";
import { useSalesContacts } from "@/hooks/useSalesContacts";
import { useSalesLeadAssignees } from "@/hooks/useLeadAssignees";
import { Button } from "@/components/ui/button";
import { Plus, ChevronsUpDown, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useProfiles } from "@/hooks/useProfiles";
import SalesSearchBar from "@/components/sales/SalesSearchBar";
import SalesLeadDrawer from "@/components/sales/SalesLeadDrawer";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PipelineAnalytics } from "@/components/pipeline/PipelineAnalytics";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

// Stage groups for filter chips — matches main Pipeline
const SALES_STAGE_GROUPS = [
  { label: "Sales", ids: ["prospecting", "new", "telephonic_enquiries", "qualified", "hot_enquiries", "rfi", "addendums"], color: "bg-blue-500" },
  { label: "Estimation", ids: ["estimation_ben", "estimation_karthick", "estimation_others", "estimation_partha", "qc_ben"], color: "bg-amber-500" },
  { label: "Quotation", ids: ["quotation_priority", "quotation_bids"], color: "bg-rose-500" },
  { label: "Operations", ids: ["shop_drawing", "shop_drawing_approval", "fabrication_in_shop", "ready_to_dispatch", "out_for_delivery", "delivered_pickup_done"], color: "bg-violet-500" },
  { label: "Terminal", ids: ["won", "lost", "loss", "merged", "no_rebars_out_of_scope", "temp_ir_vam", "migration_others", "dreamers", "archived_orphan"], color: "bg-zinc-500" },
] as const;

// Adapter: SalesLead → LeadWithCustomer shape for PipelineBoard/LeadCard
function adaptSalesLead(sl: SalesLead): LeadWithCustomer {
  return {
    id: sl.id,
    company_id: sl.company_id,
    title: sl.title,
    description: sl.description,
    stage: sl.stage,
    priority: sl.priority,
    probability: sl.probability,
    expected_value: sl.expected_value,
    expected_close_date: sl.expected_close_date,
    source: sl.source,
    assigned_to: sl.assigned_to,
    notes: sl.notes,
    metadata: sl.metadata,
    created_at: sl.created_at,
    updated_at: sl.updated_at,
    // Fields that don't exist on sales_leads — stub them
    customer_id: null,
    contact_id: null,
    quote_id: null,
    source_email_id: null,
    computed_score: null,
    priority_score: null,
    win_prob_score: null,
    score_confidence: null,
    score_updated_at: null,
    sla_breached: false,
    sla_deadline: null,
    escalated_to: null,
    last_touched_at: null,
    odoo_created_at: null,
    odoo_updated_at: null,
    customers: {
      name: sl.contact_name || sl.title,
      company_name: sl.contact_company,
    },
  } as LeadWithCustomer;
}

// Map SALES_STAGES to the format PipelineBoard expects
const PIPELINE_STAGES = SALES_STAGES.map((s) => ({
  id: s.id,
  label: s.label,
  color: s.color,
}));

export default function SalesPipeline() {
  const { user } = useAuth();
  const userEmail = user?.email?.toLowerCase() || "";
  const externalEstimatorStages = ACCESS_POLICIES.externalEstimators[userEmail];
  const isExternalEstimator = !!externalEstimatorStages;

  const { leads, isLoading, createLead, updateLead, deleteLead } = useSalesLeads();
  const { contacts: unifiedContacts } = useSalesContacts();
  const { profiles } = useProfiles();
  const activeProfiles = (profiles ?? []).filter(p => p.is_active);
  const { bySalesLeadId, addAssignee, removeAssignee } = useSalesLeadAssignees();

  // Find external estimator's profile ID
  const myProfileId = useMemo(() => {
    if (!isExternalEstimator) return null;
    return activeProfiles.find(p => p.email?.toLowerCase() === userEmail)?.id ?? null;
  }, [isExternalEstimator, activeProfiles, userEmail]);

  const [createOpen, setCreateOpen] = useState(false);
  const [drawerLead, setDrawerLead] = useState<SalesLead | null>(null);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);

  // Form state
  const SOURCES = ["Email", "Phone/Call", "Website", "Referral", "Trade Show", "Social Media", "Cold Outreach", "Partner", "Other"];
  const [form, setForm] = useState({
    title: "", contact_name: "", contact_company: "", contact_email: "", contact_phone: "",
    expected_value: "", source: "", notes: "", stage: "new", priority: "medium",
    probability: "", expected_close_date: "", assigned_to: "", territory: "", description: "", lead_type: "opportunity",
  });
  const resetForm = () => {
    setForm({
      title: "", contact_name: "", contact_company: "", contact_email: "", contact_phone: "",
      expected_value: "", source: "", notes: "", stage: "new", priority: "medium",
      probability: "", expected_close_date: "", assigned_to: "", territory: "", description: "", lead_type: "opportunity",
    });
    setSelectedAssignees([]);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === "n") { e.preventDefault(); setCreateOpen(true); }
      if (e.key === "Escape") setDrawerLead(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // For external estimators: filter leads to only those assigned to them
  const effectiveLeads = useMemo(() => {
    if (!isExternalEstimator || !myProfileId) return leads;
    return leads.filter(l => {
      const assignees = bySalesLeadId[l.id] ?? [];
      return assignees.some(a => a.profile_id === myProfileId);
    });
  }, [leads, isExternalEstimator, myProfileId, bySalesLeadId]);

  // Determine visible stage IDs based on active group filter or external estimator restriction
  const visibleStageIds = useMemo(() => {
    if (isExternalEstimator) {
      // Derive columns from the stages of assigned leads
      const stageSet = new Set(effectiveLeads.map(l => l.stage));
      // Also include the default assigned stages so columns always show
      externalEstimatorStages.forEach(s => stageSet.add(s));
      return [...stageSet];
    }
    if (!activeGroup) return SALES_STAGES.map((s) => s.id);
    const group = SALES_STAGE_GROUPS.find((g) => g.label === activeGroup);
    return group ? [...group.ids] : SALES_STAGES.map((s) => s.id);
  }, [activeGroup, isExternalEstimator, externalEstimatorStages, effectiveLeads]);

  const visibleStages = useMemo(
    () => PIPELINE_STAGES.filter((s) => visibleStageIds.includes(s.id)),
    [visibleStageIds]
  );

  // Filter leads by search
  const filtered = useMemo(() => {
    const source = isExternalEstimator ? effectiveLeads : leads;
    if (!search.trim()) return source;
    const q = search.toLowerCase();
    return source.filter(l =>
      l.title.toLowerCase().includes(q) ||
      (l.contact_name || "").toLowerCase().includes(q) ||
      (l.contact_company || "").toLowerCase().includes(q) ||
      (l.contact_email || "").toLowerCase().includes(q)
    );
  }, [leads, effectiveLeads, search, isExternalEstimator]);

  // Group adapted leads by stage
  const leadsByStage = useMemo(() => {
    const map: Record<string, LeadWithCustomer[]> = {};
    SALES_STAGES.forEach((s) => { map[s.id] = []; });
    filtered.forEach((l) => {
      const adapted = adaptSalesLead(l);
      if (map[l.stage]) map[l.stage].push(adapted);
      else map["new"]?.push(adapted);
    });
    return map;
  }, [filtered]);

  // Stage group counts
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    SALES_STAGE_GROUPS.forEach((g) => {
      counts[g.label] = g.ids.reduce((sum, id) => sum + (leadsByStage[id]?.length || 0), 0);
    });
    return counts;
  }, [leadsByStage]);

  // Adapted leads for analytics
  const allAdapted = useMemo(() => leads.map(adaptSalesLead), [leads]);

  const handleCreate = () => {
    if (!form.title.trim()) return;
    createLead.mutate({
      title: form.title,
      stage: form.stage || "new",
      priority: form.priority || null,
      contact_name: form.contact_name || null,
      contact_company: form.contact_company || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      expected_value: form.expected_value ? Number(form.expected_value) : null,
      probability: form.probability ? Number(form.probability) : null,
      expected_close_date: form.expected_close_date || null,
      source: form.source || null,
      assigned_to: form.assigned_to || null,
      description: form.description || null,
      notes: form.notes || null,
    }, {
      onSuccess: (data: any) => {
        // Insert assignees into junction table
        if (selectedAssignees.length > 0 && data?.id) {
          selectedAssignees.forEach(profileId => {
            addAssignee.mutate({ salesLeadId: data.id, profileId });
          });
        }
      },
    });
    setCreateOpen(false);
    resetForm();
  };

  const handleStageChange = useCallback((leadId: string, newStage: string) => {
    updateLead.mutate({ id: leadId, stage: newStage });
  }, [updateLead]);

  const handleLeadClick = useCallback((lead: LeadWithCustomer) => {
    // Find the original SalesLead
    const original = leads.find((l) => l.id === lead.id);
    if (original) setDrawerLead(original);
  }, [leads]);

  // No-ops for edit/delete from card (handled in drawer)
  const noop = useCallback(() => {}, []);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-muted-foreground">Loading pipeline...</div></div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header Row 1: Title + Analytics + New */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground shrink-0">
            Sales Pipeline
            <span className="text-muted-foreground font-normal ml-1.5 text-sm">({leads.length})</span>
          </h1>
          <PipelineAnalytics leads={allAdapted} />
        </div>
        {!isExternalEstimator && (
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" />New Lead</Button>
        )}
      </div>

      {/* Header Row 2: Search + Stage Group Filters */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-b border-border">
        <div className="w-56">
          <SalesSearchBar value={search} onChange={setSearch} placeholder="Search leads... ( / )" />
        </div>
        {!isExternalEstimator && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveGroup(null)}
              className={cn(
                "text-xs px-2 py-0.5 rounded-sm transition-colors",
                !activeGroup ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              Show all
            </button>
            {SALES_STAGE_GROUPS.map((g) => (
              <button
                key={g.label}
                onClick={() => setActiveGroup((prev) => (prev === g.label ? null : g.label))}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-sm transition-colors",
                  activeGroup === g.label ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", g.color)} />
                {g.label}
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-3.5 min-w-[16px] justify-center rounded-sm">
                  {groupCounts[g.label] || 0}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Board — reuse PipelineBoard */}
      <div className="flex-1 overflow-hidden">
        <PipelineBoard
          stages={visibleStages}
          leadsByStage={leadsByStage}
          isLoading={false}
          onStageChange={handleStageChange}
          onEdit={noop as any}
          onDelete={noop as any}
          onLeadClick={handleLeadClick}
          assigneesByLeadId={bySalesLeadId}
        />
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Sales Lead</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Title */}
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Lead title" /></div>

            {/* Contact Name + Company */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Contact Name</Label>
                <Popover open={contactPopoverOpen} onOpenChange={setContactPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-10">
                      {form.contact_name || <span className="text-muted-foreground">Select contact...</span>}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search contacts..." />
                      <CommandList>
                        <CommandEmpty>No contact found.</CommandEmpty>
                        {unifiedContacts.map(c => (
                          <CommandItem
                            key={c.id}
                            value={`${c.name} ${c.company_name ?? ""} ${c.email ?? ""}`}
                            onSelect={() => {
                              setForm(p => ({
                                ...p,
                                contact_name: c.name,
                                contact_company: c.company_name ?? "",
                                contact_email: c.email ?? "",
                                contact_phone: c.phone ?? "",
                              }));
                              setContactPopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", form.contact_name === c.name ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="text-sm">{c.name}</span>
                              {c.company_name && <span className="text-xs text-muted-foreground">{c.company_name}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div><Label>Company</Label><Input value={form.contact_company} onChange={e => setForm(p => ({ ...p, contact_company: e.target.value }))} /></div>
            </div>

            {/* Email + Phone */}
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Email</Label><Input type="email" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} /></div>
            </div>

            {/* Stage + Priority */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Stage</Label>
                <Select value={form.stage} onValueChange={v => setForm(p => ({ ...p, stage: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SALES_STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Lead Type + Source */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Lead Type</Label>
                <Select value={form.lead_type} onValueChange={v => setForm(p => ({ ...p, lead_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opportunity">Opportunity</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Source</Label>
                <Select value={form.source || ""} onValueChange={v => setForm(p => ({ ...p, source: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Expected Value + Probability */}
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Expected Value</Label><Input type="number" value={form.expected_value} onChange={e => setForm(p => ({ ...p, expected_value: e.target.value }))} placeholder="$0" /></div>
              <div><Label>Probability (%)</Label><Input type="number" min={0} max={100} value={form.probability} onChange={e => setForm(p => ({ ...p, probability: e.target.value }))} placeholder="0-100" /></div>
            </div>

            {/* Expected Close Date */}
            <div><Label>Expected Close Date</Label><Input type="date" value={form.expected_close_date} onChange={e => setForm(p => ({ ...p, expected_close_date: e.target.value }))} /></div>

            {/* Assigned To + Territory */}
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Assigned To</Label>
                <Select value={form.assigned_to} onValueChange={v => setForm(p => ({ ...p, assigned_to: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                  <SelectContent>
                    {activeProfiles.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Territory</Label><Input value={form.territory} onChange={e => setForm(p => ({ ...p, territory: e.target.value }))} placeholder="Region" /></div>
            </div>

            {/* Description */}
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Lead description..." /></div>

            {/* Notes */}
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Internal notes..." /></div>

            {/* Footer */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setCreateOpen(false); resetForm(); }}>Cancel</Button>
              <Button className="flex-1" onClick={handleCreate} disabled={!form.title.trim()}>Create Lead</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Drawer */}
      <SalesLeadDrawer
        lead={drawerLead}
        open={!!drawerLead}
        onClose={() => setDrawerLead(null)}
        onUpdate={(data) => { updateLead.mutate(data); setDrawerLead(prev => prev ? { ...prev, ...data } : null); }}
        onDelete={(id) => deleteLead.mutate(id)}
      />
    </div>
  );
}
