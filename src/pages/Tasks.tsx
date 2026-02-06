import { useState, useEffect } from "react";
import { CheckSquare, Filter, Plus, RefreshCw, Mail, Circle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  agent_type: string | null;
  due_date: string | null;
  source: string | null;
  source_ref: string | null;
  created_at: string;
}

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

const priorityOptions = [
  { value: "all", label: "All Priorities" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const agentOptions = [
  { value: "all", label: "All Agents" },
  { value: "sales", label: "Sales" },
  { value: "accounting", label: "Accounting" },
  { value: "support", label: "Support" },
  { value: "collections", label: "Collections" },
  { value: "estimation", label: "Estimation" },
];

const priorityColors: Record<string, string> = {
  urgent: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500/20 text-orange-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low: "bg-muted text-muted-foreground",
};

const agentColors: Record<string, string> = {
  sales: "bg-blue-500/20 text-blue-400",
  accounting: "bg-green-500/20 text-green-400",
  support: "bg-purple-500/20 text-purple-400",
  collections: "bg-red-500/20 text-red-400",
  estimation: "bg-amber-500/20 text-amber-400",
};

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const { toast } = useToast();

  const loadTasks = async () => {
    setLoading(true);
    try {
      let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (priorityFilter !== "all") {
        query = query.eq("priority", priorityFilter);
      }
      if (agentFilter !== "all") {
        query = query.eq("agent_type", agentFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load tasks";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [statusFilter, priorityFilter, agentFilter]);

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ 
          status: newStatus,
          completed_at: newStatus === "completed" ? new Date().toISOString() : null
        })
        .eq("id", taskId);

      if (error) throw error;
      
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
      toast({ title: "Task updated" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update task";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={loadTasks} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-secondary/30">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {priorityOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {agentOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading && tasks.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <CheckSquare className="w-12 h-12 mb-4 opacity-50" />
            <p>No tasks found</p>
            <p className="text-sm">Tasks created from emails will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Status checkbox */}
                  <button
                    onClick={() =>
                      updateTaskStatus(
                        task.id,
                        task.status === "completed" ? "open" : "completed"
                      )
                    }
                    className={cn(
                      "w-5 h-5 mt-0.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                      task.status === "completed"
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/50 hover:border-primary"
                    )}
                  >
                    {task.status === "completed" && (
                      <CheckSquare className="w-3 h-3" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span
                        className={cn(
                          "font-medium",
                          task.status === "completed" && "line-through text-muted-foreground"
                        )}
                      >
                        {task.title}
                      </span>
                      {task.source === "email" && (
                        <Mail className="w-3 h-3 text-muted-foreground" />
                      )}
                    </div>

                    {task.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      {task.priority && (
                        <Badge
                          variant="secondary"
                          className={cn("text-xs", priorityColors[task.priority])}
                        >
                          {task.priority}
                        </Badge>
                      )}
                      {task.agent_type && (
                        <Badge
                          variant="secondary"
                          className={cn("text-xs", agentColors[task.agent_type])}
                        >
                          {task.agent_type}
                        </Badge>
                      )}
                      {task.due_date && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {format(new Date(task.due_date), "MMM d")}
                        </span>
                      )}
                    </div>
                  </div>

                  <Select
                    value={task.status || "open"}
                    onValueChange={(value) => updateTaskStatus(task.id, value)}
                  >
                    <SelectTrigger className="w-[120px] h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
