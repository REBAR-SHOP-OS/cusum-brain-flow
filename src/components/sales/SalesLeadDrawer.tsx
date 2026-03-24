import { useState, useEffect } from "react";
import { ComposeEmailDialog } from "@/components/inbox/ComposeEmailDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Building, Mail, Phone, DollarSign, Pencil, Trash2,
  Clock, X, ClipboardList, User, NotebookPen,
} from "lucide-react";
import { SALES_STAGES, SalesLead } from "@/hooks/useSalesLeads";
import { useRingCentralWidget } from "@/hooks/useRingCentralWidget";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { SalesLeadChatter } from "./SalesLeadChatter";
import { LiveNoteTaker } from "./LiveNoteTaker";
import { ScheduledActivities } from "@/components/pipeline/ScheduledActivities";
import { AssigneeManager } from "@/components/pipeline/AssigneeManager";
import type { Profile } from "@/hooks/useProfiles";

interface Props {
  lead: SalesLead | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (data: Partial<SalesLead> & { id: string }) => void;
  onDelete: (id: string) => void;
  assignees?: { profile_id: string; full_name: string }[];
  profiles?: Profile[];
  onAddAssignee?: (profileId: string) => void;
  onRemoveAssignee?: (profileId: string) => void;
  isExternalEstimator?: boolean;
}

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const priorityConfig: Record<string, { label: string; class: string }> = {
  high: { label: "High", class: "bg-destructive/10 text-destructive border-destructive/20" },
  urgent: { label: "Urgent", class: "bg-destructive/10 text-destructive border-destructive/20" },
  medium: { label: "Medium", class: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
  low: { label: "Low", class: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" },
};

export default function SalesLeadDrawer({ lead, open, onClose, onUpdate, onDelete, assignees = [], profiles = [], onAddAssignee, onRemoveAssignee, isExternalEstimator }: Props) {
  const { makeCall, showWidget } = useRingCentralWidget();
  const [activeTab, setActiveTab] = useState<"timeline" | "details">("timeline");
  const [notes, setNotes] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [noteTakerOpen, setNoteTakerOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");

  useEffect(() => {
    if (lead) {
      setNotes(lead.notes || "");
      setLostReason((lead as any).lost_reason || "");
    }
  }, [lead]);

  if (!lead) return null;

  const currentStageIndex = SALES_STAGES.findIndex((s) => s.id === lead.stage);
  const priority = priorityConfig[lead.priority || "medium"] || priorityConfig.medium;
  const age = formatDistanceToNow(new Date(lead.created_at), { addSuffix: false });

  return (
    <>
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-[45vw] overflow-y-auto p-0 rounded-none">
        {/* ── Header ── */}
        <div className="px-4 pt-4 pb-3 border-b border-border bg-background">
          <div className="flex items-start justify-between gap-3">
            <SheetHeader className="text-left flex-1 min-w-0">
              <SheetTitle className="text-lg font-bold leading-tight text-foreground">
                {lead.title}
              </SheetTitle>
            </SheetHeader>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onClose()}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            <Badge variant="outline" className={cn("text-[11px] rounded-sm px-1.5 py-0", priority.class)}>
              {priority.label}
            </Badge>
            <Badge variant="secondary" className="text-[11px] rounded-sm px-1.5 py-0 gap-1">
              <Clock className="w-3 h-3" />
              {age} old
            </Badge>
            {!isExternalEstimator && (
              <Select value={lead.priority || "medium"} onValueChange={(v) => onUpdate({ id: lead.id, priority: v })}>
                <SelectTrigger className="h-5 w-auto text-[10px] border-none bg-transparent px-1 gap-0.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize text-xs">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ── Stage Ribbon — Odoo breadcrumb style ── */}
          {!isExternalEstimator && (
            <div className="flex gap-0 overflow-x-auto mt-3 -mx-1 px-1">
              {SALES_STAGES.map((stage, i) => (
                <button
                  key={stage.id}
                  onClick={() => onUpdate({ id: lead.id, stage: stage.id })}
                  className={cn(
                    "shrink-0 px-2.5 py-1 text-[11px] font-medium border-y border-r first:border-l first:rounded-l-sm last:rounded-r-sm transition-colors",
                    i === currentStageIndex
                      ? "bg-primary text-primary-foreground border-primary"
                      : i < currentStageIndex
                      ? "bg-primary/15 text-primary border-primary/20 hover:bg-primary/25"
                      : "bg-muted text-muted-foreground border-border hover:bg-accent"
                  )}
                >
                  {stage.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Info Grid — Odoo form layout ── */}
        <div className="px-4 py-3 border-b border-border bg-background">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
            {lead.contact_name && (
              <div>
                <span className="text-[11px] text-muted-foreground font-medium">Contact</span>
                <p className="font-medium truncate">{lead.contact_name}</p>
              </div>
            )}
            {lead.contact_company && (
              <div>
                <span className="text-[11px] text-muted-foreground font-medium">Company</span>
                <p className="font-medium truncate">{lead.contact_company}</p>
              </div>
            )}
            {!isExternalEstimator && lead.contact_email && (
              <div>
                <span className="text-[11px] text-muted-foreground font-medium">Email</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm truncate flex-1">{lead.contact_email}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={() => setComposeOpen(true)}
                  >
                    <Mail className="h-3.5 w-3.5 text-primary" />
                  </Button>
                </div>
              </div>
            )}
            {!isExternalEstimator && lead.contact_phone && (
              <div>
                <span className="text-[11px] text-muted-foreground font-medium">Phone</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm truncate flex-1">{lead.contact_phone}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    onClick={() => { makeCall(lead.contact_phone!); showWidget(); }}
                  >
                    <Phone className="h-3.5 w-3.5 text-green-600" />
                  </Button>
                </div>
              </div>
            )}
            {(lead.expected_value ?? 0) > 0 && (
              <div>
                <span className="text-[11px] text-muted-foreground font-medium">Expected Value</span>
                <p className="font-medium">${(lead.expected_value ?? 0).toLocaleString()}</p>
              </div>
            )}
            {lead.source && (
              <div>
                <span className="text-[11px] text-muted-foreground font-medium">Source</span>
                <p className="font-medium capitalize">{lead.source}</p>
              </div>
            )}
            {/* Live Note-Taker toggle */}
            {!isExternalEstimator && (
              <div className="col-span-2">
                <Button
                  size="sm"
                  variant={noteTakerOpen ? "secondary" : "outline"}
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setNoteTakerOpen((v) => !v)}
                >
                  <NotebookPen className="w-3.5 h-3.5" />
                  Live Notes
                </Button>
              </div>
            )}
          </div>

          {/* Live Note-Taker panel */}
          {noteTakerOpen && lead.company_id && (
            <div className="mt-2">
              <LiveNoteTaker salesLeadId={lead.id} companyId={lead.company_id} />
            </div>
          )}

          {/* Assignees */}
          {!isExternalEstimator && (
            <div className="col-span-2 mt-1 pt-2 border-t border-border/50">
              <span className="text-[11px] text-muted-foreground font-medium mb-1 block">Assignees</span>
              <AssigneeManager
                assignees={assignees}
                profiles={profiles}
                onAdd={onAddAssignee || (() => {})}
                onRemove={onRemoveAssignee || (() => {})}
              />
            </div>
          )}
        </div>

        {/* ── Tab Bar ── */}
        <div className="border-b border-border bg-background">
          <div className="flex">
            {(["timeline", "details"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2 text-[13px] font-medium transition-colors relative capitalize",
                  activeTab === tab
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === "timeline" ? "Timeline" : "Details"}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab Content ── */}
        <div className="bg-background min-h-[200px]">
          {activeTab === "timeline" && (
            <SalesLeadChatter
              salesLeadId={lead.id}
              companyId={lead.company_id}
              isExternalEstimator={isExternalEstimator}
              assignees={assignees}
            />
          )}

          {activeTab === "details" && (
            <div className="p-4 space-y-3">
              {/* Editable fields */}
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

              {/* Notes */}
              <div className="border border-border rounded-sm p-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Internal Notes</h4>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={() => {
                    if (notes !== (lead.notes || "")) onUpdate({ id: lead.id, notes: notes || null });
                  }}
                  rows={3}
                  className="text-sm"
                />
              </div>

              {/* Lost reason */}
              {lead.stage === "lost" && (
                <div className="border border-border rounded-sm p-3">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Lost Reason</h4>
                  <Input
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    onBlur={() => onUpdate({ id: lead.id, lost_reason: lostReason || null } as any)}
                    placeholder="Why was this deal lost?"
                    className="h-9"
                  />
                </div>
              )}

              {/* Activities */}
              <div className="border border-border rounded-sm p-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Scheduled Activities</h4>
                <ScheduledActivities entityType="sales_lead" entityId={lead.id} assignees={assignees} />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-border p-3 text-[11px] text-muted-foreground flex items-center justify-between bg-muted/30">
          <span>Created {format(new Date(lead.created_at), "MMM d, yyyy")}</span>
          {!isExternalEstimator && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 h-6 text-[11px] rounded-sm"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. The lead "{lead.title}" will be permanently removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => { onDelete(lead.id); onClose(); }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <span>Updated {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}</span>
        </div>
      </SheetContent>
    </Sheet>

    <ComposeEmailDialog
      open={composeOpen}
      onOpenChange={setComposeOpen}
      initialTo={lead.contact_email || ""}
      initialSubject={`Regarding: ${lead.title}`}
    />
    </>
  );
}
