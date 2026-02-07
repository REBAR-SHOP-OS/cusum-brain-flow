import { ArrowLeft, Shield, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface StationHeaderProps {
  machineName: string;
  machineModel?: string | null;
  barSizeRange?: string;
  projectName?: string | null;
  markNumber?: string | null;
  drawingRef?: string | null;
  remainingCount?: number;
  canWrite: boolean;
  backTo?: string;
}

export function StationHeader({
  machineName,
  machineModel,
  barSizeRange,
  projectName,
  markNumber,
  drawingRef,
  remainingCount,
  canWrite,
  backTo = "/shopfloor/station",
}: StationHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(backTo)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>

        {barSizeRange && (
          <Badge className="bg-primary/20 text-primary border-primary/30 font-mono text-xs">
            {barSizeRange}
          </Badge>
        )}

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              {machineModel || machineName}
            </span>
            {projectName && (
              <span className="text-xs text-muted-foreground">• {projectName}</span>
            )}
          </div>
          {(markNumber || drawingRef) && (
            <span className="text-xs text-muted-foreground font-mono">
              {markNumber && `MARK ${markNumber}`}
              {markNumber && drawingRef && " | "}
              {drawingRef}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {remainingCount !== undefined && (
          <Badge variant="outline" className="font-mono text-xs">
            {remainingCount} REMAINING
          </Badge>
        )}

        {canWrite ? (
          <Badge className="bg-warning/20 text-warning border-warning/30 gap-1">
            <Shield className="w-3 h-3" />
            SUPERVISOR
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <Eye className="w-3 h-3" />
            VIEW ONLY
          </Badge>
        )}
      </div>
    </header>
  );
}
