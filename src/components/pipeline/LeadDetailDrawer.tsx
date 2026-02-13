import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Building, Mail, Phone, Calendar, DollarSign, Pencil, Trash2,
  TrendingUp, Clock, User, FileText, Star, ArrowRight,
  Paperclip, Download, Link2, File, Sparkles,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES } from "@/pages/Pipeline";
import { useUserRole } from "@/hooks/useUserRole";
import { LeadTimeline } from "./LeadTimeline";
import { LeadEmailThread } from "./LeadEmailThread";
import { LeadFiles } from "./LeadFiles";
import { LeadAIPanel } from "./LeadAIPanel";
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

export function LeadDetailDrawer({
  lead,
  open,
  onOpenChange,
  onEdit,
  onDelete,
  onStageChange,
}: LeadDetailDrawerProps) {
  const { isAdmin } = useUserRole();

  if (!lead) return null;

  const meta = (lead.metadata ?? {}) as Record<string, unknown>;
  const currentStageIndex = PIPELINE_STAGES.findIndex((s) => s.id === lead.stage);
  const currentStage = PIPELINE_STAGES[currentStageIndex];
  const priority = priorityConfig[lead.priority || "medium"] || priorityConfig.medium;
  const age = formatDistanceToNow(new Date(lead.created_at), { addSuffix: false });

  // Odoo metadata
  const odooEmail = (meta.odoo_email as string) || null;
  const odooPhone = (meta.odoo_phone as string) || null;
  const odooContact = (meta.odoo_contact as string) || null;
  const salesperson = (meta.odoo_salesperson as string) || null;
  const probability = (meta.odoo_probability as number) ?? lead.probability ?? 0;
  const revenue = (meta.odoo_revenue as number) ?? lead.expected_value ?? 0;

  const contactName = odooContact || lead.customers?.name || null;
  const companyName = lead.customers?.company_name || null;

  // Legacy notes parsing
  const parseField = (notes: string | null, key: string) => {
    if (!notes) return null;
    const match = notes.match(new RegExp(`${key}:\\s*([^|]+)`));
    return match ? match[1].trim() : null;
  };
  const assigned = parseField(lead.notes, "Assigned");
  const city = parseField(lead.notes, "City");
  const quoteRef = parseField(lead.notes, "Quote");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border">
          <SheetHeader className="text-left mb-3">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-lg font-bold leading-tight pr-4">
                {lead.title}
              </SheetTitle>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { onOpenChange(false); onEdit(lead); }}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          </SheetHeader>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <Badge variant="outline" className={priority.class}>
              {priority.label}
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Clock className="w-3 h-3" />
              {age} old
            </Badge>
          </div>

          {/* Stage Navigation Chips */}
          <div className="flex gap-1 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
            {PIPELINE_STAGES.map((stage, i) => (
              <button
                key={stage.id}
                onClick={() => onStageChange(lead.id, stage.id)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  i === currentStageIndex
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : i < currentStageIndex
                    ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                    : "bg-muted text-muted-foreground border-border hover:bg-accent"
                )}
              >
                {stage.label}
              </button>
            ))}
          </div>

          {/* Key Info Section */}
          <div className="space-y-2.5">
            {/* Contact & Company */}
            {(contactName || companyName) && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{companyName || contactName}</p>
                  {companyName && contactName && companyName !== contactName && (
                    <p className="text-xs text-muted-foreground truncate">{contactName}</p>
                  )}
                </div>
              </div>
            )}

            {/* Contact details row */}
            <div className="flex items-center gap-3 flex-wrap text-xs">
              {odooEmail && (
                <a href={`mailto:${odooEmail}`} className="flex items-center gap-1 text-primary hover:underline truncate max-w-[200px]">
                  <Mail className="w-3 h-3 shrink-0" />
                  {odooEmail}
                </a>
              )}
              {odooPhone && (
                <a href={`tel:${odooPhone}`} className="flex items-center gap-1 text-primary hover:underline">
                  <Phone className="w-3 h-3 shrink-0" />
                  {odooPhone}
                </a>
              )}
            </div>

            {/* Salesperson, Revenue, Probability, Close Date */}
            <div className="grid grid-cols-2 gap-2">
              {salesperson && (
                <div className="flex items-center gap-2 rounded-md border border-border p-2">
                  <Avatar className="h-6 w-6 text-[10px]">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                      {getInitials(salesperson)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground leading-none">Salesperson</p>
                    <p className="text-xs font-medium truncate">{salesperson}</p>
                  </div>
                </div>
              )}
              {revenue > 0 && (
                <div className="flex items-center gap-2 rounded-md border border-border p-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground leading-none">Revenue</p>
                    <p className="text-xs font-medium">${revenue.toLocaleString()}</p>
                  </div>
                </div>
              )}
              {probability > 0 && (
                <div className="flex items-center gap-2 rounded-md border border-border p-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground leading-none">Probability</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{probability}%</span>
                      <Progress value={probability} className="h-1.5 flex-1" />
                    </div>
                  </div>
                </div>
              )}
              {lead.expected_close_date && (
                <div className="flex items-center gap-2 rounded-md border border-border p-2">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground leading-none">Close Date</p>
                    <p className="text-xs font-medium">{format(new Date(lead.expected_close_date), "MMM d, yyyy")}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="w-full grid grid-cols-7 mb-4">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="financials">$</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="ai" className="gap-1"><Sparkles className="w-3 h-3" />AI</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="space-y-4 mt-0">
              <LeadEmailThread metadata={lead.metadata} notes={lead.notes} source={lead.source} leadId={lead.id} customerId={lead.customer_id} leadTitle={lead.title} />
            </TabsContent>

            <TabsContent value="timeline" className="mt-0">
              <LeadTimeline lead={lead} />
            </TabsContent>

            <TabsContent value="details" className="space-y-5 mt-0">
              {/* Secondary details grid */}
              <div className="grid grid-cols-2 gap-3">
                {assigned && <DetailItem icon={User} label="Assigned To" value={assigned} />}
                {city && <DetailItem icon={Building} label="City" value={city} />}
                {quoteRef && <DetailItem icon={FileText} label="Quote Ref" value={quoteRef} />}
                {lead.source && <DetailItem icon={Star} label="Source" value={lead.source} />}
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
              <LeadFiles metadata={lead.metadata} leadId={lead.id} />
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

            <TabsContent value="ai" className="mt-0">
              <LeadAIPanel lead={lead} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 text-xs text-muted-foreground flex items-center justify-between">
          <span>Created {format(new Date(lead.created_at), "MMM d, yyyy")}</span>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 h-7 text-xs"
              onClick={() => {
                if (confirm("Delete this lead?")) {
                  onDelete(lead.id);
                  onOpenChange(false);
                }
              }}
            >
              <Trash2 className="w-3 h-3" />
              Delete Lead
            </Button>
          )}
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
