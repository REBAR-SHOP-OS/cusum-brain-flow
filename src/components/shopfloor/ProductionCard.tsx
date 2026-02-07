import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clipboard } from "lucide-react";
import { AsaShapeDiagram } from "./AsaShapeDiagram";
import type { StationItem } from "@/hooks/useStationData";

interface ProductionCardProps {
  item: StationItem;
  canWrite: boolean;
  onClick?: () => void;
}

export function ProductionCard({ item, canWrite, onClick }: ProductionCardProps) {
  const isBend = item.bend_type === "bend";
  const progress = item.total_pieces > 0
    ? Math.round((item.completed_pieces / item.total_pieces) * 100)
    : 0;

  return (
    <Card
      className="relative cursor-pointer hover:border-primary/40 transition-all overflow-hidden group"
      onClick={onClick}
    >
      {/* Color accent bar at bottom */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-1 ${
          isBend ? "bg-warning" : "bg-primary"
        }`}
      />

      <CardContent className="p-4 space-y-3">
        {/* Top row: mark + badge */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-mono tracking-wide">
              MARK / DWG
            </p>
            <p className="font-semibold text-sm">
              {item.mark_number || "—"}
              {item.drawing_ref && (
                <span className="text-muted-foreground font-normal ml-1">
                  | {item.drawing_ref}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Badge
              className={`text-[10px] ${
                isBend
                  ? "bg-warning/20 text-warning border-warning/30"
                  : "bg-primary/20 text-primary border-primary/30"
              }`}
            >
              {isBend ? "BEND REQ" : "STRAIGHT"}
            </Badge>
            {canWrite && (
              <Clipboard className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </div>

        {/* Center: shape or length */}
        <div className="flex items-center justify-center min-h-[80px]">
          {isBend && item.asa_shape_code ? (
            <AsaShapeDiagram
              shapeCode={item.asa_shape_code}
              dimensions={item.bend_dimensions}
              size="sm"
            />
          ) : (
            <div className="text-center">
              <p className="text-3xl font-bold font-mono text-foreground">
                {item.cut_length_mm}
              </p>
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
                MM CUT LENGTH
              </p>
            </div>
          )}
        </div>

        {/* Bottom: progress */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              PROG: {progress}%
            </span>
            <span className="text-muted-foreground font-mono">
              {item.completed_pieces} / {item.total_pieces} PCS
            </span>
          </div>
          <Progress
            value={progress}
            className={`h-1.5 ${isBend ? "[&>div]:bg-warning" : ""}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
