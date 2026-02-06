import { useState } from "react";
import { useJobs, useMachines, useQueues } from "@/hooks/useFirebaseCollection";
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
  RefreshCw
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
  const { data: jobs, loading: jobsLoading, error: jobsError } = useJobs();
  const { data: machines, loading: machinesLoading } = useMachines();
  const { data: queues, loading: queuesLoading } = useQueues();
  const [activeTab, setActiveTab] = useState("jobs");

  const isLoading = jobsLoading || machinesLoading || queuesLoading;

  const typedJobs = jobs as Job[];
  const typedMachines = machines as Machine[];
  const typedQueues = queues as Queue[];

  // Group jobs by status
  const jobsByStatus = typedJobs.reduce((acc, job) => {
    const status = (job.status || "pending").toLowerCase();
    if (!acc[status]) acc[status] = [];
    acc[status].push(job);
    return acc;
  }, {} as Record<string, Job[]>);

  const activeJobs = typedJobs.filter(j => 
    ["in-progress", "running"].includes((j.status || "").toLowerCase())
  );

  if (jobsError) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-lg font-semibold mb-2">Failed to load shop floor data</h2>
          <p className="text-muted-foreground text-sm">{jobsError.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Factory className="w-5 h-5" />
            Shop Floor
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeJobs.length} active jobs • {typedMachines.length} machines
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </header>

      {/* Stats Bar */}
      <div className="px-6 py-4 border-b border-border bg-muted/30">
        <div className="grid grid-cols-4 gap-4">
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
            label="Completed Today" 
            value={jobsByStatus["complete"]?.length || jobsByStatus["completed"]?.length || 0} 
            icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
          />
          <StatCard 
            label="Machines Online" 
            value={typedMachines.filter(m => m.status !== "offline").length} 
            icon={<Factory className="w-4 h-4 text-primary" />}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="px-6 pt-4">
            <TabsList>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
              <TabsTrigger value="machines">Machines</TabsTrigger>
              <TabsTrigger value="queues">Queues</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="jobs" className="flex-1 overflow-hidden px-6 pb-6">
            {isLoading ? (
              <LoadingState />
            ) : typedJobs.length === 0 ? (
              <EmptyState message="No jobs found in Firebase" />
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

          <TabsContent value="machines" className="flex-1 overflow-hidden px-6 pb-6">
            {isLoading ? (
              <LoadingState />
            ) : typedMachines.length === 0 ? (
              <EmptyState message="No machines found in Firebase" />
            ) : (
              <ScrollArea className="h-full">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
                  {typedMachines.map((machine) => (
                    <MachineCard key={machine.id} machine={machine} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="queues" className="flex-1 overflow-hidden px-6 pb-6">
            {isLoading ? (
              <LoadingState />
            ) : typedQueues.length === 0 ? (
              <EmptyState message="No queues found in Firebase" />
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
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const status = (job.status || "pending").toLowerCase();
  return (
    <Card className="hover:bg-muted/30 transition-colors">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium">{job.name || job.id}</span>
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
        <div className="flex gap-2">
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
