import { ArrowLeft, Shield, ShieldOff, Eye, ChevronDown, Building, Layers } from "lucide-react";
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
  /** Show "BEDS" suffix in title */
  showBedsSuffix?: boolean;
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
  showBedsSuffix = true,
}: StationHeaderProps) {
  const navigate = useNavigate();

  // Build title: "DTX400 10-15MM BEDS" or "BENDER B36 BEDS"
  const machineLabel = machineModel || machineName;
  const titleParts = [machineLabel.toUpperCase()];
  if (barSizeRange) titleParts.push(barSizeRange);
  if (showBedsSuffix) titleParts.push("BEDS");
  const mainTitle = titleParts.join(" ");

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
      {/* Left: Back + Title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(backTo)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <h1 className="font-bold text-base sm:text-lg uppercase tracking-wide text-foreground">
          {mainTitle}
        </h1>
      </div>

      {/* Center: Mark/Drawing info (detail views only) */}
      {(markNumber || drawingRef) && (
        <div className="hidden sm:flex items-center gap-2">
          {markNumber && (
            <>
              <span className="text-sm font-bold text-foreground">MARK {markNumber}</span>
              {drawingRef && <span className="text-muted-foreground">|</span>}
            </>
          )}
          {drawingRef && (
            <span className="text-sm text-primary font-mono">DWG# {drawingRef}</span>
          )}
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Pool back-link for bidirectional navigation */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs rounded-full border-border"
          onClick={() => navigate("/shopfloor/pool")}
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Pool</span>
        </Button>
        {remainingCount !== undefined && (
          <Badge variant="outline" className="font-mono text-xs hidden sm:flex">
            ⏱ {remainingCount} REMAINING
          </Badge>
        )}

        {/* Supervisor toggle — styled as badge toggle */}
        {canWrite && onToggleSupervisor ? (
          <Button
            variant={isSupervisor ? "destructive" : "outline"}
            size="sm"
            className={`gap-1.5 text-xs rounded-full ${
              isSupervisor 
                ? "bg-destructive hover:bg-destructive/90" 
                : "border-border"
            }`}
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

        {/* Workspace chip — dark pill with dropdown */}
        {workspaceName && (
          <Badge className="bg-foreground text-background font-bold text-xs gap-1.5 px-3 py-1.5 rounded-full cursor-pointer hover:bg-foreground/90 transition-colors">
            <Building className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{workspaceName}</span>
            <ChevronDown className="w-3 h-3" />
          </Badge>
        )}
      </div>
    </header>
  );
}
