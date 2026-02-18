import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CheckSquare, Filter, Plus, RefreshCw, Clock, Copy, Check, Maximize2,
  ChevronDown, ChevronRight, Search, X, Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, isThisWeek, startOfDay } from "date-fns";

// ─── Types ──────────────────────────────────────────────
interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  assigned_to: string | null;
  created_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  company_id: string;
  assigned_profile?: { id: string; full_name: string | null } | null;
  created_by_profile?: { id: string; full_name: string | null } | null;
}

interface AuditEntry {
  id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  actor_user_id: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  user_id: string | null;
}

// ─── Constants ──────────────────────────────────────────
const STATUS_MAP: Record<string, string> = { open: "Pending", in_progress: "In Progress", completed: "Completed" };
const STATUS_REVERSE: Record<string, string> = { Pending: "open", "In Progress": "in_progress", Completed: "completed" };
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-destructive/20 text-destructive",
  medium: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  low: "bg-muted text-muted-foreground",
};
const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  in_progress: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
  completed: "bg-green-500/20 text-green-600 dark:text-green-400",
};

// ─── Helpers ────────────────────────────────────────────
function isOverdue(task: TaskRow) {
  if (!task.due_date || task.status === "completed") return false;
  return isPast(startOfDay(new Date(task.due_date))) && !isToday(new Date(task.due_date));
}

function sortTasks(tasks: TaskRow[]): TaskRow[] {
  const active = tasks.filter(t => t.status !== "completed");
  const completed = tasks.filter(t => t.status === "completed");

  active.sort((a, b) => {
    // overdue first
    const aOver = isOverdue(a) ? 0 : 1;
    const bOver = isOverdue(b) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    // due_date ascending, nulls last
    if (a.due_date && b.due_date) {
      const diff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (diff !== 0) return diff;
    } else if (a.due_date && !b.due_date) return -1;
    else if (!a.due_date && b.due_date) return 1;
    // priority
    const ap = PRIORITY_ORDER[a.priority || "medium"] ?? 1;
    const bp = PRIORITY_ORDER[b.priority || "medium"] ?? 1;
    if (ap !== bp) return ap - bp;
    // created_at desc
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  completed.sort((a, b) => {
    const aAt = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const bAt = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return bAt - aAt;
  });

  return [...active, ...completed];
}

function linkifyText(text: string | null) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline break-all">{part}</a>
      : <span key={i}>{part}</span>
  );
}

