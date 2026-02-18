import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectTasks, TASK_STATUSES, TaskStatus } from "@/hooks/useProjectTasks";
import { Plus, ChevronRight, Calendar, Flag, Loader2, Target, LayoutGrid, BarChart3, Search } from "lucide-react";
import { format, differenceInDays, startOfDay, addDays, parseISO, isAfter, isBefore } from "date-fns";

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-600 bg-red-100",
  high: "text-orange-600 bg-orange-100",
  medium: "text-amber-600 bg-amber-100",
  low: "text-slate-600 bg-slate-100",
};

function TaskCard({ task, onMove }: { task: any; onMove: (id: string, status: TaskStatus) => void }) {
  const nextStatus = TASK_STATUSES[TASK_STATUSES.findIndex(s => s.key === task.status) + 1];
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-1.5">
        <p className="text-sm font-medium leading-tight">{task.title}</p>
        {task.projects?.name && <p className="text-[10px] text-muted-foreground">{task.projects.name}</p>}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge className={`text-[10px] h-4 ${PRIORITY_COLORS[task.priority] || ""}`}>{task.priority}</Badge>
          {task.due_date && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Calendar className="w-2.5 h-2.5" /> {format(parseISO(task.due_date), "MMM d")}
            </span>
          )}
        </div>
        {task.profiles?.full_name && <p className="text-[10px] text-muted-foreground">→ {task.profiles.full_name}</p>}
        {nextStatus && task.status !== "done" && task.status !== "blocked" && (
          <Button variant="ghost" size="sm" className="w-full text-xs h-6 mt-1" onClick={() => onMove(task.id, nextStatus.key)}>
            Move to {nextStatus.label} <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function GanttChart({ tasks, milestones }: { tasks: any[]; milestones: any[] }) {
  const tasksWithDates = tasks.filter(t => t.start_date || t.due_date);
  const allDates = [
    ...tasksWithDates.flatMap(t => [t.start_date, t.due_date].filter(Boolean)),
    ...milestones.map(m => m.target_date),
  ].filter(Boolean).map(d => parseISO(d));

  if (allDates.length === 0) return <p className="text-sm text-muted-foreground text-center py-10">No tasks with dates to display. Add start/due dates to see the Gantt chart.</p>;

  const minDate = startOfDay(new Date(Math.min(...allDates.map(d => d.getTime()))));
  const maxDate = startOfDay(addDays(new Date(Math.max(...allDates.map(d => d.getTime()))), 1));
  const totalDays = Math.max(differenceInDays(maxDate, minDate), 7);

  const getPercent = (dateStr: string) => {
    const d = parseISO(dateStr);
    return (differenceInDays(d, minDate) / totalDays) * 100;
  };

  // Generate week labels
  const weeks: { label: string; left: number }[] = [];
  for (let i = 0; i < totalDays; i += 7) {
    weeks.push({ label: format(addDays(minDate, i), "MMM d"), left: (i / totalDays) * 100 });
  }

  return (
    <div className="space-y-1">
      {/* Timeline header */}
      <div className="relative h-6 border-b border-border mb-2">
        {weeks.map((w, i) => (
          <span key={i} className="absolute text-[10px] text-muted-foreground" style={{ left: `${w.left}%` }}>{w.label}</span>
        ))}
      </div>

      {tasksWithDates.map(task => {
        const start = task.start_date ? getPercent(task.start_date) : (task.due_date ? getPercent(task.due_date) - 3 : 0);
        const end = task.due_date ? getPercent(task.due_date) : start + 3;
        const width = Math.max(end - start, 2);
        const statusColor = TASK_STATUSES.find(s => s.key === task.status)?.color || "bg-slate-400";

        return (
          <div key={task.id} className="relative h-7 flex items-center group">
            <span className="w-32 shrink-0 text-xs truncate pr-2 text-muted-foreground">{task.title}</span>
            <div className="flex-1 relative h-5">
              <div
                className={`absolute h-full rounded ${statusColor} opacity-80 group-hover:opacity-100 transition-opacity`}
                style={{ left: `${start}%`, width: `${width}%` }}
                title={`${task.title}: ${task.start_date || "?"} → ${task.due_date || "?"}`}
              />
            </div>
          </div>
        );
      })}

      {/* Milestones */}
      {milestones.map(ms => {
        const pos = getPercent(ms.target_date);
        return (
          <div key={ms.id} className="relative h-7 flex items-center">
            <span className="w-32 shrink-0 text-xs truncate pr-2 text-muted-foreground font-medium">◆ {ms.title}</span>
            <div className="flex-1 relative h-5">
              <div
                className="absolute w-3 h-3 rotate-45 bg-primary top-1"
                style={{ left: `${pos}%` }}
                title={`${ms.title}: ${ms.target_date}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ProjectManagement() {
  const { tasks, milestones, projects, isLoading, createTask, updateTask, createMilestone } = useProjectTasks();
  const [tab, setTab] = useState("kanban");
  const [taskDialog, setTaskDialog] = useState(false);
  const [msDialog, setMsDialog] = useState(false);
  const [filterProject, setFilterProject] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [taskForm, setTaskForm] = useState({ title: "", project_id: "", description: "", priority: "medium", start_date: "", due_date: "" });
  const [msForm, setMsForm] = useState({ project_id: "", title: "", target_date: "", description: "" });

  const filtered = useMemo(() => {
    let list = tasks;
    if (filterProject !== "all") list = list.filter(t => t.project_id === filterProject);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(s));
    }
    return list;
  }, [tasks, filterProject, search]);

  const filteredMilestones = useMemo(() => {
    if (filterProject === "all") return milestones;
    return milestones.filter(m => m.project_id === filterProject);
  }, [milestones, filterProject]);

  const todoCount = tasks.filter(t => t.status === "todo").length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
  const doneCount = tasks.filter(t => t.status === "done").length;
  const overdueCount = tasks.filter(t => t.due_date && isBefore(parseISO(t.due_date), new Date()) && t.status !== "done").length;

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{todoCount}</p><p className="text-xs text-muted-foreground">To Do</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{inProgressCount}</p><p className="text-xs text-muted-foreground">In Progress</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{doneCount}</p><p className="text-xs text-muted-foreground">Done</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-destructive">{overdueCount}</p><p className="text-xs text-muted-foreground">Overdue</p></CardContent></Card>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
          <DialogTrigger asChild><Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> New Task</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title *</Label><Input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label>Project</Label>
                <Select value={taskForm.project_id} onValueChange={v => setTaskForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Priority</Label>
                <Select value={taskForm.priority} onValueChange={v => setTaskForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date</Label><Input type="date" value={taskForm.start_date} onChange={e => setTaskForm(f => ({ ...f, start_date: e.target.value }))} /></div>
                <div><Label>Due Date</Label><Input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
              <Button className="w-full" disabled={!taskForm.title || createTask.isPending} onClick={() => {
                const payload: any = { title: taskForm.title, priority: taskForm.priority };
                if (taskForm.project_id) payload.project_id = taskForm.project_id;
                if (taskForm.start_date) payload.start_date = taskForm.start_date;
                if (taskForm.due_date) payload.due_date = taskForm.due_date;
                if (taskForm.description) payload.description = taskForm.description;
                createTask.mutate(payload, { onSuccess: () => { setTaskDialog(false); setTaskForm({ title: "", project_id: "", description: "", priority: "medium", start_date: "", due_date: "" }); } });
              }}>Create Task</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={msDialog} onOpenChange={setMsDialog}>
          <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-1"><Target className="w-4 h-4" /> Add Milestone</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Milestone</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Project *</Label>
                <Select value={msForm.project_id} onValueChange={v => setMsForm(f => ({ ...f, project_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Title *</Label><Input value={msForm.title} onChange={e => setMsForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div><Label>Target Date *</Label><Input type="date" value={msForm.target_date} onChange={e => setMsForm(f => ({ ...f, target_date: e.target.value }))} /></div>
              <div><Label>Description</Label><Textarea value={msForm.description} onChange={e => setMsForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
              <Button className="w-full" disabled={!msForm.project_id || !msForm.title || !msForm.target_date || createMilestone.isPending} onClick={() => {
                createMilestone.mutate(msForm, { onSuccess: () => { setMsDialog(false); setMsForm({ project_id: "", title: "", target_date: "", description: "" }); } });
              }}>Create Milestone</Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="pl-8 h-9 w-48 text-sm" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="kanban" className="gap-1"><LayoutGrid className="w-3.5 h-3.5" /> Kanban</TabsTrigger>
          <TabsTrigger value="gantt" className="gap-1"><BarChart3 className="w-3.5 h-3.5" /> Gantt</TabsTrigger>
          <TabsTrigger value="milestones" className="gap-1"><Target className="w-3.5 h-3.5" /> Milestones ({filteredMilestones.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-3">
          <div className="flex gap-3 overflow-x-auto pb-4">
            {TASK_STATUSES.map(status => (
              <div key={status.key} className="min-w-[220px] w-[220px] shrink-0 flex flex-col gap-2">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${status.color}`} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{status.label}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px] h-5">
                    {filtered.filter(t => t.status === status.key).length}
                  </Badge>
                </div>
                <ScrollArea className="flex-1 max-h-[60vh]">
                  <div className="space-y-2 px-1">
                    {filtered.filter(t => t.status === status.key).map(task => (
                      <TaskCard key={task.id} task={task} onMove={(id, s) => updateTask.mutate({ id, status: s })} />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="gantt" className="mt-3">
          <Card>
            <CardContent className="p-4 overflow-x-auto">
              <GanttChart tasks={filtered} milestones={filteredMilestones} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones" className="mt-3">
          <div className="space-y-2">
            {filteredMilestones.map(ms => (
              <Card key={ms.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{ms.title}</p>
                      <p className="text-xs text-muted-foreground">{ms.projects?.name} · Due {format(parseISO(ms.target_date), "MMM d, yyyy")}</p>
                    </div>
                  </div>
                  <Badge variant={ms.status === "completed" ? "default" : ms.status === "missed" ? "destructive" : "secondary"} className="text-xs">{ms.status}</Badge>
                </CardContent>
              </Card>
            ))}
            {filteredMilestones.length === 0 && <p className="text-sm text-muted-foreground text-center py-10">No milestones yet.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
