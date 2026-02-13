import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";
import { format, subDays, startOfDay, startOfWeek, startOfMonth, startOfQuarter, startOfYear, endOfDay } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Transaction {
  date: string;
  type: string;
  num: string;
  name: string;
  memo: string;
  account: string;
  amount: number;
  balance: number;
}

interface QuickReportResult {
  transactions?: Transaction[];
  beginningBalance?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  account: { Id: string; Name: string; CurrentBalance: number } | null;
  qbAction: (action: string, body?: Record<string, unknown>) => Promise<QuickReportResult>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const REPORT_PERIODS = [
  { value: "today", label: "Today" },
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "this-quarter", label: "This Quarter" },
  { value: "this-year", label: "This Year" },
  { value: "90-days", label: "Since 90 days ago" },
  { value: "365-days", label: "Since 365 days ago" },
  { value: "all", label: "All Dates" },
  { value: "custom", label: "Custom" },
] as const;

const TXN_TYPES = [
  "All",
  "Expense",
  "Payment",
  "Deposit",
  "Bill Payment",
  "Bill Payment (Cheque)",
  "Sales Receipt",
  "Refund",
  "Transfer",
  "Journal Entry",
] as const;

function computeDatesForPeriod(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = endOfDay(now);
  switch (period) {
    case "today": return { start: startOfDay(now), end };
    case "this-week": return { start: startOfWeek(now, { weekStartsOn: 0 }), end };
    case "this-month": return { start: startOfMonth(now), end };
    case "this-quarter": return { start: startOfQuarter(now), end };
    case "this-year": return { start: startOfYear(now), end };
    case "365-days": return { start: subDays(now, 365), end };
    case "all": return { start: new Date(2000, 0, 1), end };
    case "90-days":
    default: return { start: subDays(now, 90), end };
  }
}

export function AccountQuickReportDrawer({ open, onClose, account, qbAction }: Props) {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [beginBalance, setBeginBalance] = useState(0);
  const [period, setPeriod] = useState("90-days");
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 90));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [typeFilter, setTypeFilter] = useState("All");

  useEffect(() => {
    if (period !== "custom") {
      const { start, end } = computeDatesForPeriod(period);
      setStartDate(start);
      setEndDate(end);
    }
  }, [period]);

  useEffect(() => {
    if (!open || !account) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const result = await qbAction("account-quick-report", {
          accountId: account!.Id,
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
        });
        if (cancelled) return;
        setTransactions(result.transactions || []);
        setBeginBalance(result.beginningBalance || 0);
      } catch (err) {
        console.error("Failed to load account report:", err);
        if (!cancelled) setTransactions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [open, account?.Id, startDate, endDate, qbAction]);

  const filteredTransactions = useMemo(() => {
    if (typeFilter === "All") return transactions;
    return transactions.filter((t) => t.type === typeFilter);
  }, [transactions, typeFilter]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="sm:max-w-4xl w-full overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg truncate">
                {account?.Name || "Account"} — QuickReport
              </SheetTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Balance: {fmt(account?.CurrentBalance || 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Report period</span>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="h-8 w-[180px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">From</span>
              <DatePick value={startDate} onChange={(d) => { setPeriod("custom"); setStartDate(d); }} />
              <span className="text-sm text-muted-foreground">To</span>
              <DatePick value={endDate} onChange={(d) => { setPeriod("custom"); setEndDate(d); }} />
            </div>

            <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Type</span>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-[180px] text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TXN_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SheetHeader>

        <div className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-sm">Date</TableHead>
                  <TableHead className="text-sm">Type</TableHead>
                  <TableHead className="text-sm">#</TableHead>
                  <TableHead className="text-sm">Name</TableHead>
                  <TableHead className="text-sm">Memo / Description</TableHead>
                  <TableHead className="text-sm">Distribution Account</TableHead>
                  <TableHead className="text-sm text-center">Cleared</TableHead>
                  <TableHead className="text-sm text-right">Amount</TableHead>
                  <TableHead className="text-sm text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/40 font-medium">
                  <TableCell colSpan={8} className="text-sm">Beginning Balance</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{fmt(beginBalance)}</TableCell>
                </TableRow>
                {filteredTransactions.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No transactions found for this period
                    </TableCell>
                  </TableRow>
                )}
                {filteredTransactions.map((t, i) => (
                  <TableRow key={i} className="text-sm">
                    <TableCell className="whitespace-nowrap">{t.date}</TableCell>
                    <TableCell>{t.type}</TableCell>
                    <TableCell className="font-mono">{t.num || "—"}</TableCell>
                    <TableCell className="font-medium max-w-[140px] truncate">{t.name || "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-muted-foreground">{t.memo || "—"}</TableCell>
                    <TableCell className="max-w-[140px] truncate">{t.account || "—"}</TableCell>
                    <TableCell className="text-center text-muted-foreground">---</TableCell>
                    <TableCell className={cn("text-right font-semibold", t.amount < 0 ? "text-destructive" : "text-primary")}>
                      {fmt(t.amount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmt(t.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

AccountQuickReportDrawer.displayName = "AccountQuickReportDrawer";

function DatePick({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-sm">
          <Calendar className="w-3.5 h-3.5" />
          {format(value, "MM/dd/yyyy")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarPicker
          mode="single"
          selected={value}
          onSelect={(d) => d && onChange(d)}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

DatePick.displayName = "DatePick";
