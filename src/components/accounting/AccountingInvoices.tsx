import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmActionDialog } from "./ConfirmActionDialog";
import { InvoiceEditor } from "./InvoiceEditor";
import { CustomerSelectDialog } from "./CustomerSelectDialog";
import { CreateTransactionDialog } from "@/components/customers/CreateTransactionDialog";
import { FileText, Send, Ban, Search, Eye, ArrowUpDown, Download, Plus, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { useQuickBooksData, QBInvoice } from "@/hooks/useQuickBooksData";

type SortField = "DocNumber" | "Customer" | "TxnDate" | "DueDate" | "TotalAmt" | "Balance" | "Status";
type SortDir = "asc" | "desc";

function getStatusRank(inv: { Balance: number; DueDate: string }) {
  if (inv.Balance === 0) return 0; // Paid
  if (new Date(inv.DueDate) < new Date()) return 2; // Overdue
  return 1; // Open
}

function SortableHead({ label, field, current, dir, onSort, className }: {
  label: string; field: SortField; current: SortField; dir: SortDir;
  onSort: (f: SortField) => void; className?: string;
}) {
  return (
    <TableHead className={className}>
      <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => onSort(field)}>
        {label}
        <ArrowUpDown className={`w-3 h-3 ${current === field ? "text-foreground" : "text-muted-foreground/50"}`} />
      </button>
    </TableHead>
  );
}

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
  initialSearch?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

type StatusFilter = "all" | "open" | "overdue" | "paid";

