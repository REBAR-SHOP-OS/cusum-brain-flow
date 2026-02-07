import { useState, useEffect } from "react";
import { useLiveMonitorData } from "@/hooks/useLiveMonitorData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Scissors, Circle, Activity, Play, ChevronRight, Clock, CheckCircle2, Truck } from "lucide-react";

const machineTypeIcon: Record<string, React.ElementType> = {
  cutter: Scissors,
  bender: Circle,
  transport: Truck,
};

// Mock production ledger data (would come from DB in production)
const mockLedger = [
  { name: "CAGES", status: "staged", progress: 244, total: 36, completed: 88, time: "14HR 43M 45S" },
  { name: "952 SOUTHDALE RD", status: "staged", progress: 195, total: 784, completed: 1548, time: "13HR 34M 26S" },
  { name: "23 HALFORD ROAD - HAB (3)", status: "active", progress: 3, total: 359, completed: 12, time: "83H 35M 55S" },
];

const mockClearances = [
  { label: "952 SOUTHDALE RD", sub: "FABRICATION COMPLETE.", time: "01:17PM", color: "bg-blue-500" },
  { label: "CAGES", sub: "FABRICATION COMPLETE.", time: "01:17PM", color: "bg-green-500" },
  { label: "BTM_1430 BIRCH MOUNT RD", sub: "DELIVERY COMPLETE.", time: "01:05 AM", color: "bg-orange-500" },
  { label: "BTL_1430 BIRCH MOUNT RD", sub: "DELIVERY COMPLETE.", time: "01:05 AM", color: "bg-purple-500" },
  { label: "DRAWING PROJECT 1/13/2026", sub: "DELIVERY COMPLETE.", time: "01:04 AM", color: "bg-blue-500" },
  { label: "DOWEL AND STRAIGHT", sub: "DELIVERY COMPLETE.", time: "01:04 AM", color: "bg-orange-500" },
  { label: "10 MM STRAIGHTS", sub: "DELIVERY COMPLETE.", time: "01:04 AM", color: "bg-teal-500" },
  { label: "STANDIES", sub: "DELIVERY COMPLETE.", time: "01:04 AM", color: "bg-pink-500" },
];

