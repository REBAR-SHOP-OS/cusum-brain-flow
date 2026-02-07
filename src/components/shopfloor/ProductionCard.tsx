import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
      className="relative cursor-pointer hover:shadow-lg transition-all overflow-hidden group bg-card"
      onClick={onClick}
    >
      {/* Color accent bar at bottom */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-1.5 rounded-b-lg ${
          isBend ? "bg-orange-500" : "bg-blue-500"
        }`}
      />

      <CardContent className="p-4 space-y-3">
        {/* Top row: mark/dwg + supervisor actions */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase">
              Mark / DWG
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-foreground">
                {item.mark_number || "—"}
              </span>
              {item.drawing_ref && (
                <span className="text-xs text-muted-foreground font-mono">
                  | DWG# {item.drawing_ref}
                </span>
              )}
            </div>
          </div>

          {/* Supervisor action buttons */}
          {isSupervisor && (
            <div className="flex items-center gap-1">
              <button className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-muted transition-colors">
                <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button className="w-7 h-7 rounded-full border border-orange-400 bg-orange-500/10 flex items-center justify-center hover:bg-orange-500/20 transition-colors">
                <ArrowRight className="w-3.5 h-3.5 text-orange-500" />
              </button>
            </div>
          )}
        </div>

        {/* Bend type badge */}
        <Badge
          className={`text-[9px] tracking-wider ${
            isBend
              ? "bg-orange-500/15 text-orange-500 border-orange-500/30"
              : "bg-blue-500/15 text-blue-500 border-blue-500/30"
          }`}
        >
          {isBend ? "BEND REQ" : "STRAIGHT"}
        </Badge>

        {/* Bar size */}
        <p className="text-sm font-bold text-foreground">{item.bar_code}</p>

        {/* Center: shape image or length */}
        <div className="flex items-center justify-center min-h-[100px] bg-muted/30 rounded-lg">
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
              <p className="text-4xl font-black font-mono text-muted-foreground/60">
                {item.cut_length_mm}
              </p>
              <p className="text-[9px] text-muted-foreground tracking-widest uppercase mt-1">
                MM Length
              </p>
            </div>
          )}
        </div>

        {/* Bottom: progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground tracking-wider uppercase">
              Order Target
            </span>
          </div>
          <p className="text-lg font-black text-foreground">
            {item.completed_pieces} / {item.total_pieces} PCS
          </p>
          <Progress
            value={progress}
            className={`h-1.5 ${isBend ? "[&>div]:bg-orange-500" : "[&>div]:bg-blue-500"}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
