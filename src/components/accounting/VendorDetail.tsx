import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Phone, Mail, MapPin, ChevronDown, FileText, DollarSign, List, StickyNote, AlertTriangle, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";
import { CreateVendorTransactionDialog, type VendorTransactionType } from "./CreateVendorTransactionDialog";
import { useToast } from "@/hooks/use-toast";
import type { QBVendor } from "@/hooks/useQuickBooksData";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm font-medium">{value}</p></div>;
}

interface VendorDetailProps {
  vendor: QBVendor;
}

export function VendorDetail({ vendor }: VendorDetailProps) {
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [txnDialogType, setTxnDialogType] = useState<VendorTransactionType>("Bill");

  const openTxnDialog = (type: VendorTransactionType) => {
    setTxnDialogType(type);
    setTxnDialogOpen(true);
  };

  const handleDeleteTxn = async (txn: any) => {
    const txnRaw = txn.raw_json as any;
    try {
      const { error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "delete-transaction", entityType: txn.entity_type, entityId: txnRaw?.Id, syncToken: txnRaw?.SyncToken || "0" },
      });
      if (error) throw error;
      toast({ title: "Transaction deleted" });
    } catch (err) {
      toast({ title: "Delete failed", description: String(err), variant: "destructive" });
    }
  };

  const handleVoidTxn = async (txn: any) => {
    const txnRaw = txn.raw_json as any;
    try {
      const { error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "void-transaction", entityType: txn.entity_type, entityId: txnRaw?.Id, syncToken: txnRaw?.SyncToken || "0" },
      });
      if (error) throw error;
      toast({ title: "Transaction voided" });
    } catch (err) {
      toast({ title: "Void failed", description: String(err), variant: "destructive" });
    }
  };

  // QB vendor raw data
  const { data: qbVendor } = useQuery({
    queryKey: ["qb_vendor_detail", vendor.Id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qb_vendors")
        .select("raw_json, balance")
        .eq("qb_id", vendor.Id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Vendor transactions
  const { data: transactions = [], isLoading: txnLoading } = useQuery({
    queryKey: ["qb_vendor_transactions", vendor.Id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qb_transactions")
        .select("id, entity_type, txn_date, doc_number, total_amt, balance, raw_json")
        .eq("vendor_qb_id", vendor.Id)
        .eq("is_deleted", false)
        .eq("is_voided", false)
        .order("txn_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const qbJson = qbVendor?.raw_json as Record<string, any> | null;
  const email = qbJson?.PrimaryEmailAddr?.Address || vendor.PrimaryEmailAddr?.Address || null;
  const phone = qbJson?.PrimaryPhone?.FreeFormNumber || vendor.PrimaryPhone?.FreeFormNumber || null;
  const billAddr = qbJson?.BillAddr;
  const companyName = qbJson?.CompanyName || vendor.CompanyName || null;
  const taxId = qbJson?.TaxIdentifier || null;
  const terms = qbJson?.TermRef?.name || null;
  const currencyName = qbJson?.CurrencyRef?.name || null;
  const qbNotes = qbJson?.Notes || null;
  const acctNum = qbJson?.AcctNum || null;
  const qbActive = qbJson?.Active ?? vendor.Active;
  const qbCreated = qbJson?.MetaData?.CreateTime || null;
  const qbUpdated = qbJson?.MetaData?.LastUpdatedTime || null;
  const webAddr = qbJson?.WebAddr?.URI || null;
  const billPayACH = qbJson?.BillPayACHInfo || qbJson?.ACHInfo || null;

  const formatAddr = (addr: any) => {
    if (!addr) return null;
    return [addr.Line1, addr.City, addr.CountrySubDivisionCode, addr.PostalCode].filter(Boolean).join(", ") || null;
  };

  // Extract category from transaction raw_json
  const getCategory = (txnRaw: any) => {
    if (!txnRaw?.Line) return "—";
    for (const line of txnRaw.Line) {
      const acctName = line?.AccountBasedExpenseLineDetail?.AccountRef?.name;
      if (acctName) return acctName;
      const itemName = line?.ItemBasedExpenseLineDetail?.ItemRef?.name;
      if (itemName) return itemName;
    }
    return "—";
  };

  const getSalesTax = (txnRaw: any) => txnRaw?.TxnTaxDetail?.TotalTax ?? 0;

  const getPayee = (txnRaw: any) => txnRaw?.VendorRef?.name || vendor.DisplayName || "—";

  // Financial summary
  const financialSummary = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    let openBalance = 0;
    let overdueBalance = 0;
    let overdueCount = 0;

    transactions.forEach((txn) => {
      if (txn.entity_type === "Bill" && (txn.balance ?? 0) > 0) {
        openBalance += txn.balance ?? 0;
        const dueDate = (txn.raw_json as any)?.DueDate;
        if (dueDate && dueDate < today) {
          overdueBalance += txn.balance ?? 0;
          overdueCount++;
        }
      }
    });

    return { openBalance, overdueBalance, overdueCount };
  }, [transactions]);

  // Filtered transactions
  const filteredTxns = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return transactions.filter((txn) => {
      if (typeFilter !== "all" && txn.entity_type !== typeFilter) return false;
      if (statusFilter === "open" && (txn.balance ?? 0) <= 0) return false;
      if (statusFilter === "overdue") {
        const dueDate = (txn.raw_json as any)?.DueDate;
        if (!dueDate || dueDate >= today || (txn.balance ?? 0) <= 0) return false;
      }
      if (statusFilter === "paid" && (txn.balance ?? 0) > 0) return false;
      return true;
    });
  }, [transactions, typeFilter, statusFilter]);

  const deriveStatus = (txn: any) => {
    const today = new Date().toISOString().split("T")[0];
    const dueDate = (txn.raw_json as any)?.DueDate;
    if ((txn.balance ?? 0) <= 0) return "Paid";
    if (dueDate && dueDate < today) return "Overdue";
    return "Open";
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold">{vendor.DisplayName}</h2>
              {companyName && companyName !== vendor.DisplayName && (
                <p className="text-sm text-muted-foreground">{companyName}</p>
              )}
            </div>
            <Badge className={`border-0 ${qbActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
              {qbActive ? "Active" : "Inactive"}
            </Badge>
          </div>

          {/* Contact info */}
          <div className="flex flex-wrap gap-4 text-sm">
            {phone && <span className="flex items-center gap-1.5 text-muted-foreground"><Phone className="w-3.5 h-3.5" />{phone}</span>}
            {email && <span className="flex items-center gap-1.5 text-muted-foreground"><Mail className="w-3.5 h-3.5" />{email}</span>}
            {formatAddr(billAddr) && <span className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="w-3.5 h-3.5" />{formatAddr(billAddr)}</span>}
          </div>

          {/* Bill Pay ACH info */}
          {billPayACH && (
            <div className="text-sm bg-muted/50 rounded-lg p-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">Bill Pay ACH Info</p>
              <p className="text-sm">{typeof billPayACH === "string" ? billPayACH : JSON.stringify(billPayACH)}</p>
            </div>
          )}

          {/* Financial Summary Card + New transaction */}
          <div className="flex items-stretch gap-3">
            <Card className="flex-1">
              <CardContent className="p-4 flex gap-6 items-center">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Open balance</p>
                  <p className="text-2xl font-bold">{fmt(financialSummary.openBalance)}</p>
                </div>
                <div className="h-10 w-px bg-border" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-destructive" /> Overdue
                  </p>
                  <p className="text-2xl font-bold text-destructive">{fmt(financialSummary.overdueBalance)}</p>
                  {financialSummary.overdueCount > 0 && (
                    <p className="text-xs text-destructive">{financialSummary.overdueCount} bill{financialSummary.overdueCount !== 1 ? "s" : ""}</p>
                  )}
                </div>
              </CardContent>
            </Card>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-auto gap-1"><FileText className="w-4 h-4" /> New transaction <ChevronDown className="w-3 h-3" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openTxnDialog("Bill")}>Bill</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTxnDialog("Expense")}>Expense</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTxnDialog("Cheque")}>Cheque</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTxnDialog("SupplierCredit")}>Supplier Credit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTxnDialog("Bill")}>Pay down credit card</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTxnDialog("Bill")}>Import Bills</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="transactions" className="gap-1"><List className="w-3.5 h-3.5" /> Transaction List</TabsTrigger>
            <TabsTrigger value="details" className="gap-1"><DollarSign className="w-3.5 h-3.5" /> Supplier Details</TabsTrigger>
            <TabsTrigger value="notes" className="gap-1"><StickyNote className="w-3.5 h-3.5" /> Notes</TabsTrigger>
          </TabsList>

          {/* Transaction List */}
          <TabsContent value="transactions" className="space-y-3 mt-3">
            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Bill">Bill</SelectItem>
                  <SelectItem value="BillPayment">Bill Payment</SelectItem>
                  <SelectItem value="PurchaseOrder">Purchase Order</SelectItem>
                  <SelectItem value="VendorCredit">Vendor Credit</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {txnLoading ? (
              <p className="text-sm text-muted-foreground p-4">Loading transactions...</p>
            ) : filteredTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No transactions found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">No.</TableHead>
                      <TableHead className="text-xs">Payee</TableHead>
                      <TableHead className="text-xs">Category</TableHead>
                      <TableHead className="text-xs text-right">Before Tax</TableHead>
                      <TableHead className="text-xs text-right">Sales Tax</TableHead>
                      <TableHead className="text-xs text-right">Total</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTxns.map((txn) => {
                      const status = deriveStatus(txn);
                      const txnRaw = txn.raw_json as any;
                      const salesTax = getSalesTax(txnRaw);
                      const totalBeforeTax = (txn.total_amt ?? 0) - salesTax;
                      return (
                        <TableRow key={txn.id} className="text-sm">
                          <TableCell className="whitespace-nowrap">{txn.txn_date ? format(new Date(txn.txn_date), "MMM d, yyyy") : "—"}</TableCell>
                          <TableCell>{txn.entity_type}</TableCell>
                          <TableCell>{txn.doc_number || "—"}</TableCell>
                          <TableCell className="max-w-[120px] truncate">{getPayee(txnRaw)}</TableCell>
                          <TableCell className="max-w-[120px] truncate">{getCategory(txnRaw)}</TableCell>
                          <TableCell className="text-right">{fmt(totalBeforeTax)}</TableCell>
                          <TableCell className="text-right">{salesTax > 0 ? fmt(salesTax) : "—"}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(txn.total_amt ?? 0)}</TableCell>
                          <TableCell>
                            <Badge variant={status === "Overdue" ? "destructive" : status === "Paid" ? "secondary" : "outline"} className="text-xs">
                              {status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>View/Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleVoidTxn(txn)} className="text-warning">Void</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteTxn(txn)} className="text-destructive">Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* Supplier Details */}
          <TabsContent value="details" className="mt-3">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Company" value={companyName} />
              <InfoRow label="Display Name" value={vendor.DisplayName} />
              <InfoRow label="Email" value={email} />
              <InfoRow label="Phone" value={phone} />
              <InfoRow label="Website" value={webAddr} />
              <InfoRow label="Account No." value={acctNum} />
              <InfoRow label="Billing Address" value={formatAddr(billAddr)} />
              <InfoRow label="Bill Pay ACH Info" value={billPayACH ? (typeof billPayACH === "string" ? billPayACH : "Configured") : null} />
              <InfoRow label="Payment Terms" value={terms} />
              <InfoRow label="Tax ID" value={taxId} />
              <InfoRow label="Currency" value={currencyName} />
              <InfoRow label="Balance" value={qbVendor?.balance != null ? fmt(qbVendor.balance) : null} />
              <InfoRow label="QB Created" value={qbCreated ? format(new Date(qbCreated), "MMM d, yyyy") : null} />
              <InfoRow label="QB Updated" value={qbUpdated ? format(new Date(qbUpdated), "MMM d, yyyy") : null} />
            </div>
          </TabsContent>

          {/* Notes */}
          <TabsContent value="notes" className="mt-3">
            {qbNotes ? (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{qbNotes}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground p-4">No notes from QuickBooks</p>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CreateVendorTransactionDialog
        open={txnDialogOpen}
        onOpenChange={setTxnDialogOpen}
        type={txnDialogType}
        vendorQbId={vendor.Id}
        vendorName={vendor.DisplayName}
      />
    </ScrollArea>
  );
}
