import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Phone, Mail, MapPin, ChevronDown, FileText, DollarSign, List, StickyNote,
  AlertTriangle, MoreHorizontal, RefreshCw, Copy, Globe, Smartphone, User,
} from "lucide-react";
import { format } from "date-fns";
import { CreateVendorTransactionDialog, type VendorTransactionType } from "./CreateVendorTransactionDialog";
import { useToast } from "@/hooks/use-toast";
import type { QBVendor } from "@/hooks/useQuickBooksData";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const VENDOR_TXN_TYPES = ["Bill", "BillPayment", "VendorCredit", "PurchaseOrder"];

function CopyButton({ value }: { value: string }) {
  const { toast } = useToast();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
      onClick={() => { navigator.clipboard.writeText(value); toast({ title: "Copied!" }); }}
    >
      <Copy className="w-3 h-3" />
    </Button>
  );
}

function ContactField({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 min-w-[200px]">
      <Icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium truncate">{value}</p>
          <CopyButton value={value} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

interface VendorDetailProps {
  vendor: QBVendor;
}

export function VendorDetail({ vendor }: VendorDetailProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [txnDialogType, setTxnDialogType] = useState<VendorTransactionType>("Bill");
  const [syncing, setSyncing] = useState(false);
  const autoSyncAttempted = useRef(false);

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
      queryClient.invalidateQueries({ queryKey: ["qb_vendor_transactions", vendor.Id] });
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
      queryClient.invalidateQueries({ queryKey: ["qb_vendor_transactions", vendor.Id] });
    } catch (err) {
      toast({ title: "Void failed", description: String(err), variant: "destructive" });
    }
  };

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

  const syncVendorTransactions = useCallback(async () => {
    setSyncing(true);
    try {
      let totalSynced = 0;
      for (const entityType of VENDOR_TXN_TYPES) {
        const { data, error } = await supabase.functions.invoke("qb-sync-engine", {
          body: { action: "sync-entity", entity_type: entityType },
        });
        if (error) console.error(`Sync ${entityType} failed:`, error);
        else totalSynced += data?.upserted ?? 0;
      }
      await queryClient.invalidateQueries({ queryKey: ["qb_vendor_transactions", vendor.Id] });
      toast({ title: "Sync complete", description: `${totalSynced} records synced` });
    } catch (err) {
      toast({ title: "Sync failed", description: String(err), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }, [vendor.Id, queryClient, toast]);

  useEffect(() => {
    if (!autoSyncAttempted.current && !txnLoading && transactions.length === 0 && (qbVendor?.balance ?? 0) > 0) {
      autoSyncAttempted.current = true;
      syncVendorTransactions();
    }
  }, [txnLoading, transactions.length, qbVendor?.balance, syncVendorTransactions]);

  // --- Extract all QB fields ---
  const qbJson = qbVendor?.raw_json as Record<string, any> | null;
  const email = qbJson?.PrimaryEmailAddr?.Address || vendor.PrimaryEmailAddr?.Address || null;
  const phone = qbJson?.PrimaryPhone?.FreeFormNumber || vendor.PrimaryPhone?.FreeFormNumber || null;
  const mobile = qbJson?.Mobile?.FreeFormNumber || null;
  const altPhone = qbJson?.AlternatePhone?.FreeFormNumber || null;
  const billAddr = qbJson?.BillAddr;
  const companyName = qbJson?.CompanyName || vendor.CompanyName || null;
  const givenName = qbJson?.GivenName || null;
  const familyName = qbJson?.FamilyName || null;
  const printOnCheckName = qbJson?.PrintOnCheckName || null;
  const taxId = qbJson?.TaxIdentifier || null;
  const terms = qbJson?.TermRef?.name || null;
  const currencyName = qbJson?.CurrencyRef?.name || null;
  const qbNotes = qbJson?.Notes || null;
  const acctNum = qbJson?.AcctNum || null;
  const billRate = qbJson?.BillRate != null ? String(qbJson.BillRate) : null;
  const costRate = qbJson?.CostRate != null ? String(qbJson.CostRate) : null;
  const vendor1099 = qbJson?.Vendor1099 ?? null;
  const t4aEligible = qbJson?.T4AEligible ?? null;
  const t5018Eligible = qbJson?.T5018Eligible ?? null;
  const qbActive = qbJson?.Active ?? vendor.Active;
  const qbCreated = qbJson?.MetaData?.CreateTime || null;
  const qbUpdated = qbJson?.MetaData?.LastUpdatedTime || null;
  const webAddr = qbJson?.WebAddr?.URI || null;
  const qbId = qbJson?.Id || vendor.Id || null;

  const formatAddr = (addr: any) => {
    if (!addr) return null;
    return [addr.Line1, addr.City, addr.CountrySubDivisionCode, addr.PostalCode].filter(Boolean).join(", ") || null;
  };

  const formatAddrMultiLine = (addr: any) => {
    if (!addr) return null;
    const lines = [addr.Line1, addr.Line2, [addr.City, addr.CountrySubDivisionCode, addr.PostalCode].filter(Boolean).join(", "), addr.Country].filter(Boolean);
    return lines.length > 0 ? lines.join("\n") : null;
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (name[0] || "V").toUpperCase();
  };

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
        {/* ── Header ── */}
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-14 w-14 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                {getInitials(vendor.DisplayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-xl font-bold leading-tight">{vendor.DisplayName}</h2>
                  {companyName && companyName !== vendor.DisplayName && (
                    <p className="text-sm text-muted-foreground">{companyName}</p>
                  )}
                </div>
                <Badge className={`border-0 shrink-0 ${qbActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  {qbActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>

          {/* ── Contact Grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg">
            <ContactField icon={Mail} label="Email" value={email} />
            <ContactField icon={Phone} label="Phone" value={phone} />
            <ContactField icon={Smartphone} label="Mobile" value={mobile} />
            <ContactField icon={Phone} label="Alt. Phone" value={altPhone} />
            <ContactField icon={Globe} label="Website" value={webAddr} />
            <ContactField icon={MapPin} label="Billing Address" value={formatAddr(billAddr)} />
          </div>

          {/* ── Financial Summary ── */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Financial Summary</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">QB Balance</p>
                  <p className="text-xl font-bold">{fmt(qbVendor?.balance ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Open Balance</p>
                  <p className="text-xl font-bold">{fmt(financialSummary.openBalance)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-destructive" /> Overdue
                  </p>
                  <p className="text-xl font-bold text-destructive">{fmt(financialSummary.overdueBalance)}</p>
                  {financialSummary.overdueCount > 0 && (
                    <p className="text-xs text-destructive">{financialSummary.overdueCount} bill{financialSummary.overdueCount !== 1 ? "s" : ""}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── New Transaction ── */}
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1"><FileText className="w-4 h-4" /> New transaction <ChevronDown className="w-3 h-3" /></Button>
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

        {/* ── Tabs ── */}
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="transactions" className="gap-1"><List className="w-3.5 h-3.5" /> Transaction List</TabsTrigger>
            <TabsTrigger value="details" className="gap-1"><User className="w-3.5 h-3.5" /> Supplier Details</TabsTrigger>
            <TabsTrigger value="notes" className="gap-1"><StickyNote className="w-3.5 h-3.5" /> Notes</TabsTrigger>
          </TabsList>

          {/* ── Transaction List ── */}
          <TabsContent value="transactions" className="space-y-3 mt-3">
            <div className="flex gap-2 items-center">
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
              <Button variant="outline" size="sm" className="h-8 gap-1 ml-auto text-xs" onClick={syncVendorTransactions} disabled={syncing}>
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing..." : "Sync Transactions"}
              </Button>
            </div>

            {txnLoading || syncing ? (
              <p className="text-sm text-muted-foreground p-4">{syncing ? "Syncing vendor transactions from QuickBooks..." : "Loading transactions..."}</p>
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

          {/* ── Supplier Details ── */}
          <TabsContent value="details" className="mt-3 space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
              <CardContent className="space-y-0">
                <DetailRow label="Display Name" value={vendor.DisplayName} />
                <DetailRow label="First Name" value={givenName} />
                <DetailRow label="Last Name" value={familyName} />
                <DetailRow label="Company" value={companyName} />
                <DetailRow label="Print on Check as" value={printOnCheckName} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Communication</CardTitle></CardHeader>
              <CardContent className="space-y-0">
                <DetailRow label="Email" value={email} />
                <DetailRow label="Phone" value={phone} />
                <DetailRow label="Mobile" value={mobile} />
                <DetailRow label="Alt. Phone" value={altPhone} />
                <DetailRow label="Website" value={webAddr} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Address</CardTitle></CardHeader>
              <CardContent>
                {formatAddrMultiLine(billAddr) ? (
                  <p className="text-sm whitespace-pre-line">{formatAddrMultiLine(billAddr)}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No address on file</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Payment & Billing</CardTitle></CardHeader>
              <CardContent className="space-y-0">
                <DetailRow label="Payment Terms" value={terms} />
                <DetailRow label="Account No." value={acctNum} />
                <DetailRow label="Bill Rate" value={billRate} />
                <DetailRow label="Cost Rate" value={costRate} />
                <DetailRow label="Currency" value={currencyName} />
                <DetailRow label="Tax ID" value={taxId} />
                <DetailRow label="1099 Vendor" value={vendor1099 != null ? (vendor1099 ? "Yes" : "No") : null} />
                <DetailRow label="T4A Eligible" value={t4aEligible != null ? (t4aEligible ? "Yes" : "No") : null} />
                <DetailRow label="T5018 Eligible" value={t5018Eligible != null ? (t5018Eligible ? "Yes" : "No") : null} />
                <DetailRow label="Balance" value={qbVendor?.balance != null ? fmt(qbVendor.balance) : null} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">QuickBooks Metadata</CardTitle></CardHeader>
              <CardContent className="space-y-0">
                <DetailRow label="QB ID" value={qbId} />
                <DetailRow label="Status" value={qbActive ? "Active" : "Inactive"} />
                <DetailRow label="Created" value={qbCreated ? format(new Date(qbCreated), "MMM d, yyyy") : null} />
                <DetailRow label="Last Updated" value={qbUpdated ? format(new Date(qbUpdated), "MMM d, yyyy") : null} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Notes ── */}
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
