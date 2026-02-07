import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Scissors, LayoutGrid } from "lucide-react";
import type { LiveMachine } from "@/types/machine";

interface MachineSelectorProps {
  machines: LiveMachine[];
}

// SVG icons matching the reference screenshots
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

function getIcon(type: string) {
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

export function MachineSelector({ machines }: MachineSelectorProps) {
  const navigate = useNavigate();

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
          const Icon = getIcon(machine.type);
          return (
            <button
              key={machine.id}
              onClick={() => navigate(`/shopfloor/station/${machine.id}`)}
              className={`group relative rounded-xl border-2 bg-card hover:bg-muted/30 transition-all duration-200 p-6 sm:p-8 flex flex-col items-center gap-4 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${statusColors[machine.status] || statusColors.idle}`}
            >
              <Icon className="w-16 h-16 sm:w-20 sm:h-20 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
              
              <div className="text-center space-y-1">
                <h3 className="text-sm sm:text-base font-black tracking-wide uppercase text-foreground">
                  {machine.name}
                </h3>
                <p className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Station
                </p>
              </div>

              {machine.status === "running" && (
                <div className="absolute top-3 right-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
