import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FolderOpen,
  Layers,
  Play,
  ArrowRight,
  GripVertical,
  Scissors,
  RotateCcw,
  Circle,
} from "lucide-react";
import type { QueueItemWithTask, ProjectLane } from "@/hooks/useProductionQueues";

interface ProjectLanesViewProps {
  lanes: ProjectLane[];
  machines: { id: string; name: string; status: string }[];
  canWrite: boolean;
  onStartTask: (queueItemId: string) => void;
  onMoveTask: (queueItemId: string, targetMachineId: string) => void;
}

const TASK_TYPE_ICONS: Record<string, React.ElementType> = {
  cut: Scissors,
  bend: RotateCcw,
  spiral: Circle,
};

const TASK_TYPE_COLORS: Record<string, string> = {
  cut: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  bend: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  spiral: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

export function ProjectLanesView({
  lanes,
  machines,
  canWrite,
  onStartTask,
  onMoveTask,
}: ProjectLanesViewProps) {
  const machineMap = new Map(machines.map((m) => [m.id, m]));

  if (lanes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
        <Layers className="w-8 h-8" />
        <p className="text-sm">No tasks in production queues</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {lanes.map((lane) => (
        <Card key={lane.projectId || "unassigned"} className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              {lane.projectName || "Unassigned"}
              <Badge variant="outline" className="text-[10px] font-mono ml-auto">
                {lane.items.length} task{lane.items.length !== 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="max-h-64">
              <div className="space-y-1.5">
                {lane.items.map((item) => {
                  const task = item.task;
                  if (!task) return null;

                  const machine = machineMap.get(item.machine_id);
                  const TypeIcon = TASK_TYPE_ICONS[task.task_type] || Layers;
                  const typeColor = TASK_TYPE_COLORS[task.task_type] || "";
                  const isRunning = item.status === "running";

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 rounded-md border p-2 text-xs transition-colors ${
                        isRunning
                          ? "border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5"
                          : "border-border/50 bg-muted/30 hover:bg-muted/50"
                      }`}
                    >
                      {canWrite && !isRunning && (
                        <GripVertical className="w-3 h-3 text-muted-foreground/50 shrink-0 cursor-grab" />
                      )}

                      <Badge variant="outline" className={`text-[10px] px-1.5 shrink-0 ${typeColor}`}>
                        <TypeIcon className="w-2.5 h-2.5 mr-0.5" />
                        {task.task_type}
                      </Badge>

                      <span className="font-mono font-semibold">{task.bar_code}</span>

                      {task.mark_number && (
                        <span className="text-muted-foreground truncate max-w-[80px]">
                          {task.mark_number}
                        </span>
                      )}

                      {task.cut_length_mm && (
                        <span className="text-muted-foreground font-mono">
                          {task.cut_length_mm}mm
                        </span>
                      )}

                      <Separator orientation="vertical" className="h-3 mx-1" />

                      <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                      <span className="text-muted-foreground truncate">
                        {machine?.name || item.machine_id.slice(0, 8)}
                      </span>

                      <div className="ml-auto flex items-center gap-1">
                        <span className="font-mono text-muted-foreground">
                          {task.qty_completed}/{task.qty_required}
                        </span>

                        {isRunning && (
                          <Badge className="bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-[hsl(var(--success))]/30 text-[9px]">
                            RUNNING
                          </Badge>
                        )}

                        {canWrite && !isRunning && (
                          <Button
                            size="sm"
                            className="h-5 text-[10px] px-2 gap-0.5"
                            onClick={() => onStartTask(item.id)}
                          >
                            <Play className="w-2.5 h-2.5" />
                            Start
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
