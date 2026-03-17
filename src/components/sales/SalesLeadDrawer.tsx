import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Star } from "lucide-react";
import { SALES_STAGES, SalesLead } from "@/hooks/useSalesLeads";
import { useState, useEffect } from "react";
import { format, differenceInDays } from "date-fns";

interface Props {
  lead: SalesLead | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (data: Partial<SalesLead> & { id: string }) => void;
  onDelete: (id: string) => void;
}

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export default function SalesLeadDrawer({ lead, open, onClose, onUpdate, onDelete }: Props) {
  const [notes, setNotes] = useState("");
  const [lostReason, setLostReason] = useState("");

  useEffect(() => {
    if (lead) {
      setNotes(lead.notes || "");
      setLostReason((lead as any).lost_reason || "");
    }
  }, [lead]);

  if (!lead) return null;

  const daysInStage = differenceInDays(new Date(), new Date(lead.updated_at));
  const stageInfo = SALES_STAGES.find(s => s.id === lead.stage);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left pr-8">{lead.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Stage + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Stage</Label>
              <Select value={lead.stage} onValueChange={(v) => onUpdate({ id: lead.id, stage: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SALES_STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Priority</Label>
              <Select value={lead.priority || "medium"} onValueChange={(v) => onUpdate({ id: lead.id, priority: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Days indicator */}
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stageInfo?.color || "#888" }} />
            <span className="text-xs text-muted-foreground">{daysInStage}d in {stageInfo?.label || lead.stage}</span>
          </div>

          {/* Value + Source */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Expected Value</Label>
              <Input
                type="number"
                defaultValue={lead.expected_value || ""}
                className="h-9"
                onBlur={(e) => {
                  const v = e.target.value ? Number(e.target.value) : null;
                  if (v !== lead.expected_value) onUpdate({ id: lead.id, expected_value: v });
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Source</Label>
              <Input
                defaultValue={lead.source || ""}
                className="h-9"
                onBlur={(e) => {
                  const v = e.target.value || null;
                  if (v !== lead.source) onUpdate({ id: lead.id, source: v });
                }}
              />
            </div>
          </div>

          {/* Contact info */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Name</Label>
                <p className="text-sm">{lead.contact_name || "—"}</p>
              </div>
              <div>
                <Label className="text-xs">Company</Label>
                <p className="text-sm">{lead.contact_company || "—"}</p>
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                {lead.contact_email ? (
                  <a href={`mailto:${lead.contact_email}`} className="text-sm text-primary hover:underline">{lead.contact_email}</a>
                ) : <p className="text-sm text-muted-foreground">—</p>}
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                {lead.contact_phone ? (
                  <a href={`tel:${lead.contact_phone}`} className="text-sm text-primary hover:underline">{lead.contact_phone}</a>
                ) : <p className="text-sm text-muted-foreground">—</p>}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="border-t border-border pt-3">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => { if (notes !== (lead.notes || "")) onUpdate({ id: lead.id, notes: notes || null }); }}
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Lost reason (show when stage is lost) */}
          {lead.stage === "lost" && (
            <div>
              <Label className="text-xs">Lost Reason</Label>
              <Input
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                onBlur={() => onUpdate({ id: lead.id, lost_reason: lostReason || null } as any)}
                placeholder="Why was this deal lost?"
                className="h-9"
              />
            </div>
          )}

          {/* Metadata */}
          <div className="border-t border-border pt-3 flex items-center justify-between">
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <p>Created: {format(new Date(lead.created_at), "MMM d, yyyy h:mm a")}</p>
              <p>Updated: {format(new Date(lead.updated_at), "MMM d, yyyy h:mm a")}</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => { onDelete(lead.id); onClose(); }}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
