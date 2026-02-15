import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExternalLink, Sparkles, Bot, User } from "lucide-react";
import { toast } from "sonner";

const columns = ["open", "in_progress", "done"] as const;
const columnLabels: Record<string, string> = { open: "Open", in_progress: "In Progress", done: "Done" };
const priorityColors: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  high: "bg-orange-500/10 text-orange-600",
  medium: "bg-yellow-500/10 text-yellow-600",
  low: "bg-blue-500/10 text-blue-500",
};
const taskTypeColors: Record<string, string> = {
  content: "bg-purple-500/10 text-purple-600",
  technical: "bg-orange-500/10 text-orange-600",
  internal_link: "bg-blue-500/10 text-blue-600",
};

export function SeoTasks() {
  const qc = useQueryClient();

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["seo-tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("seo_tasks")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("seo_tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seo-tasks"] });
      toast.success("Task updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = {
    open: tasks?.filter((t: any) => t.status === "open") || [],
    in_progress: tasks?.filter((t: any) => t.status === "in_progress") || [],
    done: tasks?.filter((t: any) => t.status === "done") || [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SEO Tasks</h1>
        <p className="text-sm text-muted-foreground">AI-generated and manual SEO tasks</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => (
            <div key={col} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{columnLabels[col]}</h3>
                <Badge variant="outline" className="text-xs">{grouped[col].length}</Badge>
              </div>
              <div className="space-y-2 min-h-[200px] bg-muted/20 rounded-lg p-2">
                {grouped[col].length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No tasks</p>
                ) : (
                  grouped[col].map((task: any) => (
                    <Card key={task.id} className="shadow-sm">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-sm font-medium leading-tight">{task.title}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {task.created_by === "ai" && (
                              <Bot className="w-3 h-3 text-primary" />
                            )}
                            <Badge className={`text-[10px] ${priorityColors[task.priority] || ""}`}>
                              {task.priority}
                            </Badge>
                          </div>
                        </div>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                        )}
                        {/* AI reasoning */}
                        {task.ai_reasoning && (
                          <div className="bg-primary/5 rounded p-2 border border-primary/10">
                            <p className="text-[10px] text-primary font-medium flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> AI Reasoning
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.ai_reasoning}</p>
                          </div>
                        )}
                        {/* Expected impact */}
                        {task.expected_impact && (
                          <p className="text-[10px] text-muted-foreground">
                            <span className="font-medium">Impact:</span> {task.expected_impact}
                          </p>
                        )}
                        {/* Task type + creator badges */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {task.task_type && (
                            <Badge className={`text-[10px] ${taskTypeColors[task.task_type] || ""}`}>
                              {task.task_type}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {task.created_by === "ai" ? (
                              <span className="flex items-center gap-0.5"><Bot className="w-2.5 h-2.5" /> AI</span>
                            ) : (
                              <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" /> Manual</span>
                            )}
                          </Badge>
                        </div>
                        {task.entity_url && (
                          <a href={task.entity_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary flex items-center gap-0.5 hover:underline">
                            <ExternalLink className="w-3 h-3" /> {task.entity_url.substring(0, 50)}
                          </a>
                        )}
                        <Select value={task.status} onValueChange={(v) => updateStatus.mutate({ id: task.id, status: v })}>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
