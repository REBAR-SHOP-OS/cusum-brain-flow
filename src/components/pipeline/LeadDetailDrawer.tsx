import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building, Mail, Phone, Calendar, DollarSign, Pencil, Trash2,
  TrendingUp, Clock, User, FileText, Star, ArrowRight,
  Paperclip, Download, Link2, File,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES } from "@/pages/Pipeline";
import { LeadTimeline } from "./LeadTimeline";
import { LeadEmailContent } from "./LeadEmailContent";
import { LeadFiles } from "./LeadFiles";
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

export function LeadDetailDrawer({
  lead,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onStageChange,
}: LeadDetailDrawerProps) {
  if (!lead) return null;

  const currentStageIndex = PIPELINE_STAGES.findIndex((s) => s.id === lead.stage);
  const currentStage = PIPELINE_STAGES[currentStageIndex];
  const nextStage = PIPELINE_STAGES[currentStageIndex + 1];
  const priority = priorityConfig[lead.priority || "medium"] || priorityConfig.medium;
  const age = formatDistanceToNow(new Date(lead.created_at), { addSuffix: false });

  const parseAssignedFrom = (notes: string | null) => {
    if (!notes) return null;
    const match = notes.match(/Assigned:\s*([^|]+)/);
    return match ? match[1].trim() : null;
  };

  const parseCityFrom = (notes: string | null) => {
    if (!notes) return null;
    const match = notes.match(/City:\s*([^|]+)/);
    return match ? match[1].trim() : null;
  };

  const parseQuoteFrom = (notes: string | null) => {
    if (!notes) return null;
    const match = notes.match(/Quote:\s*(\S+)/);
    return match ? match[1].trim() : null;
  };

  const assigned = parseAssignedFrom(lead.notes);
  const city = parseCityFrom(lead.notes);
  const quoteRef = parseQuoteFrom(lead.notes);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border">
          <SheetHeader className="text-left mb-4">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-lg font-bold leading-tight pr-4">
                {lead.title}
              </SheetTitle>
            </div>
          </SheetHeader>

          <div className="flex items-center gap-2 flex-wrap">
            {currentStage && (
              <Badge variant="outline" className="gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", currentStage.color)} />
                {currentStage.label}
              </Badge>
            )}
            <Badge variant="outline" className={priority.class}>
              {priority.label}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Clock className="w-3 h-3" />
              {age} old
            </Badge>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 mt-4">
            {nextStage && (
              <Button
                size="sm"
                onClick={() => onStageChange(lead.id, nextStage.id)}
                className="gap-1.5"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Move to {nextStage.label}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); onEdit(lead); }} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm("Delete this lead?")) {
                  onDelete(lead.id);
                  onOpenChange(false);
                }
              }}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="w-full grid grid-cols-6 mb-4">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="financials">$</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-4 mt-0">
              <LeadEmailContent metadata={lead.metadata} notes={lead.notes} source={lead.source} />
            </TabsContent>

            <TabsContent value="timeline" className="mt-0">
              <LeadTimeline lead={lead} />
            </TabsContent>

            <TabsContent value="details" className="space-y-5 mt-0">
              {/* Customer Info */}
              {lead.customers && (
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer</h4>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{lead.customers.company_name || lead.customers.name}</p>
                      {lead.customers.company_name && lead.customers.company_name !== lead.customers.name && (
                        <p className="text-xs text-muted-foreground">{lead.customers.name}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Key Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                {assigned && (
                  <DetailItem icon={User} label="Assigned To" value={assigned} />
                )}
                {city && (
                  <DetailItem icon={Building} label="City" value={city} />
                )}
                {quoteRef && (
                  <DetailItem icon={FileText} label="Quote Ref" value={quoteRef} />
                )}
                {lead.source && (
                  <DetailItem icon={Star} label="Source" value={lead.source} />
                )}
                {lead.expected_close_date && (
                  <DetailItem
                    icon={Calendar}
                    label="Expected Close"
                    value={format(new Date(lead.expected_close_date), "MMM d, yyyy")}
                  />
                )}
              </div>

              {/* Stage Progress */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pipeline Progress</h4>
                <div className="flex gap-1">
                  {PIPELINE_STAGES.map((stage, i) => (
                    <button
                      key={stage.id}
                      onClick={() => onStageChange(lead.id, stage.id)}
                      title={stage.label}
                      className={cn(
                        "h-2 flex-1 rounded-full transition-all cursor-pointer hover:opacity-80",
                        i <= currentStageIndex ? stage.color : "bg-muted"
                      )}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Stage {currentStageIndex + 1} of {PIPELINE_STAGES.length}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="files" className="space-y-4 mt-0">
              <LeadFiles metadata={lead.metadata} />
            </TabsContent>

            <TabsContent value="financials" className="space-y-4 mt-0">
              <div className="rounded-lg border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expected Value</span>
                  <span className="text-xl font-bold">
                    ${(lead.expected_value || 0).toLocaleString()}
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Probability</span>
                  <span className="text-xl font-bold">{lead.probability ?? 0}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${lead.probability ?? 0}%` }}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Weighted Value</span>
                  <span className="text-lg font-semibold text-primary">
                    ${Math.round((lead.expected_value || 0) * (lead.probability ?? 0) / 100).toLocaleString()}
                  </span>
                </div>
              </div>

              {lead.expected_close_date && (
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Close by</span>
                    <span className="font-medium">
                      {format(new Date(lead.expected_close_date), "MMMM d, yyyy")}
                    </span>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-0">
              {lead.description && (
                <div className="rounded-lg border border-border p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Description</h4>
                  <p className="text-sm whitespace-pre-wrap">{lead.description}</p>
                </div>
              )}
              {lead.notes && (
                <div className="rounded-lg border border-border p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Internal Notes</h4>
                  <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
                </div>
              )}
              {!lead.description && !lead.notes && (
                <p className="text-sm text-muted-foreground text-center py-8">No notes yet.</p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 text-xs text-muted-foreground flex items-center justify-between">
          <span>Created {format(new Date(lead.created_at), "MMM d, yyyy")}</span>
          <span>Updated {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3 h-3" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
  );
}
