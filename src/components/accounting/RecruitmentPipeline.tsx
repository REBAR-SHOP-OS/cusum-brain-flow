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
import { useRecruitment, APPLICANT_STAGES, ApplicantStage } from "@/hooks/useRecruitment";
import { Briefcase, Plus, Users, Star, ChevronRight, Mail, Phone, Search, Loader2 } from "lucide-react";

function StageColumn({ stage, applicants, onMove }: {
  stage: typeof APPLICANT_STAGES[number];
  applicants: any[];
  onMove: (id: string, stage: ApplicantStage) => void;
}) {
  const nextStage = APPLICANT_STAGES[APPLICANT_STAGES.findIndex(s => s.key === stage.key) + 1];

  return (
    <div className="min-w-[220px] w-[220px] shrink-0 flex flex-col gap-2">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stage.label}</span>
        <Badge variant="secondary" className="ml-auto text-[10px] h-5">{applicants.length}</Badge>
      </div>
      <ScrollArea className="flex-1 max-h-[60vh]">
        <div className="space-y-2 px-1">
          {applicants.map(app => (
            <Card key={app.id} className="shadow-sm hover:shadow-md transition-shadow cursor-default">
              <CardContent className="p-3 space-y-2">
                <p className="text-sm font-medium leading-tight">{app.first_name} {app.last_name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{(app as any).job_positions?.title}</p>
                {app.email && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Mail className="w-3 h-3" /> <span className="truncate">{app.email}</span>
                  </div>
                )}
                {app.rating > 0 && (
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: app.rating }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                )}
                {nextStage && stage.key !== "hired" && stage.key !== "rejected" && (
                  <Button
                    variant="ghost" size="sm"
                    className="w-full text-xs h-7 mt-1"
                    onClick={() => onMove(app.id, nextStage.key)}
                  >
                    Move to {nextStage.label} <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
                {stage.key !== "rejected" && stage.key !== "hired" && (
                  <Button
                    variant="ghost" size="sm"
                    className="w-full text-xs h-7 text-destructive hover:text-destructive"
                    onClick={() => onMove(app.id, "rejected")}
                  >
                    Reject
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {applicants.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No applicants</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function RecruitmentPipeline() {
  const { positions, applicants, isLoading, createPosition, createApplicant, moveApplicant } = useRecruitment();
  const [tab, setTab] = useState("pipeline");
  const [posDialog, setPosDialog] = useState(false);
  const [appDialog, setAppDialog] = useState(false);
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Position form
  const [posForm, setPosForm] = useState({ title: "", department: "", location: "", employment_type: "full_time", description: "" });
  // Applicant form
  const [appForm, setAppForm] = useState({ position_id: "", first_name: "", last_name: "", email: "", phone: "", source: "direct", notes: "" });

  const filteredApplicants = useMemo(() => {
    let list = applicants;
    if (filterPosition !== "all") list = list.filter(a => a.position_id === filterPosition);
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(a => `${a.first_name} ${a.last_name}`.toLowerCase().includes(s) || a.email?.toLowerCase().includes(s));
    }
    return list;
  }, [applicants, filterPosition, search]);

  const openPositions = positions.filter(p => p.status === "open").length;
  const totalApplicants = applicants.length;
  const hiredCount = applicants.filter(a => a.stage === "hired").length;

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{openPositions}</p><p className="text-xs text-muted-foreground">Open Positions</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{totalApplicants}</p><p className="text-xs text-muted-foreground">Total Applicants</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{applicants.filter(a => ["phone_interview","technical_interview","final_interview"].includes(a.stage)).length}</p><p className="text-xs text-muted-foreground">In Interview</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{hiredCount}</p><p className="text-xs text-muted-foreground">Hired</p></CardContent></Card>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Dialog open={posDialog} onOpenChange={setPosDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> New Position</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Job Position</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title *</Label><Input value={posForm.title} onChange={e => setPosForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Shop Foreman" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Department</Label><Input value={posForm.department} onChange={e => setPosForm(f => ({ ...f, department: e.target.value }))} /></div>
                <div><Label>Location</Label><Input value={posForm.location} onChange={e => setPosForm(f => ({ ...f, location: e.target.value }))} /></div>
              </div>
              <div><Label>Type</Label>
                <Select value={posForm.employment_type} onValueChange={v => setPosForm(f => ({ ...f, employment_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full_time">Full Time</SelectItem>
                    <SelectItem value="part_time">Part Time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Textarea value={posForm.description} onChange={e => setPosForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
              <Button className="w-full" disabled={!posForm.title || createPosition.isPending} onClick={() => {
                createPosition.mutate(posForm, { onSuccess: () => { setPosDialog(false); setPosForm({ title: "", department: "", location: "", employment_type: "full_time", description: "" }); } });
              }}>
                {createPosition.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Create Position
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={appDialog} onOpenChange={setAppDialog}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1"><Users className="w-4 h-4" /> Add Applicant</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Applicant</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Position *</Label>
                <Select value={appForm.position_id} onValueChange={v => setAppForm(f => ({ ...f, position_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                  <SelectContent>{positions.filter(p => p.status === "open").map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>First Name *</Label><Input value={appForm.first_name} onChange={e => setAppForm(f => ({ ...f, first_name: e.target.value }))} /></div>
                <div><Label>Last Name *</Label><Input value={appForm.last_name} onChange={e => setAppForm(f => ({ ...f, last_name: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" value={appForm.email} onChange={e => setAppForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>Phone</Label><Input value={appForm.phone} onChange={e => setAppForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div><Label>Source</Label>
                <Select value={appForm.source} onValueChange={v => setAppForm(f => ({ ...f, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">Direct</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="job_board">Job Board</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes</Label><Textarea value={appForm.notes} onChange={e => setAppForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
              <Button className="w-full" disabled={!appForm.position_id || !appForm.first_name || !appForm.last_name || createApplicant.isPending} onClick={() => {
                createApplicant.mutate(appForm, { onSuccess: () => { setAppDialog(false); setAppForm({ position_id: "", first_name: "", last_name: "", email: "", phone: "", source: "direct", notes: "" }); } });
              }}>
                {createApplicant.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Add Applicant
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input className="pl-8 h-9 w-48 text-sm" placeholder="Search applicants..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterPosition} onValueChange={setFilterPosition}>
            <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="All positions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Positions</SelectItem>
              {positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="positions">Positions ({positions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-3">
          <div className="flex gap-3 overflow-x-auto pb-4">
            {APPLICANT_STAGES.map(stage => (
              <StageColumn
                key={stage.key}
                stage={stage}
                applicants={filteredApplicants.filter(a => a.stage === stage.key)}
                onMove={(id, s) => moveApplicant.mutate({ id, stage: s })}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="positions" className="mt-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {positions.map(pos => {
              const count = applicants.filter(a => a.position_id === pos.id).length;
              return (
                <Card key={pos.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm">{pos.title}</CardTitle>
                      <Badge variant={pos.status === "open" ? "default" : "secondary"} className="text-[10px]">{pos.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {pos.department && <p className="text-xs text-muted-foreground"><Briefcase className="w-3 h-3 inline mr-1" />{pos.department}</p>}
                    {pos.location && <p className="text-xs text-muted-foreground">{pos.location}</p>}
                    <p className="text-xs"><Badge variant="outline" className="text-[10px]">{pos.employment_type?.replace("_", " ")}</Badge></p>
                    <p className="text-xs text-muted-foreground mt-2">{count} applicant{count !== 1 ? "s" : ""}</p>
                  </CardContent>
                </Card>
              );
            })}
            {positions.length === 0 && <p className="text-sm text-muted-foreground col-span-full text-center py-10">No positions yet. Create one to start recruiting.</p>}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
