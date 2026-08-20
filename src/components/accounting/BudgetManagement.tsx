import { useState } from "react";
import { useBudgets, Budget } from "@/hooks/useBudgets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown, Target } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_KEYS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"] as const;

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const CATEGORIES = [
  { value: "revenue", label: "Revenue" },
  { value: "expense", label: "Expense" },
  { value: "cogs", label: "Cost of Goods Sold" },
  { value: "payroll", label: "Payroll" },
  { value: "marketing", label: "Marketing" },
  { value: "operations", label: "Operations" },
  { value: "other", label: "Other" },
];

interface BudgetFormData {
  name: string;
  account_category: string;
  department: string;
  notes: string;
  months: number[];
}

const emptyForm: BudgetFormData = {
  name: "", account_category: "expense", department: "", notes: "",
  months: Array(12).fill(0),
};

export function BudgetManagement() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const { budgets, isLoading, createBudget, updateBudget, deleteBudget, MONTHS } = useBudgets(year);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetFormData>(emptyForm);

  const currentMonth = new Date().getMonth(); // 0-indexed

  const openCreate = () => { setForm(emptyForm); setEditId(null); setShowForm(true); };
  const openEdit = (b: Budget) => {
    setForm({
      name: b.name,
      account_category: b.account_category || "expense",
      department: b.department || "",
      notes: b.notes || "",
      months: MONTH_KEYS.map(k => Number(b[k]) || 0),
    });
    setEditId(b.id);
    setShowForm(true);
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = {
      name: form.name,
      account_category: form.account_category || null,
      department: form.department || null,
      notes: form.notes || null,
    };
    MONTH_KEYS.forEach((k, i) => { payload[k] = form.months[i] || 0; });

    if (editId) {
      updateBudget.mutate({ id: editId, ...payload } as Partial<Budget> & { id: string });
    } else {
      createBudget.mutate(payload as Partial<Budget> & { name: string });
    }
    setShowForm(false);
  };

  const applyUniform = (val: number) => {
    setForm(f => ({ ...f, months: Array(12).fill(val) }));
  };

  // Summary calculations
  const summaryByCategory = budgets.reduce((acc, b) => {
    const cat = b.account_category || "other";
    if (!acc[cat]) acc[cat] = { budgeted: 0, ytd: 0 };
    const total = MONTH_KEYS.reduce((s, k) => s + Number(b[k] || 0), 0);
    const ytd = MONTH_KEYS.slice(0, currentMonth + 1).reduce((s, k) => s + Number(b[k] || 0), 0);
    acc[cat].budgeted += total;
    acc[cat].ytd += ytd;
    return acc;
  }, {} as Record<string, { budgeted: number; ytd: number }>);

  const totalBudgeted = Object.values(summaryByCategory).reduce((s, c) => s + c.budgeted, 0);
  const totalYtd = Object.values(summaryByCategory).reduce((s, c) => s + c.ytd, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" /> Budget Management
          </h2>
          <p className="text-sm text-muted-foreground">Set and track budgets by category and department</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate} size="sm" className="gap-1">
            <Plus className="w-4 h-4" /> New Budget
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Annual Budget</p>
            <p className="text-2xl font-bold mt-1">{fmt(totalBudgeted)}</p>
            <p className="text-xs text-muted-foreground">{budgets.length} budget line(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">YTD Budgeted</p>
            <p className="text-2xl font-bold mt-1">{fmt(totalYtd)}</p>
            <p className="text-xs text-muted-foreground">Through {MONTH_LABELS[currentMonth]}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Categories</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(summaryByCategory).map(([cat, { budgeted }]) => (
                <Badge key={cat} variant="outline" className="text-xs">
                  {cat}: {fmt(budgeted)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Budget Lines — {year}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Name</TableHead>
                  <TableHead className="min-w-[90px]">Category</TableHead>
                  <TableHead className="min-w-[90px]">Dept</TableHead>
                  {MONTH_LABELS.map(m => (
                    <TableHead key={m} className="text-right min-w-[80px]">{m}</TableHead>
                  ))}
                  <TableHead className="text-right min-w-[100px] font-bold">Total</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={16} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : budgets.length === 0 ? (
                  <TableRow><TableCell colSpan={16} className="text-center py-8 text-muted-foreground">No budgets for {year}. Click "New Budget" to get started.</TableCell></TableRow>
                ) : budgets.map(b => {
                  const total = MONTH_KEYS.reduce((s, k) => s + Number(b[k] || 0), 0);
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">{b.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs capitalize">{b.account_category || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{b.department || "—"}</TableCell>
                      {MONTH_KEYS.map((k, i) => {
                        const val = Number(b[k] || 0);
                        const isPast = i <= currentMonth && year === currentYear;
                        return (
                          <TableCell key={k} className={`text-right tabular-nums text-sm ${isPast ? "text-foreground" : "text-muted-foreground"}`}>
                            {val > 0 ? fmt(val) : "—"}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-semibold tabular-nums">{fmt(total)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteBudget.mutate(b.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Budget" : "New Budget"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Office Supplies" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.account_category} onValueChange={v => setForm(f => ({ ...f, account_category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department (optional)</Label>
                <Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="e.g. Engineering" />
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" />
              </div>
            </div>

            {/* Quick fill */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Quick fill:</span>
              {[1000, 5000, 10000, 25000].map(v => (
                <Button key={v} variant="outline" size="sm" className="text-xs h-7" onClick={() => applyUniform(v)}>
                  {fmt(v)}/mo
                </Button>
              ))}
            </div>

            {/* Monthly inputs */}
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {MONTH_LABELS.map((label, i) => (
                <div key={label}>
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.months[i] || ""}
                    onChange={e => {
                      const months = [...form.months];
                      months[i] = Number(e.target.value) || 0;
                      setForm(f => ({ ...f, months }));
                    }}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              <span className="text-sm font-medium">Annual Total</span>
              <span className="text-lg font-bold">{fmt(form.months.reduce((a, b) => a + b, 0))}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>
              {editId ? "Update" : "Create"} Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
