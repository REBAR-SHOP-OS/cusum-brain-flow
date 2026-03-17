import { useState } from "react";
import { useSalesContacts } from "@/hooks/useSalesContacts";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function SalesContacts() {
  const { contacts, isLoading, create } = useSalesContacts();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", company_name: "", email: "", phone: "", source: "", notes: "" });

  const handleCreate = () => {
    if (!form.name.trim()) return;
    create.mutate({
      name: form.name,
      company_name: form.company_name || null,
      email: form.email || null,
      phone: form.phone || null,
      source: form.source || null,
      notes: form.notes || null,
    });
    setCreateOpen(false);
    setForm({ name: "", company_name: "", email: "", phone: "", source: "", notes: "" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Sales Contacts</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" />Add Contact</Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="animate-pulse text-muted-foreground text-center py-12">Loading...</div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <UserPlus className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">No contacts yet</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setCreateOpen(true)}>Add First Contact</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.company_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{c.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{c.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {c.source === "system" ? (
                      <span className="inline-flex items-center rounded-full bg-accent/50 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">CRM</span>
                    ) : (
                      c.source || "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{format(new Date(c.created_at), "MMM d, yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Company</Label><Input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} /></div>
              <div><Label>Source</Label><Input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder="e.g. Referral" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button onClick={handleCreate} className="w-full" disabled={!form.name.trim()}>Add Contact</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
