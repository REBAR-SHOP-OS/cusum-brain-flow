import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Zap } from "lucide-react";
import type { LiveMachine } from "@/types/machine";

interface ActiveProductionHubProps {
  machines: LiveMachine[];
}

export function ActiveProductionHub({ machines }: ActiveProductionHubProps) {
  const navigate = useNavigate();
  const activeMachines = machines.filter((m) => m.status === "running");

  if (activeMachines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <p className="text-muted-foreground text-sm">No machines currently running</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">
          Active Production Hub
        </h2>
        <Badge className="bg-success/20 text-success border-success/30 text-xs">
          {activeMachines.length} RUNNING
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {activeMachines.map((machine) => {
          const queuedCount = machine.queued_runs?.length || 0;
          const progress = queuedCount > 0 ? Math.round(Math.random() * 60 + 10) : 0; // placeholder

          return (
            <Card key={machine.id} className="border-primary/20 bg-card">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{machine.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {machine.current_run?.process || "Processing"}
                    </p>
                  </div>
                  <Badge className="bg-success/20 text-success border-success/30">
                    <Play className="w-3 h-3 mr-1" />
                    LIVE
                  </Badge>
                </div>

                {machine.operator && (
                  <p className="text-xs text-muted-foreground">
                    Operator: {machine.operator.full_name}
                  </p>
                )}

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {queuedCount} in queue
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-xs"
                    onClick={() => navigate(`/shopfloor/station/${machine.id}`)}
                  >
                    Enter Station
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