export function AccountingInvoices({ data, initialSearch }: Props) {
  const { invoices, sendInvoice, voidInvoice, updateInvoice, customers, items, payments, qbAction, loadAll } = data;
  const [search, setSearch] = useState(initialSearch || "");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sendTarget, setSendTarget] = useState<{ id: string; name: string; doc: string } | null>(null);
  const [voidTarget, setVoidTarget] = useState<{ id: string; doc: string; syncToken: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<QBInvoice | null>(null);
  const [sortField, setSortField] = useState<SortField>("DocNumber");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [customerSelectOpen, setCustomerSelectOpen] = useState(false);
  const [txnCustomer, setTxnCustomer] = useState<{ qbId: string; name: string } | null>(null);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      (inv.DocNumber || "").toLowerCase().includes(search.toLowerCase()) ||
      (inv.CustomerRef?.name || "").toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (statusFilter === "paid") return inv.Balance === 0;
    if (statusFilter === "overdue") return inv.Balance > 0 && new Date(inv.DueDate) < new Date();
    if (statusFilter === "open") return inv.Balance > 0 && new Date(inv.DueDate) >= new Date();
    return true;
  }).sort((a, b) => {
    const m = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "DocNumber": return (a.DocNumber || "").localeCompare(b.DocNumber || "", undefined, { numeric: true }) * m;
      case "Customer": return (a.CustomerRef?.name || "").localeCompare(b.CustomerRef?.name || "") * m;
      case "TxnDate": return (new Date(a.TxnDate || 0).getTime() - new Date(b.TxnDate || 0).getTime()) * m;
      case "DueDate": return (new Date(a.DueDate || 0).getTime() - new Date(b.DueDate || 0).getTime()) * m;
      case "TotalAmt": return (a.TotalAmt - b.TotalAmt) * m;
      case "Balance": return (a.Balance - b.Balance) * m;
      case "Status": return (getStatusRank(a) - getStatusRank(b)) * m;
      default: return 0;
    }
  });

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
    } catch (err: any) {
      toast({ title: "Void failed", description: err?.message || "An unexpected error occurred", variant: "destructive" });
    } finally {
      setActionLoading(false);
      setVoidTarget(null);
    }
  };

  const getStatus = (inv: { Balance: number; DueDate: string }) => {
    if (inv.Balance === 0) return { label: "Paid", color: "bg-success/10 text-success" };
    if (new Date(inv.DueDate) < new Date()) return { label: "Overdue", color: "bg-destructive/10 text-destructive" };
    return { label: "Open", color: "bg-primary/10 text-primary" };
  };

  const exportCsv = () => {
    import("@e965/xlsx").then(({ utils, writeFile }) => {
      const rows = filtered.map(inv => ({
        "Invoice #": inv.DocNumber || "",
        Customer: inv.CustomerRef?.name || "",
        Date: inv.TxnDate || "",
        "Due Date": inv.DueDate || "",
        Total: inv.TotalAmt,
        Balance: inv.Balance,
        Status: inv.Balance === 0 ? "Paid" : new Date(inv.DueDate) < new Date() ? "Overdue" : "Open",
      }));
      const ws = utils.json_to_sheet(rows);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Invoices");
      writeFile(wb, `invoices_${new Date().toISOString().slice(0, 10)}.csv`, { bookType: "csv" });
    });
  };

  return (
    <div className="space-y-4">
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
        <div className="flex items-center gap-1">
          {(["all", "open", "overdue", "paid"] as StatusFilter[]).map(f => (
            <Button
              key={f}
              variant={statusFilter === f ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs capitalize"
              onClick={() => setStatusFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="h-12 gap-2" onClick={exportCsv}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
        <Button size="sm" className="h-12 gap-2" onClick={() => setCustomerSelectOpen(true)}>
          <Plus className="w-4 h-4" /> Create Invoice
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-success/5">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-2xl font-bold text-success">{invoices.filter(i => i.Balance === 0).length}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Open</p>
            <p className="text-2xl font-bold text-primary">{invoices.filter(i => i.Balance > 0 && new Date(i.DueDate) >= new Date()).length}</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p className="text-2xl font-bold text-destructive">{invoices.filter(i => i.Balance > 0 && new Date(i.DueDate) < new Date()).length}</p>
          </CardContent>
        </Card>
      </div>

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
                  <SortableHead label="Invoice #" field="DocNumber" current={sortField} dir={sortDir} onSort={toggleSort} className="text-base" />
                  <SortableHead label="Customer" field="Customer" current={sortField} dir={sortDir} onSort={toggleSort} className="text-base" />
                  <SortableHead label="Date" field="TxnDate" current={sortField} dir={sortDir} onSort={toggleSort} className="text-base" />
                  <SortableHead label="Due" field="DueDate" current={sortField} dir={sortDir} onSort={toggleSort} className="text-base" />
                  <SortableHead label="Total" field="TotalAmt" current={sortField} dir={sortDir} onSort={toggleSort} className="text-base text-right" />
                  <SortableHead label="Balance" field="Balance" current={sortField} dir={sortDir} onSort={toggleSort} className="text-base text-right" />
                  <SortableHead label="Status" field="Status" current={sortField} dir={sortDir} onSort={toggleSort} className="text-base" />
                  <TableHead className="text-base text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => {
                  const status = getStatus(inv);
                  return (
                    <TableRow key={inv.Id} className="text-base cursor-pointer" onClick={() => setPreviewInvoice(inv)}>
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
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="ghost" className="h-9 gap-1" onClick={() => setPreviewInvoice(inv)}>
                            <Eye className="w-4 h-4" /> View
                          </Button>
                          {inv.Balance > 0 && (
                            <>
                              <Button
                                size="sm" variant="ghost" className="h-9 w-9 p-0"
                                title="Copy payment link"
                                onClick={async () => {
                                  try {
                                    const { data } = await supabase.functions.invoke("stripe-payment", {
                                      body: { action: "create-payment-link", amount: inv.Balance, currency: "cad", invoiceNumber: inv.DocNumber, customerName: inv.CustomerRef?.name, qbInvoiceId: inv.Id },
                                    });
                                    if (data?.paymentLink?.stripe_url) {
                                      await navigator.clipboard.writeText(data.paymentLink.stripe_url);
                                      toast({ title: "Copied!", description: "Stripe payment link copied" });
                                    }
                                  } catch { toast({ title: "Error generating link", variant: "destructive" }); }
                                }}
                              >
                                <Link2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm" variant="ghost" className="h-9 gap-1"
                                onClick={() => setSendTarget({ id: inv.Id, name: inv.CustomerRef?.name, doc: inv.DocNumber })}
                              >
                                <Send className="w-4 h-4" /> Email
                              </Button>
                              <Button
                                size="sm" variant="ghost" className="h-9 gap-1 text-destructive hover:text-destructive"
                                onClick={() => setVoidTarget({ id: inv.Id, doc: inv.DocNumber, syncToken: inv.SyncToken || "0" })}
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

      {previewInvoice && (
        <InvoiceEditor
          invoice={previewInvoice}
          customers={customers}
          items={items}
          payments={payments}
          onUpdate={updateInvoice}
          onClose={() => setPreviewInvoice(null)}
          onSyncPayments={async () => {
            const { supabase } = await import("@/integrations/supabase/client");
            await supabase.functions.invoke("qb-sync-engine", {
              body: { action: "sync-entity", entity_type: "Payment" },
            });
            await loadAll();
          }}
        />
      )}

      <CustomerSelectDialog
        open={customerSelectOpen}
        onOpenChange={setCustomerSelectOpen}
        customers={customers.map((c: any) => ({
          Id: c.qb_customer_id || c.Id,
          DisplayName: c.display_name || c.DisplayName,
          CompanyName: c.CompanyName,
        }))}
        onSelect={(qbId, name) => setTxnCustomer({ qbId, name })}
      />

      {txnCustomer && (
        <CreateTransactionDialog
          open={!!txnCustomer}
          onOpenChange={(open) => { if (!open) setTxnCustomer(null); }}
          type="Invoice"
          customerQbId={txnCustomer.qbId}
          customerName={txnCustomer.name}
          onCreated={() => { setTxnCustomer(null); loadAll(); }}
        />
      )}
    </div>
  );
}

AccountingInvoices.displayName = "AccountingInvoices";