export function LiveMonitorView() {
  const { machines, isLoading } = useLiveMonitorData();
  const [tonnage, setTonnage] = useState(17885.8);
  const [pcsLogged, setPcsLogged] = useState(8262);

  // Simulated live counter tick
  useEffect(() => {
    const interval = setInterval(() => {
      setTonnage(prev => prev + Math.random() * 0.3);
      setPcsLogged(prev => prev + (Math.random() > 0.7 ? 1 : 0));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const engagedMachines = machines.filter(m => m.status === "running");

  return (
    <div className="flex flex-col h-full">
      {/* Hero Banner */}
      <div className="bg-[hsl(220,25%,12%)] text-white px-8 py-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] tracking-[0.3em] text-green-400 uppercase font-medium">
              Production Monitor · Live
            </span>
          </div>
          <h1 className="text-3xl font-black italic tracking-tight uppercase">Shop Floor HUD</h1>
        </div>
        <div className="flex items-center gap-10">
          <div className="text-right">
            <p className="text-[10px] tracking-[0.2em] text-white/50 uppercase">Real-Time Tonnage</p>
            <p className="text-4xl font-black italic tabular-nums">
              {tonnage.toFixed(1)} <span className="text-base font-medium text-white/60">KG</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-[0.2em] text-white/50 uppercase">PCS Logged</p>
            <p className="text-4xl font-black italic tabular-nums">
              {pcsLogged} <span className="text-base font-medium text-white/60">PCS</span>
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-8">
          {/* Machine Cards Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">
                Shop Units Real-Time
              </h2>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2">
              {isLoading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="w-[200px] h-[180px] rounded-xl bg-muted animate-pulse shrink-0" />
                ))
              ) : machines.length === 0 ? (
                // Default machine layout if none in DB
                ["CUTTER 1", "CUTTER 2", "BENDER 1", "BENDER 2", "BENDER 3", "BENDER 4", "TRANSPORT"].map((name, i) => {
                  const isEngaged = i < 2;
                  return (
                    <Card key={name} className={`w-[200px] shrink-0 ${isEngaged ? "border-primary/40 shadow-lg" : "border-border/50 opacity-50"}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isEngaged ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                              <Scissors className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase">{name}</p>
                              <p className={`text-[10px] font-semibold uppercase ${isEngaged ? "text-green-500" : "text-muted-foreground"}`}>
                                {isEngaged ? "ENGAGED" : "OFFLINE"}
                              </p>
                            </div>
                          </div>
                          {isEngaged && (
                            <Badge variant="secondary" className="text-[9px] uppercase tracking-widest">
                              Cutting
                            </Badge>
                          )}
                        </div>

                        {isEngaged && (
                          <>
                            <div className="bg-primary/10 rounded-lg p-3 flex items-center justify-between">
                              <div>
                                <p className="text-[9px] text-muted-foreground uppercase">Active Mark</p>
                                <p className="text-lg font-black text-foreground">{i === 0 ? "A1014" : "C20"}</p>
                              </div>
                              <Badge className="text-[9px]">{i === 0 ? "6M" : "3M"}</Badge>
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">{i === 0 ? "0/6 PCS" : "18/18 PCS"}</span>
                              <span className="text-muted-foreground">{i === 0 ? "0%" : "100%"}</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground/70 truncate uppercase">
                              {i === 0 ? "23 HALFORD ROAD - HAB (3)" : "CAGES"}
                            </p>
                          </>
                        )}

                        {!isEngaged && (
                          <div className="flex items-center justify-center py-4">
                            <div className="w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                              <span className="text-lg text-muted-foreground/40">⟨⟩</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                machines.map((machine) => {
                  const isEngaged = machine.status === "running";
                  const Icon = machineTypeIcon[machine.type] || Scissors;
                  return (
                    <Card key={machine.id} className={`w-[200px] shrink-0 ${isEngaged ? "border-primary/40 shadow-lg" : "border-border/50 opacity-50"}`}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isEngaged ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase">{machine.name}</p>
                              <p className={`text-[10px] font-semibold uppercase ${isEngaged ? "text-green-500" : "text-muted-foreground"}`}>
                                {isEngaged ? "ENGAGED" : machine.status.toUpperCase()}
                              </p>
                            </div>
                          </div>
                          {isEngaged && (
                            <Badge variant="secondary" className="text-[9px] uppercase tracking-widest">
                              {machine.type}
                            </Badge>
                          )}
                        </div>

                        {isEngaged && machine.current_run ? (
                          <>
                            <div className="bg-primary/10 rounded-lg p-3">
                              <p className="text-[9px] text-muted-foreground uppercase">Active</p>
                              <p className="text-lg font-black text-foreground">{machine.current_run.process}</p>
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center py-4">
                            <div className="w-10 h-10 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                              <span className="text-lg text-muted-foreground/40">⟨⟩</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </section>

          {/* Production Ledger + Process Clearances */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
            {/* Production Ledger */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-green-500" />
                  <h2 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">
                    Production Ledger
                  </h2>
                </div>
                <span className="text-[10px] tracking-widest text-muted-foreground uppercase">
                  {mockLedger.length} Jobs Monitoring
                </span>
              </div>

              <div className="space-y-4">
                {mockLedger.map((job) => (
                  <Card key={job.name} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-black uppercase text-foreground">{job.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={job.status === "active" ? "default" : "secondary"} className="text-[9px] uppercase tracking-widest">
                              {job.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {job.time}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-black italic text-foreground">{job.progress}%</p>
                        </div>
                      </div>

                      <div className="w-full bg-muted rounded-full h-2 mb-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(job.progress, 100)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Circle className="w-3 h-3" /> {job.completed} / {job.total} UNITS
                        </span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Process Clearances */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-black tracking-[0.2em] text-foreground uppercase">
                  Process Clearances
                </h2>
              </div>

              <div className="space-y-1">
                {mockClearances.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
                    <div className={`w-7 h-7 rounded-full ${item.color} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                      {item.label.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate uppercase">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{item.sub}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">{item.time}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