// ─── Component ──────────────────────────────────────────
export default function Tasks() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Detail drawer
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [creating, setCreating] = useState(false);

  // Full screen desc
  const [fullScreenOpen, setFullScreenOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // ─── Data loading ─────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, profilesRes] = await Promise.all([
        supabase.from("tasks").select("*, created_by_profile:profiles!tasks_created_by_profile_id_fkey(id, full_name)").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, user_id"),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (profilesRes.error) throw profilesRes.error;
      setTasks((tasksRes.data as any) || []);
      setProfiles(profilesRes.data || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Audit log loading ────────────────────────────────
  const loadAudit = async (taskId: string) => {
    setAuditLoading(true);
    try {
      const { data, error } = await supabase
        .from("task_audit_log")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAuditLog((data as AuditEntry[]) || []);
    } catch { setAuditLog([]); }
    finally { setAuditLoading(false); }
  };

  // ─── Filtering ────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...tasks];

    // search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q));
    }
    // status
    if (statusFilter !== "all") result = result.filter(t => t.status === statusFilter);
    // priority
    if (priorityFilter !== "all") result = result.filter(t => t.priority === priorityFilter);
    // due date
    if (dueDateFilter === "overdue") result = result.filter(isOverdue);
    else if (dueDateFilter === "today") result = result.filter(t => t.due_date && isToday(new Date(t.due_date)));
    else if (dueDateFilter === "week") result = result.filter(t => t.due_date && isThisWeek(new Date(t.due_date)));
    else if (dueDateFilter === "none") result = result.filter(t => !t.due_date);
    // show completed
    if (!showCompleted) result = result.filter(t => t.status !== "completed");

    return result;
  }, [tasks, search, statusFilter, priorityFilter, dueDateFilter, showCompleted]);

  // ─── Grouping ─────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; profileId: string | null; tasks: TaskRow[] }>();
    for (const t of filtered) {
      const key = t.assigned_to || "__unassigned__";
      if (!map.has(key)) {
        const assignedProfile = profiles.find(p => p.id === t.assigned_to);
        const name = assignedProfile?.full_name || "Unassigned";
        map.set(key, { name, profileId: t.assigned_to, tasks: [] });
      }
      map.get(key)!.tasks.push(t);
    }
    // Sort each group's tasks
    for (const g of map.values()) g.tasks = sortTasks(g.tasks);
    // Sort groups: Unassigned last, then by name
    return Array.from(map.values()).sort((a, b) => {
      if (!a.profileId) return 1;
      if (!b.profileId) return -1;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [filtered, profiles]);

  // Auto-collapse groups with only completed tasks
  useEffect(() => {
    const toCollapse = new Set<string>();
    for (const g of grouped) {
      const key = g.profileId || "__unassigned__";
      if (g.tasks.every(t => t.status === "completed")) toCollapse.add(key);
    }
    setCollapsedGroups(toCollapse);
  }, [grouped]);

  // ─── Mutations ────────────────────────────────────────
  const writeAudit = async (taskId: string, action: string, field: string | null, oldVal: string | null, newVal: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("task_audit_log").insert({
      task_id: taskId,
      action,
      field,
      old_value: oldVal,
      new_value: newVal,
      actor_user_id: user?.id || null,
    } as any);
  };

  const updateField = async (task: TaskRow, field: string, value: string | null) => {
    const oldVal = (task as any)[field];
    const updates: any = { [field]: value, updated_at: new Date().toISOString() };

    if (field === "status" && value === "completed") {
      updates.completed_at = new Date().toISOString();
    } else if (field === "status" && oldVal === "completed") {
      updates.completed_at = null;
    }

    const { error } = await supabase.from("tasks").update(updates).eq("id", task.id);
    if (error) { toast.error(error.message); return; }

    const actionMap: Record<string, string> = {
      status: value === "completed" ? "complete" : oldVal === "completed" ? "uncomplete" : "status_change",
      priority: "priority_change",
      assigned_to: "reassign",
      due_date: "due_date_change",
    };
    await writeAudit(task.id, actionMap[field] || "update", field, String(oldVal ?? ""), String(value ?? ""));
    toast.success("Task updated");
    loadData();
  };

  const toggleComplete = async (task: TaskRow) => {
    if (task.status === "completed") {
      await updateField(task, "status", "open");
    } else {
      await updateField(task, "status", "completed");
    }
  };

  const createTask = async () => {
    if (!newTitle.trim() || !newAssignee) { toast.error("Title and assignee are required"); return; }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const profile = profiles.find(p => p.user_id === user?.id);
      const companyRes = await supabase.from("profiles").select("company_id").eq("user_id", user?.id || "").single();

      const { data, error } = await supabase.from("tasks").insert({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        assigned_to: newAssignee,
        due_date: newDueDate || null,
        priority: newPriority,
        status: "open",
        company_id: companyRes.data?.company_id,
        created_by_profile_id: profile?.id || null,
      } as any).select().single();

      if (error) throw error;
      await writeAudit(data.id, "create", null, null, null);
      toast.success("Task created");
      setCreateOpen(false);
      setNewTitle(""); setNewDesc(""); setNewAssignee(""); setNewDueDate(""); setNewPriority("medium");
      loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setCreating(false); }
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    toast.success("Task deleted");
    setDrawerOpen(false);
    loadData();
  };

  const copyToClipboard = async (text: string | null) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); toast.success("Copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      toast.success("Copied!"); setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openDrawer = (task: TaskRow) => {
    setSelectedTask(task);
    setDrawerOpen(true);
    loadAudit(task.id);
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ─── Render ───────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold">Employee Tasks</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={loadData} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Task
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-3 border-b border-border bg-secondary/30">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dueDateFilter} onValueChange={setDueDateFilter}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="today">Due Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="none">No Due Date</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Switch id="show-completed" checked={showCompleted} onCheckedChange={setShowCompleted} className="scale-75" />
          <Label htmlFor="show-completed" className="text-xs text-muted-foreground cursor-pointer">Show Completed</Label>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {loading && tasks.length === 0 ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <CheckSquare className="w-12 h-12 mb-4 opacity-50" />
            <p>No tasks found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map(group => {
              const key = group.profileId || "__unassigned__";
              const isCollapsed = collapsedGroups.has(key);
              const pending = group.tasks.filter(t => t.status === "open").length;
              const inProgress = group.tasks.filter(t => t.status === "in_progress").length;
              const overdue = group.tasks.filter(isOverdue).length;
              const completed = group.tasks.filter(t => t.status === "completed").length;

              return (
                <Collapsible key={key} open={!isCollapsed} onOpenChange={() => toggleGroup(key)}>
                  <CollapsibleTrigger className="w-full flex items-center gap-3 px-4 sm:px-6 py-3 bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer">
                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{group.name}</span>
                    <div className="flex items-center gap-1.5 ml-auto">
                      {pending > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 bg-blue-500/20 text-blue-600 dark:text-blue-400">{pending} Pending</Badge>}
                      {inProgress > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 bg-orange-500/20 text-orange-600 dark:text-orange-400">{inProgress} In Progress</Badge>}
                      {overdue > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 bg-destructive/20 text-destructive">{overdue} Overdue</Badge>}
                      {showCompleted && completed > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 bg-green-500/20 text-green-600 dark:text-green-400">{completed} Done</Badge>}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="w-8"></TableHead>
                            <TableHead>Task</TableHead>
                            <TableHead className="w-[110px]">Status</TableHead>
                            <TableHead className="w-[100px]">Due Date</TableHead>
                            <TableHead className="w-[90px]">Priority</TableHead>
                            <TableHead className="w-[140px]">Assigned To</TableHead>
                            <TableHead className="w-[110px]">Created By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.tasks.map(task => (
                            <TableRow
                              key={task.id}
                              className={cn("cursor-pointer hover:bg-muted/30", task.status === "completed" && "opacity-60")}
                              onClick={() => openDrawer(task)}
                            >
                              <TableCell onClick={e => e.stopPropagation()} className="pr-0">
                                <Checkbox
                                  checked={task.status === "completed"}
                                  onCheckedChange={() => toggleComplete(task)}
                                />
                              </TableCell>
                              <TableCell>
                                <div>
                                  <span className={cn("font-medium text-sm", task.status === "completed" && "line-through text-muted-foreground")}>{task.title}</span>
                                  {task.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{task.description}</p>}
                                </div>
                              </TableCell>
                              <TableCell onClick={e => e.stopPropagation()}>
                                <Select value={task.status || "open"} onValueChange={v => updateField(task, "status", v)}>
                                  <SelectTrigger className="h-7 text-[11px] border-0 bg-transparent px-1">
                                    <Badge variant="secondary" className={cn("text-[10px]", STATUS_COLORS[task.status || "open"])}>{STATUS_MAP[task.status || "open"]}</Badge>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="open">Pending</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <span className={cn("text-xs", isOverdue(task) && "text-destructive font-medium")}>
                                  {task.due_date ? format(new Date(task.due_date), "MMM d") : "—"}
                                </span>
                              </TableCell>
                              <TableCell onClick={e => e.stopPropagation()}>
                                <Select value={task.priority || "medium"} onValueChange={v => updateField(task, "priority", v)}>
                                  <SelectTrigger className="h-7 text-[11px] border-0 bg-transparent px-1">
                                    <Badge variant="secondary" className={cn("text-[10px]", PRIORITY_COLORS[task.priority || "medium"])}>{(task.priority || "medium").charAt(0).toUpperCase() + (task.priority || "medium").slice(1)}</Badge>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="high">High</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="low">Low</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell onClick={e => e.stopPropagation()}>
                                <Select value={task.assigned_to || ""} onValueChange={v => updateField(task, "assigned_to", v)}>
                                  <SelectTrigger className="h-7 text-[11px] border-0 bg-transparent px-1 max-w-[130px]">
                                    <SelectValue placeholder="Unassigned" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {profiles.map(p => (
                                      <SelectItem key={p.id} value={p.id}>{p.full_name || "Unknown"}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">{task.created_by_profile?.full_name || "—"}</span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Create Task Modal ─── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription className="sr-only">Create a new employee task</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Task title" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y" />
            </div>
            <div>
              <Label className="text-xs">Assign To *</Label>
              <Select value={newAssignee} onValueChange={setNewAssignee}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name || "Unknown"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Due Date</Label>
                <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={createTask} disabled={creating} className="w-full">
              {creating ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Details Drawer ─── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedTask?.title}</SheetTitle>
            <SheetDescription className="sr-only">Task details and audit log</SheetDescription>
          </SheetHeader>
          {selectedTask && (
            <div className="mt-4 space-y-5">
              {/* Description */}
              {selectedTask.description && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-muted-foreground">Description</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(selectedTask.description)}>
                        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFullScreenOpen(true)}>
                        <Maximize2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap break-words overflow-y-auto max-h-[40vh] rounded-md border border-border/50 bg-muted/30 p-3">
                    {linkifyText(selectedTask.description)}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Status</span>
                  <p className="mt-0.5"><Badge variant="secondary" className={cn("text-xs", STATUS_COLORS[selectedTask.status || "open"])}>{STATUS_MAP[selectedTask.status || "open"]}</Badge></p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Priority</span>
                  <p className="mt-0.5"><Badge variant="secondary" className={cn("text-xs", PRIORITY_COLORS[selectedTask.priority || "medium"])}>{(selectedTask.priority || "medium").charAt(0).toUpperCase() + (selectedTask.priority || "medium").slice(1)}</Badge></p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Assigned To</span>
                  <p className="mt-0.5 text-sm">{profiles.find(p => p.id === selectedTask.assigned_to)?.full_name || "Unassigned"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Created By</span>
                  <p className="mt-0.5 text-sm">{selectedTask.created_by_profile?.full_name || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Due Date</span>
                  <p className={cn("mt-0.5 text-sm", isOverdue(selectedTask) && "text-destructive font-medium")}>{selectedTask.due_date ? format(new Date(selectedTask.due_date), "MMM d, yyyy") : "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Created</span>
                  <p className="mt-0.5 text-sm">{format(new Date(selectedTask.created_at), "MMM d, yyyy")}</p>
                </div>
                {selectedTask.completed_at && (
                  <div>
                    <span className="text-xs text-muted-foreground">Completed At</span>
                    <p className="mt-0.5 text-sm">{format(new Date(selectedTask.completed_at), "MMM d, yyyy HH:mm")}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button size="sm" variant={selectedTask.status === "completed" ? "outline" : "default"} onClick={() => toggleComplete(selectedTask)} className="flex-1">
                  {selectedTask.status === "completed" ? "Mark Incomplete" : "Mark Complete"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteTask(selectedTask.id)}>Delete</Button>
              </div>

              {/* Audit Log */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Audit Log</h4>
                {auditLoading ? (
                  <p className="text-xs text-muted-foreground">Loading...</p>
                ) : auditLog.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No audit entries yet</p>
                ) : (
                  <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                    {auditLog.map(entry => (
                      <div key={entry.id} className="text-xs border-l-2 border-border pl-3 py-1">
                        <span className="font-medium">{entry.action}</span>
                        {entry.field && <span className="text-muted-foreground"> on {entry.field}</span>}
                        {entry.old_value && entry.new_value && (
                          <span className="text-muted-foreground">: {entry.old_value} → {entry.new_value}</span>
                        )}
                        <p className="text-muted-foreground mt-0.5">{format(new Date(entry.created_at), "MMM d, HH:mm")}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Placeholders */}
              <div className="space-y-3 border-t border-border pt-3">
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground">Comments</h4>
                  <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground">Attachments</h4>
                  <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Full Screen Description */}
      <Dialog open={fullScreenOpen} onOpenChange={setFullScreenOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title}</DialogTitle>
            <DialogDescription className="sr-only">Full description</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto text-[15px] leading-relaxed text-foreground whitespace-pre-wrap break-words p-4">
            {selectedTask?.description && linkifyText(selectedTask.description)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
