import { ArrowLeft, Shield, ShieldOff, Eye } from "lucide-react";
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
  isSupervisor?: boolean;
  onToggleSupervisor?: () => void;
  backTo?: string;
  /** Job workspace name shown in top-right chip */
  workspaceName?: string | null;
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
  isSupervisor = false,
  onToggleSupervisor,
  backTo = "/shopfloor/station",
  workspaceName,
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
          <span className="font-bold text-sm uppercase tracking-wide">
            {machineModel || machineName}
          </span>
          {(markNumber || drawingRef || projectName) && (
            <span className="text-xs text-muted-foreground font-mono">
              {markNumber && `MARK ${markNumber}`}
              {markNumber && drawingRef && " | "}
              {drawingRef}
              {projectName && ` • ${projectName}`}
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

        {/* Supervisor toggle */}
        {canWrite && onToggleSupervisor ? (
          <Button
            variant={isSupervisor ? "destructive" : "outline"}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={onToggleSupervisor}
          >
            {isSupervisor ? (
              <>
                <ShieldOff className="w-3.5 h-3.5" />
                Exit Supervisor
              </>
            ) : (
              <>
                <Shield className="w-3.5 h-3.5" />
                Supervisor
              </>
            )}
          </Button>
        ) : canWrite ? (
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

        {/* Workspace chip */}
        {workspaceName && (
          <Badge className="bg-foreground text-background font-bold text-xs gap-1.5 px-3 py-1">
            <LayoutGridIcon className="w-3.5 h-3.5" />
            {workspaceName}
          </Badge>
        )}
      </div>
    </header>
  );
}

function LayoutGridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className}>
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}
