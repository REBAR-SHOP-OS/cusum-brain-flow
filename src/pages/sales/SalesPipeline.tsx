import { useState, useCallback, useEffect, useMemo } from "react";
import { useSalesLeads, SALES_STAGES, SalesLead } from "@/hooks/useSalesLeads";
import { useSalesContacts } from "@/hooks/useSalesContacts";
import { Button } from "@/components/ui/button";
import { Plus, ChevronsUpDown, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import SalesSearchBar from "@/components/sales/SalesSearchBar";
import SalesSummaryCards, { SummaryCardData } from "@/components/sales/SalesSummaryCards";
import SalesLeadCard from "@/components/sales/SalesLeadCard";
import SalesLeadDrawer from "@/components/sales/SalesLeadDrawer";

export default function SalesPipeline() {
  const { leads, isLoading, createLead, updateLead, deleteLead } = useSalesLeads();
  const { contacts: unifiedContacts } = useSalesContacts();
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerLead, setDrawerLead] = useState<SalesLead | null>(null);
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [contactPopoverOpen, setContactPopoverOpen] = useState(false);

  // Form state
  const [form, setForm] = useState({ title: "", contact_name: "", contact_company: "", contact_email: "", contact_phone: "", expected_value: "", source: "", notes: "" });
  const resetForm = () => setForm({ title: "", contact_name: "", contact_company: "", contact_email: "", contact_phone: "", expected_value: "", source: "", notes: "" });

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

  // Filter leads
  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(l =>
      l.title.toLowerCase().includes(q) ||
      (l.contact_name || "").toLowerCase().includes(q) ||
      (l.contact_company || "").toLowerCase().includes(q) ||
      (l.contact_email || "").toLowerCase().includes(q)
    );
  }, [leads, search]);

  const leadsByStage: Record<string, SalesLead[]> = {};
  SALES_STAGES.forEach(s => { leadsByStage[s.id] = []; });
  filtered.forEach(l => {
    if (leadsByStage[l.stage]) leadsByStage[l.stage].push(l);
    else leadsByStage["new"]?.push(l);
  });

  // Analytics
  const totalValue = leads.reduce((s, l) => s + (l.expected_value || 0), 0);
  const wonLeads = leads.filter(l => l.stage === "won");
  const wonValue = wonLeads.reduce((s, l) => s + (l.expected_value || 0), 0);
  const closedLeads = leads.filter(l => l.stage === "won" || l.stage === "lost");
  const winRate = closedLeads.length > 0 ? Math.round((wonLeads.length / closedLeads.length) * 100) : 0;
  const avgDeal = wonLeads.length > 0 ? Math.round(wonValue / wonLeads.length) : 0;

  const summaryCards: SummaryCardData[] = [
    { label: "Pipeline Value", value: `$ ${totalValue.toLocaleString()}`, sub: `${leads.length} deals` },
    { label: "Won Value", value: `$ ${wonValue.toLocaleString()}`, sub: `${wonLeads.length} deals`, color: "text-green-500" },
    { label: "Win Rate", value: `${winRate}%`, sub: `${closedLeads.length} closed` },
    { label: "Avg Deal", value: avgDeal > 0 ? `$ ${avgDeal.toLocaleString()}` : "—" },
  ];

  const handleCreate = () => {
    if (!form.title.trim()) return;
    createLead.mutate({
      title: form.title,
      contact_name: form.contact_name || null,
      contact_company: form.contact_company || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      expected_value: form.expected_value ? Number(form.expected_value) : null,
      source: form.source || null,
      notes: form.notes || null,
    });
    setCreateOpen(false);
    resetForm();
  };

  const handleDrop = (stageId: string) => {
    if (draggedLead) {
      updateLead.mutate({ id: draggedLead, stage: stageId });
    }
    setDraggedLead(null);
    setDragOverStage(null);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><div className="animate-pulse text-muted-foreground">Loading pipeline...</div></div>;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-3">
        <h1 className="text-lg font-semibold text-foreground shrink-0">Sales Pipeline</h1>
        <div className="flex-1 max-w-xs">
          <SalesSearchBar value={search} onChange={setSearch} placeholder="Search leads... ( / )" />
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" />New Lead</Button>
      </div>

      {/* Analytics */}
      <div className="px-4 pt-3">
        <SalesSummaryCards cards={summaryCards} />
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-0 min-w-max h-full">
          {SALES_STAGES.map(stage => {
            const stageLeads = leadsByStage[stage.id] || [];
            const stageValue = stageLeads.reduce((s, l) => s + (l.expected_value || 0), 0);
            return (
              <div
                key={stage.id}
                className={cn(
                  "w-[272px] flex-shrink-0 flex flex-col h-full border-r border-border last:border-r-0 transition-colors",
                  dragOverStage === stage.id ? "bg-primary/5" : "bg-muted/20"
                )}
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id); }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={e => { e.preventDefault(); handleDrop(stage.id); }}
              >
                <div className="px-2 pt-2 pb-1.5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[13px] truncate flex-1 text-foreground">{stage.label}</h3>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {stageValue > 0 && <span className="text-[11px] font-medium text-muted-foreground">$ {stageValue.toLocaleString()}</span>}
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[20px] justify-center rounded-sm">{stageLeads.length}</Badge>
                    </div>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-sm overflow-hidden" style={{ backgroundColor: "hsl(var(--muted))" }}>
                    <div className="h-full rounded-sm" style={{ width: stageLeads.length > 0 ? "100%" : "0%", backgroundColor: stage.color }} />
                  </div>
                </div>
                <div className="px-1.5 py-1.5 space-y-1.5 min-h-[120px] flex-1 overflow-y-auto">
                  {stageLeads.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8 opacity-50">Drop leads here</p>
                  ) : stageLeads.map(lead => (
                    <SalesLeadCard
                      key={lead.id}
                      lead={lead}
                      isDragging={draggedLead === lead.id}
                      onClick={() => setDrawerLead(lead)}
                      onDragStart={() => setDraggedLead(lead.id)}
                      onDragEnd={() => { setDraggedLead(null); setDragOverStage(null); }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Sales Lead</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Lead title" /></div>
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
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Email</Label><Input type="email" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input value={form.contact_phone} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Expected Value</Label><Input type="number" value={form.expected_value} onChange={e => setForm(p => ({ ...p, expected_value: e.target.value }))} /></div>
              <div><Label>Source</Label><Input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder="e.g. Website, Referral" /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button onClick={handleCreate} className="w-full" disabled={!form.title.trim()}>Create Lead</Button>
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
