import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, DollarSign, Calendar, Building, User, ArrowRight } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;
type LeadWithCustomer = Lead & { customers: { name: string; company_name: string | null } | null };

interface LeadCardProps {
  lead: LeadWithCustomer;
  onDragStart: (e: React.DragEvent, leadId: string) => void;
  onDragEnd: () => void;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onClick: (lead: LeadWithCustomer) => void;
}

const priorityColors: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-yellow-500",
  low: "border-l-green-500",
};

export function LeadCard({ lead, onDragStart, onDragEnd, onEdit, onDelete, onClick }: LeadCardProps) {
  const parseAssigned = (notes: string | null) => {
    if (!notes) return null;
    const match = notes.match(/Assigned:\s*([^|]+)/);
    return match ? match[1].trim() : null;
  };

  const assigned = parseAssigned(lead.notes);
  const age = formatDistanceToNow(new Date(lead.created_at), { addSuffix: false });

  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(lead)}
      className={cn(
        "cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/30 transition-all border-l-4 group",
        priorityColors[lead.priority || "medium"] || "border-l-border"
      )}
    >
      <CardContent className="p-3 space-y-2">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm leading-tight line-clamp-2">{lead.title}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(lead); }}>
                <Pencil className="w-3 h-3 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}
                className="text-destructive"
              >
                <Trash2 className="w-3 h-3 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Customer */}
        {lead.customers && (
          <div className="flex items-center gap-1.5">
            <Building className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground truncate">
              {lead.customers.company_name || lead.customers.name}
            </p>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          {lead.expected_value ? (
            <span className="flex items-center gap-0.5 font-medium text-foreground">
              <DollarSign className="w-3 h-3" />
              {lead.expected_value.toLocaleString()}
            </span>
          ) : null}
          {lead.expected_close_date && (
            <span className="flex items-center gap-0.5">
              <Calendar className="w-3 h-3" />
              {format(new Date(lead.expected_close_date), "MMM d")}
            </span>
          )}
          {assigned && (
            <span className="flex items-center gap-0.5">
              <User className="w-3 h-3" />
              {assigned.split(" ")[0]}
            </span>
          )}
        </div>

        {/* Probability bar */}
        {lead.probability !== null && lead.probability !== undefined && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{age}</span>
              <span className="font-medium">{lead.probability}%</span>
            </div>
            <div className="h-1 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  lead.probability >= 70 ? "bg-green-500" :
                  lead.probability >= 40 ? "bg-yellow-500" :
                  "bg-primary"
                )}
                style={{ width: `${lead.probability}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
