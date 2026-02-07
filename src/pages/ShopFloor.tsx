import { useState } from "react";
import { Link } from "react-router-dom";
import { useJobs, useMachines, useQueues } from "@/hooks/useFirebaseCollection";
import { useSupabaseWorkOrders, SupabaseWorkOrder } from "@/hooks/useSupabaseWorkOrders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Factory, 
  Play, 
  Pause, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Loader2,
  RefreshCw,
  Database
} from "lucide-react";

interface Job {
  id: string;
  name?: string;
  status?: string;
  priority?: number;
  machine?: string;
  customer?: string;
  dueDate?: string;
  [key: string]: unknown;
}

interface Machine {
  id: string;
  name?: string;
  status?: string;
  currentJob?: string;
  [key: string]: unknown;
}

interface Queue {
  id: string;
  name?: string;
  jobs?: string[];
  [key: string]: unknown;
}

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  queued: "bg-yellow-500/20 text-yellow-500",
  "in-progress": "bg-blue-500/20 text-blue-500",
  running: "bg-blue-500/20 text-blue-500",
  complete: "bg-green-500/20 text-green-500",
  completed: "bg-green-500/20 text-green-500",
  paused: "bg-orange-500/20 text-orange-500",
  error: "bg-destructive/20 text-destructive",
};

const machineStatusColors: Record<string, string> = {
  idle: "bg-muted text-muted-foreground",
  running: "bg-green-500/20 text-green-500",
  maintenance: "bg-orange-500/20 text-orange-500",
  offline: "bg-destructive/20 text-destructive",
};

