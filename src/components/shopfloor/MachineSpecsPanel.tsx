import { Lock, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { MachineSpec } from "./machineRegistry";

interface MachineSpecsPanelProps {
  spec: MachineSpec;
  machineName: string;
}

const ALL_BARS = ["10M", "15M", "20M", "25M", "30M", "35M", "45M", "55M"];

export function MachineSpecsPanel({ spec, machineName }: MachineSpecsPanelProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Lock className="w-3 h-3" />
          Specs
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <span className="uppercase tracking-wide">{machineName}</span>
            <Badge variant="outline" className="text-[10px] ml-auto">
              {spec.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Purpose */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Purpose:</span>
            <span className="font-medium">{spec.purpose}</span>
          </div>

          {/* Capacity table */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              Capacity (GR60 — Locked)
            </p>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground">Bar</th>
                    <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">Max Bars</th>
                    <th className="text-center px-3 py-1.5 text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ALL_BARS.map((bar) => {
                    const maxBars = spec.capacity[bar];
                    const isBlocked = spec.blocked.includes(bar);
                    const isAllowed = maxBars !== undefined;

                    return (
                      <tr key={bar} className={`border-t border-border ${isBlocked ? "bg-destructive/5" : ""}`}>
                        <td className="px-3 py-1.5 font-mono font-bold text-xs">{bar}</td>
                        <td className="px-3 py-1.5 text-center font-mono text-xs">
                          {isAllowed ? maxBars : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {isBlocked ? (
                            <XCircle className="w-3.5 h-3.5 text-destructive inline-block" />
                          ) : isAllowed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-success inline-block" />
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rules */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Rules
            </p>
            <ul className="space-y-1">
              {spec.notes.map((note, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <AlertTriangle className="w-3 h-3 mt-0.5 text-warning shrink-0" />
                  {note}
                </li>
              ))}
            </ul>
          </div>

          {/* Global enforcement */}
          <div className="rounded-lg bg-muted/30 border border-border p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-destructive mb-1">
              🔒 Non-Negotiable
            </p>
            <ul className="text-[11px] text-muted-foreground space-y-0.5">
              <li>• No capability = hard block</li>
              <li>• Office cannot override</li>
              <li>• Every violation logs event</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
