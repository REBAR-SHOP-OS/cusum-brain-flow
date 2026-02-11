import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";
import { format, subDays } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
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

interface Props {
  open: boolean;
  onClose: () => void;
  account: { Id: string; Name: string; CurrentBalance: number } | null;
  qbAction: (action: string, body?: Record<string, unknown>) => Promise<any>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountQuickReportDrawer({ open, onClose, account, qbAction }: Props) {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [beginBalance, setBeginBalance] = useState(0);
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 90));
  const [endDate, setEndDate] = useState<Date>(new Date());

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

          {/* Date range */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-sm text-muted-foreground">From</span>
            <DatePick value={startDate} onChange={setStartDate} />
            <span className="text-sm text-muted-foreground">To</span>
            <DatePick value={endDate} onChange={setEndDate} />
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
                  <TableHead className="text-sm">Account</TableHead>
                  <TableHead className="text-sm text-right">Amount</TableHead>
                  <TableHead className="text-sm text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/40 font-medium">
                  <TableCell colSpan={7} className="text-sm">Beginning Balance</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{fmt(beginBalance)}</TableCell>
                </TableRow>
                {transactions.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No transactions found for this period
                    </TableCell>
                  </TableRow>
                )}
                {transactions.map((t, i) => (
                  <TableRow key={i} className="text-sm">
                    <TableCell className="whitespace-nowrap">{t.date}</TableCell>
                    <TableCell>{t.type}</TableCell>
                    <TableCell className="font-mono">{t.num || "—"}</TableCell>
                    <TableCell className="font-medium max-w-[140px] truncate">{t.name || "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate text-muted-foreground">{t.memo || "—"}</TableCell>
                    <TableCell className="max-w-[140px] truncate">{t.account || "—"}</TableCell>
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
