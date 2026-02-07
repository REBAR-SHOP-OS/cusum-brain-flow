import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, ArrowRight } from "lucide-react";
import { useShapeSchematics } from "@/hooks/useShapeSchematics";
import { AsaShapeDiagram } from "./AsaShapeDiagram";
import type { StationItem } from "@/hooks/useStationData";

interface ProductionCardProps {
  item: StationItem;
  canWrite: boolean;
  isSupervisor?: boolean;
  onClick?: () => void;
}

export function ProductionCard({ item, canWrite, isSupervisor = false, onClick }: ProductionCardProps) {
  const isBend = item.bend_type === "bend";
  const progress = item.total_pieces > 0
    ? Math.round((item.completed_pieces / item.total_pieces) * 100)
    : 0;

  const { getShapeImageUrl } = useShapeSchematics();
  const shapeImageUrl = item.asa_shape_code ? getShapeImageUrl(item.asa_shape_code) : null;

  return (
    <Card
      className="relative cursor-pointer hover:shadow-lg transition-all overflow-hidden group bg-card border border-border"
      onClick={onClick}
    >
      {/* Color accent bar at bottom — full width, thicker */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-2 ${
          isBend ? "bg-orange-500" : "bg-blue-500"
        }`}
      />

      <CardContent className="p-4 pb-5 space-y-3">
        {/* Top row: MARK/DWG label + supervisor actions */}
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <p className="text-[9px] text-muted-foreground font-medium tracking-[0.15em] uppercase">
              Mark / DWG
            </p>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-2xl font-black text-foreground tracking-tight">
                {item.mark_number || "—"}
              </span>
              {item.drawing_ref && (
                <span className="text-xs text-muted-foreground/70 font-mono">
                  | DWG# {item.drawing_ref}
                </span>
              )}
            </div>
          </div>

          {/* Supervisor action buttons — only visible in supervisor mode */}
          {isSupervisor && (
            <div className="flex items-center gap-1.5">
              <button 
                className="w-7 h-7 rounded-full border border-border bg-background flex items-center justify-center hover:bg-muted transition-colors"
                onClick={(e) => { e.stopPropagation(); }}
              >
                <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button 
                className="w-7 h-7 rounded-full border-2 border-orange-400 bg-orange-500/10 flex items-center justify-center hover:bg-orange-500/20 transition-colors"
                onClick={(e) => { e.stopPropagation(); }}
              >
                <ArrowRight className="w-3.5 h-3.5 text-orange-500" />
              </button>
            </div>
          )}
        </div>

        {/* Bend type badge */}
        <Badge
          variant="outline"
          className={`text-[9px] font-bold tracking-wider px-2 py-0.5 ${
            isBend
              ? "bg-orange-500/10 text-orange-600 border-orange-500/30"
              : "bg-blue-500/10 text-blue-600 border-blue-500/30"
          }`}
        >
          {isBend ? "BEND REQ" : "STRAIGHT"}
        </Badge>

        {/* Bar size */}
        <p className="text-sm font-bold text-foreground">{item.bar_code}</p>

        {/* Center: shape image or length display */}
        <div className="flex items-center justify-center min-h-[110px] bg-muted/20 rounded-lg border border-border/50">
          {isBend && item.asa_shape_code ? (
            shapeImageUrl ? (
              <img
                src={shapeImageUrl}
                alt={`Shape ${item.asa_shape_code}`}
                className="max-w-full max-h-[100px] object-contain"
                crossOrigin="anonymous"
              />
            ) : (
              <AsaShapeDiagram
                shapeCode={item.asa_shape_code}
                dimensions={item.bend_dimensions}
                size="sm"
              />
            )
          ) : (
            <div className="text-center py-4">
              <p className="text-5xl font-black font-mono text-muted-foreground/50 tracking-tight">
                {item.cut_length_mm}
              </p>
              <p className="text-[9px] text-muted-foreground tracking-[0.2em] uppercase mt-1">
                MM Length
              </p>
            </div>
          )}
        </div>

        {/* Bottom: progress label + count */}
        <div className="space-y-1 pt-1">
          <p className="text-[9px] text-muted-foreground tracking-[0.15em] uppercase">
            PROG: {progress}%
          </p>
          <p className="text-lg font-black text-foreground">
            {item.completed_pieces} / {item.total_pieces} PCS
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
