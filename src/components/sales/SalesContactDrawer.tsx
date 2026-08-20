import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Mail, Phone } from "lucide-react";
import { SalesContact } from "@/hooks/useSalesContacts";
import { useState, useEffect } from "react";
import { format } from "date-fns";

interface Props {
  contact: SalesContact | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (data: Partial<SalesContact> & { id: string }) => void;
  onDelete: (id: string) => void;
}

export default function SalesContactDrawer({ contact, open, onClose, onUpdate, onDelete }: Props) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (contact) setNotes(contact.notes || "");
  }, [contact]);

  if (!contact) return null;

  const isSystem = contact.source === "system";

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="text-left">{contact.name}</SheetTitle>
            {isSystem && <Badge variant="secondary" className="text-[10px]">CRM</Badge>}
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Quick actions */}
          <div className="flex gap-2">
            {contact.email && (
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${contact.email}`}><Mail className="w-3.5 h-3.5 mr-1" />Email</a>
              </Button>
            )}
            {contact.phone && (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${contact.phone}`}><Phone className="w-3.5 h-3.5 mr-1" />Call</a>
              </Button>
            )}
          </div>

          {/* Editable fields (only for manual contacts) */}
          {!isSystem ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input defaultValue={contact.name} className="h-9" onBlur={(e) => onUpdate({ id: contact.id, name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Company</Label>
                  <Input defaultValue={contact.company_name || ""} className="h-9" onBlur={(e) => onUpdate({ id: contact.id, company_name: e.target.value || null })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input defaultValue={contact.email || ""} className="h-9" onBlur={(e) => onUpdate({ id: contact.id, email: e.target.value || null })} />
                </div>
                <div>
                  <Label className="text-xs">Phone</Label>
                  <Input defaultValue={contact.phone || ""} className="h-9" onBlur={(e) => onUpdate({ id: contact.id, phone: e.target.value || null })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Title / Role</Label>
                  <Input defaultValue={(contact as any).title || ""} className="h-9" onBlur={(e) => onUpdate({ id: contact.id, title: e.target.value || null } as any)} />
                </div>
                <div>
                  <Label className="text-xs">Source</Label>
                  <Input defaultValue={contact.source || ""} className="h-9" onBlur={(e) => onUpdate({ id: contact.id, source: e.target.value || null })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Address</Label>
                <Input defaultValue={(contact as any).address || ""} className="h-9" onBlur={(e) => onUpdate({ id: contact.id, address: e.target.value || null } as any)} />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => { if (notes !== (contact.notes || "")) onUpdate({ id: contact.id, notes: notes || null }); }}
                  rows={3}
                  className="mt-1"
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Company</Label><p className="text-sm">{contact.company_name || "—"}</p></div>
                <div><Label className="text-xs">Source</Label><p className="text-sm">System CRM</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Email</Label><p className="text-sm">{contact.email || "—"}</p></div>
                <div><Label className="text-xs">Phone</Label><p className="text-sm">{contact.phone || "—"}</p></div>
              </div>
              <p className="text-[10px] text-muted-foreground italic">System contacts are read-only</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-border pt-3 flex items-center justify-between">
            <div className="text-[10px] text-muted-foreground">
              Added: {format(new Date(contact.created_at), "MMM d, yyyy")}
            </div>
            {!isSystem && (
              <Button variant="destructive" size="sm" onClick={() => { onDelete(contact.id); onClose(); }}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
