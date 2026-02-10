import { useState, useEffect } from "react";
import { FileText, CheckSquare, Loader2, Sparkles, Plus, Check, Brain } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SuggestedTask {
  title: string;
  description: string;
  priority: string;
  created?: boolean;
}

interface CallSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcript: string;
  fromNumber?: string;
  toNumber?: string;
}

export function CallSummaryDialog({
  open,
  onOpenChange,
  transcript,
  fromNumber,
  toNumber,
}: CallSummaryDialogProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [tasks, setTasks] = useState<SuggestedTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingTasks, setCreatingTasks] = useState<Set<number>>(new Set());
  const [brainSaved, setBrainSaved] = useState(false);
  const { toast } = useToast();

  const handleSaveToBrain = async () => {
    if (!summary) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).maybeSingle();
      const { error } = await supabase.from("knowledge").insert({
        title: `Call Summary: ${fromNumber || "Unknown"} → ${toNumber || "Unknown"}`,
        content: summary + (tasks.length ? "\n\nAction Items:\n" + tasks.map(t => `- ${t.title}: ${t.description}`).join("\n") : ""),
        category: "call-summary",
        company_id: profile?.company_id,
      });
      if (error) throw error;
      setBrainSaved(true);
      toast({ title: "Saved to Brain" });
    } catch { toast({ title: "Failed to save", variant: "destructive" }); }
  };

  useEffect(() => {
    if (open && transcript && !summary) {
      summarizeCall();
    }
  }, [open, transcript]);

  const summarizeCall = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("summarize-call", {
        body: { transcript, fromNumber, toNumber },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.error) throw response.error;

      const result = response.data as { summary: string; tasks: SuggestedTask[] };
      setSummary(result.summary);
      setTasks(result.tasks || []);
    } catch (err) {
      toast({
        title: "Summarization Failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createTask = async (index: number) => {
    const task = tasks[index];
    if (!task || task.created) return;

    setCreatingTasks((prev) => new Set(prev).add(index));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("company_id").eq("user_id", user!.id).maybeSingle();
      const { error } = await supabase.from("tasks").insert({
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: "todo",
        source: "call-transcription",
        source_ref: `${fromNumber} → ${toNumber}`,
        company_id: profile?.company_id,
      });

      if (error) throw error;

      setTasks((prev) =>
        prev.map((t, i) => (i === index ? { ...t, created: true } : t))
      );

      toast({ title: "Task Created", description: task.title });
    } catch (err) {
      toast({
        title: "Failed to create task",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setCreatingTasks((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  const createAllTasks = async () => {
    for (let i = 0; i < tasks.length; i++) {
      if (!tasks[i].created) {
        await createTask(i);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Call Summary
          </DialogTitle>
          <DialogDescription>
            AI-generated summary from your call with {toNumber || fromNumber || "unknown"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analyzing transcript...</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {/* Summary */}
              {summary && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">Summary</span>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleSaveToBrain} disabled={brainSaved}>
                      <Brain className="w-3.5 h-3.5" />
                      {brainSaved ? "Saved" : "Save to Brain"}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-secondary/50 p-3 rounded-lg">
                    {summary}
                  </p>
                </div>
              )}

              {/* Suggested Tasks */}
              {tasks.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold">Suggested Tasks</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {tasks.length}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={createAllTasks}
                        disabled={tasks.every((t) => t.created)}
                        className="gap-1.5 text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create All
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {tasks.map((task, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">{task.title}</span>
                              <Badge
                                variant={
                                  task.priority === "high"
                                    ? "destructive"
                                    : task.priority === "medium"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-[10px]"
                              >
                                {task.priority}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{task.description}</p>
                          </div>
                          <Button
                            variant={task.created ? "ghost" : "outline"}
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={() => createTask(i)}
                            disabled={task.created || creatingTasks.has(i)}
                          >
                            {creatingTasks.has(i) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : task.created ? (
                              <Check className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
