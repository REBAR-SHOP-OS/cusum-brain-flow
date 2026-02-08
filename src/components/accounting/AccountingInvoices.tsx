import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { FileText, Send, Ban, Plus, Search } from "lucide-react";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingInvoices({ data }: Props) {
  const { invoices, sendInvoice, voidInvoice } = data;
  const [search, setSearch] = useState("");
  const [sendTarget, setSendTarget] = useState<{ id: string; name: string; doc: string } | null>(null);
  const [voidTarget, setVoidTarget] = useState<{ id: string; doc: string; syncToken: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const filtered = invoices.filter(
    (inv) =>
      (inv.DocNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.CustomerRef?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = async () => {
    if (!sendTarget) return;
    setActionLoading(true);
    try {
      await sendInvoice(sendTarget.id);
    } finally {
      setActionLoading(false);
      setSendTarget(null);
    }
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    setActionLoading(true);
    try {
      await voidInvoice(voidTarget.id, voidTarget.syncToken);
    } finally {
      setActionLoading(false);
      setVoidTarget(null);
    }
  };

  const getStatus = (inv: { Balance: number; DueDate: string }) => {
    if (inv.Balance === 0) return { label: "Paid", color: "bg-emerald-500/10 text-emerald-500" };
    if (new Date(inv.DueDate) < new Date()) return { label: "Overdue", color: "bg-destructive/10 text-destructive" };
    return { label: "Open", color: "bg-blue-500/10 text-blue-500" };
  };

  return (
    <div className="space-y-4">
      {/* Search + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search invoices by number or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-emerald-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-2xl font-bold text-emerald-500">{invoices.filter(i => i.Balance === 0).length}</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Open</p>
            <p className="text-2xl font-bold text-blue-500">{invoices.filter(i => i.Balance > 0 && new Date(i.DueDate) >= new Date()).length}</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className="text-2xl font-bold text-destructive">{invoices.filter(i => i.Balance > 0 && new Date(i.DueDate) < new Date()).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Invoices ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-lg">
              {search ? "No invoices match your search" : "No invoices found — sync from QuickBooks first"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Invoice #</TableHead>
                  <TableHead className="text-base">Customer</TableHead>
                  <TableHead className="text-base">Date</TableHead>
                  <TableHead className="text-base">Due</TableHead>
                  <TableHead className="text-base text-right">Total</TableHead>
                  <TableHead className="text-base text-right">Balance</TableHead>
                  <TableHead className="text-base">Status</TableHead>
                  <TableHead className="text-base text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => {
                  const status = getStatus(inv);
                  return (
                    <TableRow key={inv.Id} className="text-base">
                      <TableCell className="font-mono font-semibold">#{inv.DocNumber}</TableCell>
                      <TableCell className="font-medium">{inv.CustomerRef?.name || "—"}</TableCell>
                      <TableCell>{inv.TxnDate ? new Date(inv.TxnDate).toLocaleDateString() : "—"}</TableCell>
                      <TableCell>{inv.DueDate ? new Date(inv.DueDate).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(inv.TotalAmt)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(inv.Balance)}</TableCell>
                      <TableCell>
                        <Badge className={`${status.color} border-0 text-sm`}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {inv.Balance > 0 && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 gap-1"
                                onClick={() => setSendTarget({ id: inv.Id, name: inv.CustomerRef?.name, doc: inv.DocNumber })}
                              >
                                <Send className="w-4 h-4" /> Email
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-9 gap-1 text-destructive hover:text-destructive"
                                onClick={() => setVoidTarget({ id: inv.Id, doc: inv.DocNumber, syncToken: (inv as any).SyncToken || "0" })}
                              >
                                <Ban className="w-4 h-4" /> Void
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Send confirmation */}
      <ConfirmActionDialog
        open={!!sendTarget}
        onOpenChange={() => setSendTarget(null)}
        title="Send Invoice by Email?"
        description={`This will email Invoice #${sendTarget?.doc} to ${sendTarget?.name}.`}
        details={[`Invoice: #${sendTarget?.doc}`, `Customer: ${sendTarget?.name}`]}
        confirmLabel="Yes, Send Email"
        onConfirm={handleSend}
        loading={actionLoading}
      />

      {/* Void confirmation */}
      <ConfirmActionDialog
        open={!!voidTarget}
        onOpenChange={() => setVoidTarget(null)}
        title="Void This Invoice?"
        description={`This will VOID Invoice #${voidTarget?.doc}. This cannot be undone!`}
        variant="destructive"
        confirmLabel="Yes, Void Invoice"
        onConfirm={handleVoid}
        loading={actionLoading}
      />
    </div>
  );
}
