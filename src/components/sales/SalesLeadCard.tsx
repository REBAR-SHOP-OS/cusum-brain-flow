import { SalesLead, SALES_STAGES } from "@/hooks/useSalesLeads";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { differenceInDays } from "date-fns";
import { Star } from "lucide-react";

interface Props {
  lead: SalesLead;
  isDragging?: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const PRIORITY_STARS: Record<string, number> = { low: 0, medium: 1, high: 2, urgent: 3 };

export default function SalesLeadCard({ lead, isDragging, onClick, onDragStart, onDragEnd }: Props) {
  const daysInStage = differenceInDays(new Date(), new Date(lead.updated_at));
  const staleLevel = daysInStage >= 30 ? "stale-30" : daysInStage >= 14 ? "stale-14" : daysInStage >= 7 ? "stale-7" : "fresh";
  const stars = PRIORITY_STARS[lead.priority || "medium"] || 0;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-md p-2.5 cursor-pointer hover:shadow-sm transition-all group",
        isDragging && "opacity-40 scale-95",
        staleLevel === "stale-30" && "border-l-2 border-l-destructive",
        staleLevel === "stale-14" && "border-l-2 border-l-yellow-500",
        staleLevel === "stale-7" && "border-l-2 border-l-orange-400",
      )}
    >
      {/* Title + priority */}
      <div className="flex items-start justify-between gap-1">
        <p className="text-sm font-medium text-foreground truncate flex-1">{lead.title}</p>
        {stars > 0 && (
          <div className="flex shrink-0">
            {Array.from({ length: stars }).map((_, i) => (
              <Star key={i} className="w-2.5 h-2.5 fill-primary text-primary" />
            ))}
          </div>
        )}
      </div>

      {/* Company / contact */}
      {lead.contact_company && <p className="text-xs text-muted-foreground truncate">{lead.contact_company}</p>}
      {lead.contact_name && <p className="text-[11px] text-muted-foreground/70 truncate">{lead.contact_name}</p>}

      {/* Bottom row: value + source + days */}
      <div className="flex items-center justify-between mt-1.5 gap-1">
        <div className="flex items-center gap-1.5">
          {lead.expected_value ? (
            <span className="text-xs font-semibold text-primary">$ {Number(lead.expected_value).toLocaleString()}</span>
          ) : <span />}
          {lead.source && <Badge variant="outline" className="text-[9px] h-3.5 px-1">{lead.source}</Badge>}
        </div>
        <span className={cn(
          "text-[9px] font-medium",
          staleLevel === "fresh" ? "text-muted-foreground/50" : staleLevel === "stale-7" ? "text-orange-500" : staleLevel === "stale-14" ? "text-yellow-500" : "text-destructive"
        )}>
          {daysInStage}d
        </span>
      </div>
    </div>
  );
}
