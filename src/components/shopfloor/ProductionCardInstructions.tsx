import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { StationItem } from "@/hooks/useStationData";

interface ProductionCardInstructionsProps {
  item: StationItem;
}

export function ProductionCardInstructions({ item }: ProductionCardInstructionsProps) {
  const [open, setOpen] = useState(false);

  const hasNotes = !!item.notes;
  const hasDrawing = !!item.drawing_ref;
  const hasDimensions = item.bend_dimensions && Object.keys(item.bend_dimensions).length > 0;

  if (!hasNotes && !hasDrawing && !hasDimensions) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1.5 w-full text-left group">
        <FileText className="w-3 h-3 text-muted-foreground" />
        <span className="text-[9px] tracking-[0.15em] uppercase text-muted-foreground font-medium flex-1">
          Instructions
        </span>
        <ChevronDown
          className={`w-3 h-3 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 space-y-2">
        {hasNotes && (
          <p className="text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5 whitespace-pre-wrap">
            {item.notes}
          </p>
        )}
        {hasDrawing && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] tracking-[0.1em] uppercase text-muted-foreground">Drawing:</span>
            <span className="text-xs font-mono text-primary">{item.drawing_ref}</span>
          </div>
        )}
        {hasDimensions && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(item.bend_dimensions!).map(([key, val]) => (
              <span
                key={key}
                className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20"
              >
                {key.toUpperCase()}: {val}mm
              </span>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
