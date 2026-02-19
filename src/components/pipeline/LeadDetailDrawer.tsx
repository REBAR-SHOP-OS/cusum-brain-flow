import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScheduledActivities } from "./ScheduledActivities";
import { LeadActivityTimeline } from "./LeadActivityTimeline";
import { AddCommunicationDialog } from "./AddCommunicationDialog";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Building, Mail, Phone, Calendar, DollarSign, Pencil, Trash2,
  TrendingUp, Clock, User, Star, Archive, X, FileText, ClipboardList, Brain, Target, ShieldCheck,
  Sparkles, Loader2, Plus, MessageSquare,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES } from "@/pages/Pipeline";
import { useUserRole } from "@/hooks/useUserRole";
import { OdooChatter } from "./OdooChatter";
import { useLeadRecommendation, getActionIcon, getUrgencyConfig } from "@/hooks/useLeadRecommendation";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface LeadDetailDrawerProps {
  lead: LeadWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onStageChange: (leadId: string, newStage: string) => void;
}

const priorityConfig: Record<string, { label: string; class: string }> = {
  high: { label: "High", class: "bg-destructive/10 text-destructive border-destructive/20" },
  medium: { label: "Medium", class: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" },
  low: { label: "Low", class: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function AddCommButton({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="h-6 text-[11px] gap-1" onClick={() => setOpen(true)}>
        <Plus className="w-3 h-3" /> Log
      </Button>
      <AddCommunicationDialog open={open} onOpenChange={setOpen} leadId={leadId} />
    </>
  );
}

export function LeadDetailDrawer({
  lead,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onStageChange,
}: LeadDetailDrawerProps) {
  const { isAdmin } = useUserRole();
  const [activeTab, setActiveTab] = useState<"notes" | "chatter" | "activities" | "timeline">("chatter");
  const { data: recommendation, isLoading: recLoading } = useLeadRecommendation(lead, open);

  if (!lead) return null;

  const meta = (lead.metadata ?? {}) as Record<string, unknown>;
  const currentStageIndex = PIPELINE_STAGES.findIndex((s) => s.id === lead.stage);
  const priority = priorityConfig[lead.priority || "medium"] || priorityConfig.medium;
  const age = formatDistanceToNow(new Date(lead.created_at), { addSuffix: false });

  // Odoo metadata
  const odooEmail = (meta.odoo_email as string) || null;
  const odooPhone = (meta.odoo_phone as string) || null;
  const odooContact = (meta.odoo_contact as string) || null;
  const salesperson = (meta.odoo_salesperson as string) || null;
  const probability = (meta.odoo_probability as number) ?? lead.probability ?? 0;
  const revenue = (meta.odoo_revenue as number) ?? lead.expected_value ?? 0;
  const winProb = lead.win_prob_score as number | null;
  const priorityScore = lead.priority_score as number | null;
  const scoreConfidence = lead.score_confidence as string | null;
  const hasScoring = winProb != null && winProb > 0;

  const contactName = odooContact || lead.customers?.name || null;
  const companyName = lead.customers?.company_name || null;

  const handleArchive = () => {
    onStageChange(lead.id, "lost");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[45vw] overflow-y-auto p-0 rounded-none">
        {/* Header — Odoo style */}
        <div className="px-4 pt-4 pb-3 border-b border-border bg-background">
          <div className="flex items-start justify-between gap-3">
            <SheetHeader className="text-left flex-1 min-w-0">
              <SheetTitle className="text-lg font-bold leading-tight text-foreground">
                {lead.title}
              </SheetTitle>
            </SheetHeader>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { onOpenChange(false); onEdit(lead); }}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onOpenChange(false)}>
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
          </div>

          {/* Stage Ribbon — Odoo breadcrumb style */}
          <div className="flex gap-0 overflow-x-auto mt-3 -mx-1 px-1">
            {PIPELINE_STAGES.map((stage, i) => (
              <button
                key={stage.id}
                onClick={() => onStageChange(lead.id, stage.id)}
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
        </div>

        {/* Info Section — Odoo form layout: label-above-value grid */}
        <div className="px-4 py-3 border-b border-border bg-background">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
            {/* Customer */}
            {(contactName || companyName) && (
              <div>
                <span className="text-[11px] text-muted-foreground font-medium">Customer</span>
                <p className="font-medium truncate">{companyName || contactName}</p>
                {companyName && contactName && companyName !== contactName && (
                  <p className="text-xs text-muted-foreground truncate">{contactName}</p>
                )}
              </div>
            )}

            {/* Salesperson */}
            {salesperson && (
              <div className="flex items-start gap-2">
                <div>
                  <span className="text-[11px] text-muted-foreground font-medium">Salesperson</span>
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5 text-[9px]">
                      <AvatarFallback className="bg-primary/10 text-primary text-[9px]">
                        {getInitials(salesperson)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="font-medium truncate">{salesperson}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Email */}
            {odooEmail && (
              <div>
                <span className="text-[11px] text-muted-foreground font-medium">Email</span>
                <a href={`mailto:${odooEmail}`} className="text-primary hover:underline truncate block">{odooEmail}</a>
              </div>
            )}

            {/* Phone */}
            {odooPhone && (
              <div>
                <span className="text-[11px] text-muted-foreground font-medium">Phone</span>
                <a href={`tel:${odooPhone}`} className="text-primary hover:underline block">{odooPhone}</a>
              </div>
            )}

            {/* Revenue */}
            {revenue > 0 && (
              <div>
                <span className="text-[11px] text-muted-foreground font-medium">Expected Revenue</span>
                <p className="font-medium">${revenue.toLocaleString()}</p>
              </div>
            )}

            {/* Probability */}
            {probability > 0 && (
              <div>
                <span className="text-[11px] text-muted-foreground font-medium">Probability</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{probability}%</span>
                  <Progress value={probability} className="h-1.5 flex-1 max-w-[80px]" />
                </div>
              </div>
            )}

            {/* Expected Closing */}
            {lead.expected_close_date && (
              <div>
                <span className="text-[11px] text-muted-foreground font-medium">Expected Closing</span>
                <p className="font-medium">{format(new Date(lead.expected_close_date), "MMM d, yyyy")}</p>
              </div>
            )}
          </div>
          </div>

          {/* AI Scoring Section */}
          {hasScoring && (
            <div className="col-span-2 mt-1 pt-2 border-t border-border/50">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mb-1.5">
                <Brain className="w-3 h-3" /> Memory Intelligence
              </span>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-sm px-2 py-1.5 text-center">
                  <p className={cn(
                    "text-sm font-bold",
                    winProb! >= 60 ? "text-emerald-600 dark:text-emerald-400"
                      : winProb! >= 35 ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  )}>
                    {Math.round(winProb!)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Win Prob</p>
                </div>
                <div className="bg-muted/50 rounded-sm px-2 py-1.5 text-center">
                  <p className="text-sm font-bold text-foreground">{Math.round(priorityScore ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground">Priority</p>
                </div>
                <div className="bg-muted/50 rounded-sm px-2 py-1.5 text-center">
                  <p className={cn(
                    "text-sm font-bold capitalize",
                    scoreConfidence === "high" ? "text-emerald-600 dark:text-emerald-400"
                      : scoreConfidence === "medium" ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  )}>
                    {scoreConfidence || "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Confidence</p>
                </div>
              </div>
            </div>
          )}

          {/* AI Next Best Action */}
          {(recommendation || recLoading) && (
            <div className="col-span-2 mt-1 pt-2 border-t border-border/50">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3 h-3" /> Next Best Action
              </span>
              {recLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Analyzing lead...
                </div>
              ) : recommendation ? (
                <div className="bg-muted/50 rounded-sm px-3 py-2">
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5">{getActionIcon(recommendation.action_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold leading-tight">{recommendation.headline}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{recommendation.reasoning}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn("text-[10px] font-semibold", getUrgencyConfig(recommendation.urgency).class)}>
                          {getUrgencyConfig(recommendation.urgency).label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {recommendation.confidence}% confidence
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}


        <div className="border-b border-border bg-background">
          <div className="flex">
          {(["notes", "chatter", "activities", "timeline"] as const).map((tab) => (
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
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-background min-h-[200px]">
          {activeTab === "notes" && (
            <div className="p-4 space-y-3">
              {lead.description && (
                <div className="border border-border rounded-sm p-3">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Description</h4>
                  <p className="text-[13px] whitespace-pre-wrap">{lead.description}</p>
                </div>
              )}
              {lead.notes && (
                <div className="border border-border rounded-sm p-3">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Internal Notes</h4>
                  <p className="text-[13px] whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
              {!lead.description && !lead.notes && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <ClipboardList className="w-16 h-16 text-muted-foreground/20 mb-3" />
                  <p className="text-[13px] text-muted-foreground">No notes yet.</p>
                  <p className="text-[13px] text-muted-foreground">Add a description or internal note using the edit button above.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "chatter" && (
            <OdooChatter lead={lead} />
          )}

          {activeTab === "activities" && (
            <div className="p-4">
              <ScheduledActivities entityType="lead" entityId={lead.id} />
            </div>
          )}

          {activeTab === "timeline" && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Communication Timeline
                </h4>
                <AddCommButton leadId={lead.id} />
              </div>
              <LeadActivityTimeline leadId={lead.id} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-3 text-[11px] text-muted-foreground flex items-center justify-between bg-muted/30">
          <span>Created {format(new Date(lead.created_at), "MMM d, yyyy")}</span>
          {isAdmin ? (
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
                    onClick={() => {
                      onDelete(lead.id);
                      onOpenChange(false);
                    }}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 h-6 text-[11px] rounded-sm"
              onClick={handleArchive}
            >
              <Archive className="w-3 h-3" />
              Archive
            </Button>
          )}
          <span>Updated {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
