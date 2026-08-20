import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTaxTasks } from "@/hooks/useTaxTasks";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/10 text-amber-600",
  done: "bg-emerald-500/10 text-emerald-600",
};

export function VickyTaskList() {
  const { tasks, isLoading, updateTask } = useTaxTasks();

  const nextStatus = (s: string) => s === "todo" ? "in_progress" : s === "in_progress" ? "done" : "todo";

  if (isLoading) return <Loader2 className="w-6 h-6 animate-spin mx-auto" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">👩‍💼 Vicky's CPA Tasks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8"
              onClick={() => updateTask.mutate({ id: t.id, status: nextStatus(t.status) })}
            >
              {t.status === "done" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground" />
              )}
            </Button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                {t.title}
              </p>
              {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
            </div>
            <Badge className={`text-[10px] ${STATUS_COLORS[t.status] || ""}`}>
              {t.status.replace("_", " ")}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