export default function ShopFloor() {
  const { data: firebaseJobs, loading: fbJobsLoading, error: fbJobsError } = useJobs();
  const { data: machines, loading: machinesLoading, error: fbMachinesError } = useMachines();
  const { data: queues, loading: queuesLoading } = useQueues();
  const { data: supabaseWO, loading: sbLoading, error: sbError, refetch: sbRefetch } = useSupabaseWorkOrders();
  const [activeTab, setActiveTab] = useState("jobs");

  // Determine data source: Firebase first, Supabase fallback
  const firebaseFailed = !!fbJobsError;
  const usingSupabase = firebaseFailed;

  // Normalize Supabase work orders to Job shape for unified rendering
  const supabaseJobs: Job[] = supabaseWO.map(wo => ({
    id: wo.id,
    name: wo.work_order_number,
    status: wo.status || "queued",
    priority: wo.priority || 0,
    machine: wo.workstation || undefined,
    customer: undefined,
    dueDate: wo.scheduled_end || undefined,
  }));

  const jobs = usingSupabase ? supabaseJobs : (firebaseJobs as Job[]);
  const jobsLoading = usingSupabase ? sbLoading : fbJobsLoading;
  const isLoading = jobsLoading || (!usingSupabase && (machinesLoading || queuesLoading));

  const typedJobs = jobs;
  const typedMachines = (usingSupabase ? [] : machines) as Machine[];
  const typedQueues = (usingSupabase ? [] : queues) as Queue[];

  const jobsByStatus = typedJobs.reduce((acc, job) => {
    const status = (job.status || "pending").toLowerCase();
    if (!acc[status]) acc[status] = [];
    acc[status].push(job);
    return acc;
  }, {} as Record<string, Job[]>);

  const activeJobs = typedJobs.filter(j => 
    ["in-progress", "running"].includes((j.status || "").toLowerCase())
  );

  const handleRefresh = () => {
    if (usingSupabase) {
      sbRefetch();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Factory className="w-5 h-5" />
            Shop Floor
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeJobs.length} active • {typedMachines.length} machines
          </p>
        </div>
        <div className="flex items-center gap-2">
          {usingSupabase && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Database className="w-3 h-3" />
              Cloud Data
            </Badge>
          )}
          <Link to="/shopfloor/live-monitor">
            <Button variant="outline" size="sm" className="gap-2">
              <Factory className="w-4 h-4" />
              <span className="hidden sm:inline">Live Monitor</span>
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </header>

      {/* Firebase error banner */}
      {firebaseFailed && (
        <div className="px-4 sm:px-6 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
          <span className="text-yellow-600 dark:text-yellow-400">
            Firebase unavailable — showing work orders from database.
          </span>
        </div>
      )}

      {/* Stats Bar */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-muted/30">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatCard 
            label="In Progress" 
            value={activeJobs.length} 
            icon={<Play className="w-4 h-4 text-blue-500" />}
          />
          <StatCard 
            label="Queued" 
            value={jobsByStatus["queued"]?.length || 0} 
            icon={<Clock className="w-4 h-4 text-yellow-500" />}
          />
          <StatCard 
            label="Completed" 
            value={jobsByStatus["complete"]?.length || jobsByStatus["completed"]?.length || 0} 
            icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
          />
          <StatCard 
            label={usingSupabase ? "Work Orders" : "Online"}
            value={usingSupabase ? typedJobs.length : typedMachines.filter(m => m.status !== "offline").length} 
            icon={<Factory className="w-4 h-4 text-primary" />}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-4 sm:px-6 pt-4">
            <TabsList>
              <TabsTrigger value="jobs">{usingSupabase ? "Work Orders" : "Jobs"}</TabsTrigger>
              {!usingSupabase && <TabsTrigger value="machines">Machines</TabsTrigger>}
              {!usingSupabase && <TabsTrigger value="queues">Queues</TabsTrigger>}
            </TabsList>
          </div>

          <TabsContent value="jobs" className="flex-1 overflow-hidden px-4 sm:px-6 pb-6">
            {isLoading ? (
              <LoadingState />
            ) : typedJobs.length === 0 ? (
              <EmptyState message={usingSupabase ? "No work orders found in database" : "No jobs found"} />
            ) : (
              <ScrollArea className="h-full">
                <div className="grid gap-3 pr-4">
                  {typedJobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {!usingSupabase && (
            <TabsContent value="machines" className="flex-1 overflow-hidden px-4 sm:px-6 pb-6">
              {isLoading ? (
                <LoadingState />
              ) : typedMachines.length === 0 ? (
                <EmptyState message="No machines found" />
              ) : (
                <ScrollArea className="h-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
                    {typedMachines.map((machine) => (
                      <MachineCard key={machine.id} machine={machine} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          )}

          {!usingSupabase && (
            <TabsContent value="queues" className="flex-1 overflow-hidden px-4 sm:px-6 pb-6">
              {isLoading ? (
                <LoadingState />
              ) : typedQueues.length === 0 ? (
                <EmptyState message="No queues found" />
              ) : (
                <ScrollArea className="h-full">
                  <div className="grid gap-4 pr-4">
                    {typedQueues.map((queue) => (
                      <QueueCard key={queue.id} queue={queue} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border">
      <div className="p-2 rounded-md bg-muted">{icon}</div>
      <div>
        <p className="text-xl sm:text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const status = (job.status || "pending").toLowerCase();
  return (
    <Card className="hover:bg-muted/30 transition-colors">
      <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm sm:text-base">{job.name || job.id}</span>
            <Badge className={statusColors[status] || statusColors.pending}>
              {status}
            </Badge>
            {job.priority && job.priority > 5 && (
              <Badge variant="outline" className="text-orange-500 border-orange-500">
                High Priority
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {job.customer && <span>Customer: {job.customer} • </span>}
            {job.machine && <span>Machine: {job.machine}</span>}
          </div>
        </div>
        <div className="flex gap-2 self-end sm:self-auto">
          {status === "queued" && (
            <Button size="sm" className="gap-1">
              <Play className="w-3 h-3" /> Start
            </Button>
          )}
          {(status === "in-progress" || status === "running") && (
            <>
              <Button size="sm" variant="outline" className="gap-1">
                <Pause className="w-3 h-3" /> Pause
              </Button>
              <Button size="sm" variant="default" className="gap-1">
                <CheckCircle2 className="w-3 h-3" /> Complete
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MachineCard({ machine }: { machine: Machine }) {
  const status = (machine.status || "idle").toLowerCase();
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          {machine.name || machine.id}
          <Badge className={machineStatusColors[status] || machineStatusColors.idle}>
            {status}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {machine.currentJob ? (
          <p className="text-sm text-muted-foreground">
            Running: <span className="text-foreground">{machine.currentJob}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No active job</p>
        )}
      </CardContent>
    </Card>
  );
}

function QueueCard({ queue }: { queue: Queue }) {
  const jobCount = queue.jobs?.length || 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{queue.name || queue.id}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {jobCount} job{jobCount !== 1 ? "s" : ""} in queue
        </p>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <p>{message}</p>
    </div>
  );
}
