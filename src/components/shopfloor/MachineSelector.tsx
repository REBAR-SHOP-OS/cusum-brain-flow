import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Lock } from "lucide-react";
import type { LiveMachine } from "@/types/machine";
import { getMachineSpec } from "./machineRegistry";
import { MachineSpecsPanel } from "./MachineSpecsPanel";
import { useTabletPin } from "@/hooks/useTabletPin";
import { useToast } from "@/hooks/use-toast";

// Fallback SVG icons when no image is available
function CutterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 14L32 32M46 14L32 32" />
      <circle cx="14" cy="46" r="10" />
      <circle cx="50" cy="46" r="10" />
      <path d="M32 32L22 40" />
      <path d="M32 32L42 40" />
    </svg>
  );
}

function BenderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 20h16a12 12 0 0 1 12 12v0a12 12 0 0 0 12 12h0" />
      <circle cx="52" cy="44" r="6" />
      <circle cx="12" cy="20" r="6" />
    </svg>
  );
}

function CircularIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="32" cy="32" r="20" />
      <circle cx="32" cy="32" r="8" />
    </svg>
  );
}

function getFallbackIcon(type: string) {
  switch (type) {
    case "cutter": return CutterIcon;
    case "bender": return BenderIcon;
    default: return CircularIcon;
  }
}

const statusColors: Record<string, string> = {
  idle: "border-border/60",
  running: "border-success/50 shadow-success/10 shadow-lg",
  blocked: "border-warning/50",
  down: "border-destructive/50",
};

const statusLabels: Record<string, { text: string; class: string }> = {
  idle: { text: "IDLE", class: "text-muted-foreground" },
  running: { text: "RUNNING", class: "text-success" },
  blocked: { text: "BLOCKED", class: "text-warning" },
  down: { text: "DOWN", class: "text-destructive" },
};

interface MachineSelectorProps {
  machines: LiveMachine[];
}

export function MachineSelector({ machines }: MachineSelectorProps) {
  const navigate = useNavigate();
  const { pinMachine } = useTabletPin();
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wider uppercase text-primary">
          Select Fabrication Unit
        </h2>
        <LayoutGrid className="w-4 h-4 text-muted-foreground" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {machines.map((machine) => {
          const spec = getMachineSpec(machine.model);
          const FallbackIcon = getFallbackIcon(machine.type);
          const status = statusLabels[machine.status] || statusLabels.idle;

          return (
            <div
              key={machine.id}
              className={`group relative rounded-xl border-2 bg-card overflow-hidden transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${statusColors[machine.status] || statusColors.idle}`}
            >
              {/* Clickable main area */}
              <button
                onClick={() => navigate(`/shopfloor/station/${machine.id}`)}
                className="w-full p-4 sm:p-6 flex flex-col items-center gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
              >
                {/* Machine image or fallback icon */}
                {spec?.image ? (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 relative">
                    <img
                      src={spec.image}
                      alt={machine.model || machine.name}
                      className="w-full h-full object-contain drop-shadow-md"
                    />
                  </div>
                ) : (
                  <FallbackIcon className="w-16 h-16 sm:w-20 sm:h-20 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
                )}

                {/* Machine name + model */}
                <div className="text-center space-y-0.5">
                  <h3 className="text-sm sm:text-base font-black tracking-wide uppercase text-foreground">
                    {machine.name}
                  </h3>
                  {machine.model && (
                    <p className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground font-medium">
                      {machine.model}
                    </p>
                  )}
                </div>

                {/* Capability badges */}
                {spec && (
                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
                      {spec.operation.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
                      MAX {spec.maxBarCode}
                    </Badge>
                  </div>
                )}

                {/* Status */}
                <span className={`text-[9px] tracking-[0.2em] uppercase font-bold ${status.class}`}>
                  {status.text}
                </span>
              </button>

              {/* Pin + Specs buttons */}
              <div className="border-t border-border flex items-center justify-center gap-1 py-1.5 px-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] gap-1 px-2 text-muted-foreground hover:text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    pinMachine(machine.id);
                    toast({
                      title: "Pinned to this tablet",
                      description: `${machine.name} is now the default station for this device.`,
                    });
                    navigate(`/shopfloor/station/${machine.id}`);
                  }}
                >
                  <Lock className="w-3 h-3" />
                  Pin
                </Button>
                {spec && <MachineSpecsPanel spec={spec} machineName={machine.name} />}
              </div>

              {/* Running indicator */}
              {machine.status === "running" && (
                <div className="absolute top-3 right-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

MachineSelector.displayName = "MachineSelector";
