import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { Users, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { QBEmployee, QBAccount } from "@/hooks/useQuickBooksData";

interface CorrectionLine {
  accountId: string;
  accountName: string;
  amount: string;
  type: "debit" | "credit";
  description: string;
}

interface Props {
  data: {
    employees: QBEmployee[];
    accounts: QBAccount[];
    loading: boolean;
    createPayrollCorrection: (body: Record<string, unknown>) => Promise<unknown>;
  };
}

export function AccountingPayroll({ data }: Props) {
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [correctionDate, setCorrectionDate] = useState(new Date().toISOString().split("T")[0]);
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<CorrectionLine[]>([
    { accountId: "", accountName: "", amount: "", type: "debit", description: "" },
    { accountId: "", accountName: "", amount: "", type: "credit", description: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const activeEmployees = data.employees.filter(e => e.Active);
  const inactiveEmployees = data.employees.filter(e => !e.Active);

  const filteredEmployees = data.employees.filter(e =>
    e.DisplayName.toLowerCase().includes(search.toLowerCase())
  );

  const selectedEmp = data.employees.find(e => e.Id === selectedEmployee);

  const payrollAccounts = data.accounts.filter(a =>
    a.AccountType === "Expense" || a.AccountType === "Other Current Liability" ||
    a.AccountType === "Other Expense" || a.AccountType === "Cost of Goods Sold"
  );

  const addLine = () => {
    setLines(prev => [...prev, { accountId: "", accountName: "", amount: "", type: "debit", description: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof CorrectionLine, value: string) => {
    setLines(prev => prev.map((line, i) => {
      if (i !== index) return line;
      if (field === "accountId") {
        const acct = data.accounts.find(a => a.Id === value);
        return { ...line, accountId: value, accountName: acct?.Name || "" };
      }
      return { ...line, [field]: value };
    }));
  };

  const totalDebits = lines.reduce((s, l) => l.type === "debit" ? s + (parseFloat(l.amount) || 0) : s, 0);
  const totalCredits = lines.reduce((s, l) => l.type === "credit" ? s + (parseFloat(l.amount) || 0) : s, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0;

  const canSubmit = selectedEmployee && isBalanced && lines.every(l => l.accountId && parseFloat(l.amount) > 0);

  const resetForm = () => {
    setSelectedEmployee("");
    setCorrectionDate(new Date().toISOString().split("T")[0]);
    setMemo("");
    setLines([
      { accountId: "", accountName: "", amount: "", type: "debit", description: "" },
      { accountId: "", accountName: "", amount: "", type: "credit", description: "" },
    ]);
  };

  const handleSubmit = async () => {
    if (!selectedEmp) return;
    setSubmitting(true);
    try {
      await data.createPayrollCorrection({
        employeeId: selectedEmp.Id,
        employeeName: selectedEmp.DisplayName,
        txnDate: correctionDate,
        memo,
        lines: lines.map(l => ({
          accountId: l.accountId,
          accountName: l.accountName,
          amount: parseFloat(l.amount),
          type: l.type,
          description: l.description,
        })),
      });
      setCorrectionOpen(false);
      resetForm();
    } catch {
      // toast handled by hook
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Total Employees</div>
            <div className="text-3xl font-bold mt-1">{data.employees.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Active</div>
            <div className="text-3xl font-bold mt-1 text-primary">{activeEmployees.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-sm text-muted-foreground">Inactive</div>
            <div className="text-3xl font-bold mt-1 text-muted-foreground">{inactiveEmployees.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Employee List + Actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5" /> Employees
          </CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Search employees..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-48"
            />
            <Button onClick={() => setCorrectionOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Payroll Correction
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">Hired</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {data.loading ? "Loading employees..." : "No employees found"}
                  </TableCell>
                </TableRow>
              )}
              {filteredEmployees.map(emp => (
                <TableRow key={emp.Id}>
                  <TableCell className="font-medium">{emp.DisplayName}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {emp.PrimaryEmailAddr?.Address || "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">
                    {emp.PrimaryPhone?.FreeFormNumber || "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {emp.HiredDate || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={emp.Active ? "default" : "secondary"}>
                      {emp.Active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payroll Correction Dialog */}
      <Dialog open={correctionOpen} onOpenChange={(open) => { if (!open) resetForm(); setCorrectionOpen(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Payroll Correction</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Employee Select */}
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  {activeEmployees.map(emp => (
                    <SelectItem key={emp.Id} value={emp.Id}>{emp.DisplayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Correction Date</Label>
              <Input type="date" value={correctionDate} onChange={e => setCorrectionDate(e.target.value)} />
            </div>

            {/* Journal Lines */}
            <div className="space-y-2">
              <Label>Journal Lines</Label>
              <div className="space-y-3">
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-[1fr_100px_100px_auto] gap-2 items-end">
                    <div>
                      <Label className="text-xs text-muted-foreground">Account</Label>
                      <Select value={line.accountId} onValueChange={v => updateLine(i, "accountId", v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {payrollAccounts.map(acct => (
                            <SelectItem key={acct.Id} value={acct.Id}>
                              {acct.Name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={line.amount}
                        onChange={e => updateLine(i, "amount", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Type</Label>
                      <Select value={line.type} onValueChange={v => updateLine(i, "type", v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="debit">Debit</SelectItem>
                          <SelectItem value="credit">Credit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => removeLine(i)}
                      disabled={lines.length <= 2}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addLine} className="mt-2 gap-1">
                <Plus className="w-3 h-3" /> Add Line
              </Button>
            </div>

            {/* Balance Check */}
            <div className="flex items-center gap-3 p-3 rounded-lg border">
              {isBalanced ? (
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              )}
              <div className="text-sm">
                <span className="font-medium">Debits:</span> ${totalDebits.toFixed(2)}
                <span className="mx-2">|</span>
                <span className="font-medium">Credits:</span> ${totalCredits.toFixed(2)}
                {!isBalanced && totalDebits > 0 && (
                  <span className="text-destructive ml-2">— Must be equal</span>
                )}
              </div>
            </div>

            {/* Memo */}
            <div className="space-y-2">
              <Label>Memo (optional)</Label>
              <Textarea
                placeholder="Reason for correction..."
                value={memo}
                onChange={e => setMemo(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionOpen(false)}>Cancel</Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={!canSubmit}
            >
              Review & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm Payroll Correction"
        description={`Create a journal entry for ${selectedEmp?.DisplayName || "employee"} with ${lines.length} lines totaling $${totalDebits.toFixed(2)} (debit) / $${totalCredits.toFixed(2)} (credit)?`}
        onConfirm={handleSubmit}
        loading={submitting}
        variant="default"
      />
    </div>
  );
}
