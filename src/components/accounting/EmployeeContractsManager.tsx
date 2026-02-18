import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, Award, Plus, AlertTriangle, Clock, Search,
  DollarSign, Users, ShieldCheck,
} from "lucide-react";
import { useEmployeeContracts } from "@/hooks/useEmployeeContracts";
import type { EmployeeContract, EmployeeCertification, SalaryHistory } from "@/hooks/useEmployeeContracts";

/* ── Helpers ── */
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function fmtCurrency(n: number, cur = "AUD") {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function statusColor(s: string) {
  switch (s) {
    case "active": return "default";
    case "expired": return "destructive";
    case "terminated": return "destructive";
    case "on_hold": return "secondary";
    default: return "outline";
  }
}

/* ── Main Component ── */
export function EmployeeContractsManager() {
  const hook = useEmployeeContracts();
  const [search, setSearch] = useState("");
  const [showContractDialog, setShowContractDialog] = useState(false);
  const [showCertDialog, setShowCertDialog] = useState(false);
  const [showSalaryDialog, setShowSalaryDialog] = useState(false);
  const [selectedContract, setSelectedContract] = useState<EmployeeContract | null>(null);

  // Form state - contracts
  const [cForm, setCForm] = useState({
    employee_name: "", employee_email: "", position: "", department: "",
    contract_type: "permanent", start_date: "", end_date: "",
    salary: "", salary_currency: "AUD", pay_frequency: "monthly",
    probation_end_date: "", notice_period_days: "30", notes: "",
  });

  // Form state - certifications
  const [certForm, setCertForm] = useState({
    employee_name: "", employee_email: "", certification_name: "",
    issuing_body: "", certificate_number: "", issued_date: "",
    expiry_date: "", reminder_days: "30", notes: "",
  });

  // Form state - salary change
  const [salaryForm, setSalaryForm] = useState({
    new_salary: "", effective_date: "", reason: "",
  });

  const filteredContracts = useMemo(() => {
    const q = search.toLowerCase();
    return hook.contracts.filter(c =>
      c.employee_name.toLowerCase().includes(q) ||
      c.position.toLowerCase().includes(q) ||
      (c.department || "").toLowerCase().includes(q)
    );
  }, [hook.contracts, search]);

  const filteredCerts = useMemo(() => {
    const q = search.toLowerCase();
    return hook.certifications.filter(c =>
      c.employee_name.toLowerCase().includes(q) ||
      c.certification_name.toLowerCase().includes(q)
    );
  }, [hook.certifications, search]);

  const handleCreateContract = async () => {
    const ok = await hook.createContract({
      company_id: "default",
      employee_name: cForm.employee_name,
      employee_email: cForm.employee_email || null,
      position: cForm.position,
      department: cForm.department || null,
      contract_type: cForm.contract_type,
      start_date: cForm.start_date,
      end_date: cForm.end_date || null,
      salary: parseFloat(cForm.salary) || 0,
      salary_currency: cForm.salary_currency,
      pay_frequency: cForm.pay_frequency,
      probation_end_date: cForm.probation_end_date || null,
      notice_period_days: parseInt(cForm.notice_period_days) || 30,
      notes: cForm.notes || null,
      status: "active",
    });
    if (ok) setShowContractDialog(false);
  };

  const handleCreateCert = async () => {
    const ok = await hook.createCertification({
      company_id: "default",
      employee_name: certForm.employee_name,
      employee_email: certForm.employee_email || null,
      certification_name: certForm.certification_name,
      issuing_body: certForm.issuing_body || null,
      certificate_number: certForm.certificate_number || null,
      issued_date: certForm.issued_date || null,
      expiry_date: certForm.expiry_date || null,
      status: "active",
      reminder_days: parseInt(certForm.reminder_days) || 30,
      notes: certForm.notes || null,
      document_url: null,
    });
    if (ok) setShowCertDialog(false);
  };

  const handleSalaryChange = async () => {
    if (!selectedContract) return;
    const ok = await hook.addSalaryChange({
      contract_id: selectedContract.id,
      effective_date: salaryForm.effective_date,
      previous_salary: selectedContract.salary,
      new_salary: parseFloat(salaryForm.new_salary) || 0,
      reason: salaryForm.reason || null,
    });
    if (ok) {
      setShowSalaryDialog(false);
      setSelectedContract(null);
    }
  };

  const openSalaryDialog = (contract: EmployeeContract) => {
    setSelectedContract(contract);
    setSalaryForm({ new_salary: "", effective_date: new Date().toISOString().split("T")[0], reason: "" });
    hook.loadSalaryHistory(contract.id);
    setShowSalaryDialog(true);
  };

  const activeContracts = hook.contracts.filter(c => c.status === "active").length;
  const renewalsDue = hook.contracts.filter(c => c.end_date && daysUntil(c.end_date) <= 60 && daysUntil(c.end_date) >= 0).length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          <div><div className="text-2xl font-bold">{activeContracts}</div><div className="text-xs text-muted-foreground">Active Contracts</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Clock className="w-8 h-8 text-amber-500" />
          <div><div className="text-2xl font-bold">{renewalsDue}</div><div className="text-xs text-muted-foreground">Renewals Due (60d)</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-emerald-500" />
          <div><div className="text-2xl font-bold">{hook.certifications.filter(c => c.status === "active").length}</div><div className="text-xs text-muted-foreground">Active Certs</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
          <div><div className="text-2xl font-bold">{hook.expiringCerts.length}</div><div className="text-xs text-muted-foreground">Expiring Soon</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-destructive" />
          <div><div className="text-2xl font-bold">{hook.expiredCerts.length}</div><div className="text-xs text-muted-foreground">Expired Certs</div></div>
        </CardContent></Card>
      </div>

      {/* Search + actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search employees, positions, certs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { setCForm({ employee_name: "", employee_email: "", position: "", department: "", contract_type: "permanent", start_date: "", end_date: "", salary: "", salary_currency: "AUD", pay_frequency: "monthly", probation_end_date: "", notice_period_days: "30", notes: "" }); setShowContractDialog(true); }} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Contract
        </Button>
        <Button onClick={() => { setCertForm({ employee_name: "", employee_email: "", certification_name: "", issuing_body: "", certificate_number: "", issued_date: "", expiry_date: "", reminder_days: "30", notes: "" }); setShowCertDialog(true); }} size="sm" variant="outline" className="gap-1.5">
          <Plus className="w-4 h-4" /> Certification
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="contracts">
        <TabsList>
          <TabsTrigger value="contracts" className="gap-1.5"><FileText className="w-4 h-4" /> Contracts ({hook.contracts.length})</TabsTrigger>
          <TabsTrigger value="certifications" className="gap-1.5"><Award className="w-4 h-4" /> Certifications ({hook.certifications.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="contracts">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>End</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No contracts found</TableCell></TableRow>
                  )}
                  {filteredContracts.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.employee_name}</div>
                        {c.employee_email && <div className="text-xs text-muted-foreground">{c.employee_email}</div>}
                      </TableCell>
                      <TableCell>
                        <div>{c.position}</div>
                        {c.department && <div className="text-xs text-muted-foreground">{c.department}</div>}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{c.contract_type}</Badge></TableCell>
                      <TableCell className="text-sm">{fmtDate(c.start_date)}</TableCell>
                      <TableCell className="text-sm">
                        {c.end_date ? (
                          <span className={daysUntil(c.end_date) <= 60 ? "text-amber-600 font-medium" : ""}>
                            {fmtDate(c.end_date)}
                            {daysUntil(c.end_date) <= 60 && daysUntil(c.end_date) >= 0 && (
                              <span className="block text-xs">({daysUntil(c.end_date)}d left)</span>
                            )}
                          </span>
                        ) : "Ongoing"}
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmtCurrency(c.salary, c.salary_currency)}</TableCell>
                      <TableCell><Badge variant={statusColor(c.status)} className="capitalize">{c.status}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openSalaryDialog(c)}>
                          <DollarSign className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certifications">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Certification</TableHead>
                    <TableHead>Issuing Body</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCerts.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No certifications found</TableCell></TableRow>
                  )}
                  {filteredCerts.map(c => {
                    const isExpired = c.expiry_date && new Date(c.expiry_date) < new Date();
                    const isExpiring = c.expiry_date && !isExpired && daysUntil(c.expiry_date) <= c.reminder_days;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium">{c.employee_name}</div>
                          {c.employee_email && <div className="text-xs text-muted-foreground">{c.employee_email}</div>}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{c.certification_name}</div>
                          {c.certificate_number && <div className="text-xs text-muted-foreground">#{c.certificate_number}</div>}
                        </TableCell>
                        <TableCell className="text-sm">{c.issuing_body || "—"}</TableCell>
                        <TableCell className="text-sm">{fmtDate(c.issued_date)}</TableCell>
                        <TableCell>
                          {c.expiry_date ? (
                            <span className={isExpired ? "text-destructive font-medium" : isExpiring ? "text-amber-600 font-medium" : ""}>
                              {fmtDate(c.expiry_date)}
                              {isExpired && <span className="block text-xs">EXPIRED</span>}
                              {isExpiring && <span className="block text-xs">({daysUntil(c.expiry_date!)}d left)</span>}
                            </span>
                          ) : "No expiry"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isExpired ? "destructive" : isExpiring ? "secondary" : "default"} className="capitalize">
                            {isExpired ? "expired" : isExpiring ? "expiring" : c.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Contract Dialog */}
      <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Employee Contract</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Employee Name *</Label><Input value={cForm.employee_name} onChange={e => setCForm(f => ({ ...f, employee_name: e.target.value }))} /></div>
              <div><Label>Email</Label><Input type="email" value={cForm.employee_email} onChange={e => setCForm(f => ({ ...f, employee_email: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Position *</Label><Input value={cForm.position} onChange={e => setCForm(f => ({ ...f, position: e.target.value }))} /></div>
              <div><Label>Department</Label><Input value={cForm.department} onChange={e => setCForm(f => ({ ...f, department: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contract Type</Label>
                <Select value={cForm.contract_type} onValueChange={v => setCForm(f => ({ ...f, contract_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">Permanent</SelectItem>
                    <SelectItem value="fixed_term">Fixed Term</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="contractor">Contractor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Pay Frequency</Label>
                <Select value={cForm.pay_frequency} onValueChange={v => setCForm(f => ({ ...f, pay_frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Start Date *</Label><Input type="date" value={cForm.start_date} onChange={e => setCForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div><Label>End Date</Label><Input type="date" value={cForm.end_date} onChange={e => setCForm(f => ({ ...f, end_date: e.target.value }))} /></div>
              <div><Label>Probation End</Label><Input type="date" value={cForm.probation_end_date} onChange={e => setCForm(f => ({ ...f, probation_end_date: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Salary *</Label><Input type="number" value={cForm.salary} onChange={e => setCForm(f => ({ ...f, salary: e.target.value }))} /></div>
              <div><Label>Currency</Label><Input value={cForm.salary_currency} onChange={e => setCForm(f => ({ ...f, salary_currency: e.target.value }))} /></div>
              <div><Label>Notice (days)</Label><Input type="number" value={cForm.notice_period_days} onChange={e => setCForm(f => ({ ...f, notice_period_days: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={cForm.notes} onChange={e => setCForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContractDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateContract} disabled={!cForm.employee_name || !cForm.position || !cForm.start_date}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Certification Dialog */}
      <Dialog open={showCertDialog} onOpenChange={setShowCertDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Certification</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Employee Name *</Label><Input value={certForm.employee_name} onChange={e => setCertForm(f => ({ ...f, employee_name: e.target.value }))} /></div>
              <div><Label>Email</Label><Input type="email" value={certForm.employee_email} onChange={e => setCertForm(f => ({ ...f, employee_email: e.target.value }))} /></div>
            </div>
            <div><Label>Certification Name *</Label><Input value={certForm.certification_name} onChange={e => setCertForm(f => ({ ...f, certification_name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Issuing Body</Label><Input value={certForm.issuing_body} onChange={e => setCertForm(f => ({ ...f, issuing_body: e.target.value }))} /></div>
              <div><Label>Certificate #</Label><Input value={certForm.certificate_number} onChange={e => setCertForm(f => ({ ...f, certificate_number: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Issued Date</Label><Input type="date" value={certForm.issued_date} onChange={e => setCertForm(f => ({ ...f, issued_date: e.target.value }))} /></div>
              <div><Label>Expiry Date</Label><Input type="date" value={certForm.expiry_date} onChange={e => setCertForm(f => ({ ...f, expiry_date: e.target.value }))} /></div>
              <div><Label>Reminder (days)</Label><Input type="number" value={certForm.reminder_days} onChange={e => setCertForm(f => ({ ...f, reminder_days: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={certForm.notes} onChange={e => setCertForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCertDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateCert} disabled={!certForm.employee_name || !certForm.certification_name}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salary Change Dialog */}
      <Dialog open={showSalaryDialog} onOpenChange={setShowSalaryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salary Change — {selectedContract?.employee_name}</DialogTitle>
          </DialogHeader>
          {selectedContract && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                Current: <span className="font-bold">{fmtCurrency(selectedContract.salary, selectedContract.salary_currency)}</span> / {selectedContract.pay_frequency}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>New Salary *</Label><Input type="number" value={salaryForm.new_salary} onChange={e => setSalaryForm(f => ({ ...f, new_salary: e.target.value }))} /></div>
                <div><Label>Effective Date *</Label><Input type="date" value={salaryForm.effective_date} onChange={e => setSalaryForm(f => ({ ...f, effective_date: e.target.value }))} /></div>
              </div>
              <div><Label>Reason</Label><Input value={salaryForm.reason} onChange={e => setSalaryForm(f => ({ ...f, reason: e.target.value }))} placeholder="Annual review, promotion..." /></div>

              {hook.salaryHistory.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Salary History</h4>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {hook.salaryHistory.map(h => (
                      <div key={h.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                        <span>{fmtDate(h.effective_date)}</span>
                        <span className="text-muted-foreground">{h.previous_salary ? fmtCurrency(h.previous_salary) : "—"} → </span>
                        <span className="font-medium">{fmtCurrency(h.new_salary)}</span>
                        {h.reason && <span className="text-xs text-muted-foreground ml-2">{h.reason}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSalaryDialog(false)}>Cancel</Button>
            <Button onClick={handleSalaryChange} disabled={!salaryForm.new_salary || !salaryForm.effective_date}>Save Change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
