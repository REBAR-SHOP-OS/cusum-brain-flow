import { useState } from "react";
import { useSalesLeads, SALES_STAGES, SalesLead } from "@/hooks/useSalesLeads";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function SalesPipeline() {
  const { leads, isLoading, createLead, updateLead, deleteLead } = useSalesLeads();
  const [createOpen, setCreateOpen] = useState(false);
  const [editLead, setEditLead] = useState<SalesLead | null>(null);
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({ title: "", contact_name: "", contact_company: "", contact_email: "", contact_phone: "", expected_value: "", source: "", notes: "" });

  const resetForm = () => setForm({ title: "", contact_name: "", contact_company: "", contact_email: "", contact_phone: "", expected_value: "", source: "", notes: "" });

  const leadsByStage: Record<string, SalesLead[]> = {};
  SALES_STAGES.forEach(s => { leadsByStage[s.id] = []; });
  leads.forEach(l => {
    if (leadsByStage[l.stage]) leadsByStage[l.stage].push(l);
    else leadsByStage["new"]?.push(l);
  });

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Sales Pipeline</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" />New Lead</Button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-0 min-w-max h-full">
          {SALES_STAGES.map(stage => {
            const stageLeads = leadsByStage[stage.id] || [];
            const totalValue = stageLeads.reduce((s, l) => s + (l.expected_value || 0), 0);
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
                      {totalValue > 0 && <span className="text-[11px] font-medium text-muted-foreground">$ {totalValue.toLocaleString()}</span>}
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
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDraggedLead(lead.id)}
                      onDragEnd={() => { setDraggedLead(null); setDragOverStage(null); }}
                      onClick={() => setEditLead(lead)}
                      className={cn(
                        "bg-card border border-border rounded-md p-2.5 cursor-pointer hover:shadow-sm transition-shadow",
                        draggedLead === lead.id && "opacity-50"
                      )}
                    >
                      <p className="text-sm font-medium text-foreground truncate">{lead.title}</p>
                      {lead.contact_company && <p className="text-xs text-muted-foreground truncate">{lead.contact_company}</p>}
                      {lead.contact_name && <p className="text-xs text-muted-foreground truncate">{lead.contact_name}</p>}
                      <div className="flex items-center justify-between mt-1.5">
                        {lead.expected_value ? <span className="text-xs font-medium text-primary">$ {Number(lead.expected_value).toLocaleString()}</span> : <span />}
                        {lead.source && <Badge variant="outline" className="text-[10px] h-4">{lead.source}</Badge>}
                      </div>
                    </div>
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
              <div><Label>Contact Name</Label><Input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} /></div>
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

      {/* Edit/Detail Dialog */}
      <Dialog open={!!editLead} onOpenChange={() => setEditLead(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editLead?.title}</DialogTitle></DialogHeader>
          {editLead && (
            <div className="space-y-3">
              <div><Label>Stage</Label>
                <Select value={editLead.stage} onValueChange={v => { updateLead.mutate({ id: editLead.id, stage: v }); setEditLead({ ...editLead, stage: v }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SALES_STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Contact</Label><p className="text-sm text-muted-foreground">{editLead.contact_name || "—"}</p></div>
                <div><Label>Company</Label><p className="text-sm text-muted-foreground">{editLead.contact_company || "—"}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Email</Label><p className="text-sm text-muted-foreground">{editLead.contact_email || "—"}</p></div>
                <div><Label>Phone</Label><p className="text-sm text-muted-foreground">{editLead.contact_phone || "—"}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Value</Label><p className="text-sm text-muted-foreground">{editLead.expected_value ? `$ ${Number(editLead.expected_value).toLocaleString()}` : "—"}</p></div>
                <div><Label>Source</Label><p className="text-sm text-muted-foreground">{editLead.source || "—"}</p></div>
              </div>
              {editLead.notes && <div><Label>Notes</Label><p className="text-sm text-muted-foreground">{editLead.notes}</p></div>}
              <Button variant="destructive" size="sm" onClick={() => { deleteLead.mutate(editLead.id); setEditLead(null); }}>Delete Lead</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
