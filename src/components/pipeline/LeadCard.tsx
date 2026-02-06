import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, DollarSign, Calendar, Building } from "lucide-react";
import { format } from "date-fns";
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
}

const priorityColors: Record<string, string> = {
  high: "border-l-red-500",
  medium: "border-l-yellow-500",
  low: "border-l-green-500",
};

export function LeadCard({ lead, onDragStart, onDragEnd, onEdit, onDelete }: LeadCardProps) {
  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      className={cn(
        "cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-4",
        priorityColors[lead.priority || "medium"] || "border-l-border"
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{lead.title}</p>
            {lead.customers && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Building className="w-3 h-3" />
                {lead.customers.company_name || lead.customers.name}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(lead)}>
                <Pencil className="w-3 h-3 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(lead.id)}
                className="text-destructive"
              >
                <Trash2 className="w-3 h-3 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {lead.expected_value && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {lead.expected_value.toLocaleString()}
            </span>
          )}
          {lead.expected_close_date && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(lead.expected_close_date), "MMM d")}
            </span>
          )}
        </div>

        {lead.probability !== null && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">Probability</span>
              <span>{lead.probability}%</span>
            </div>
            <div className="h-1 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${lead.probability}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
