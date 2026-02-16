import React from "react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { Venture } from "@/types/venture";

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400",
  paused: "bg-amber-500/20 text-amber-400",
  killed: "bg-red-500/20 text-red-400",
  won: "bg-blue-500/20 text-blue-400",
};

interface Props {
  venture: Venture;
  onClick: () => void;
}

export const VentureCard: React.FC<Props> = ({ venture, onClick }) => (
  <div
    draggable
    onDragStart={(e) => e.dataTransfer.setData("ventureId", venture.id)}
    onClick={onClick}
    className="rounded-lg border border-border bg-card p-3 cursor-pointer hover:border-primary/50 transition-colors"
  >
    <div className="flex items-start justify-between gap-2 mb-1">
      <h4 className="text-sm font-semibold text-foreground leading-tight truncate">{venture.name}</h4>
      <Badge variant="outline" className={`text-[10px] shrink-0 ${statusColors[venture.status] ?? ""}`}>
        {venture.status}
      </Badge>
    </div>
    {venture.vertical && (
      <p className="text-xs text-muted-foreground mb-2">{venture.vertical}</p>
    )}
    <p className="text-[11px] text-muted-foreground">
      {formatDistanceToNow(new Date(venture.created_at), { addSuffix: true })}
    </p>
  </div>
);
