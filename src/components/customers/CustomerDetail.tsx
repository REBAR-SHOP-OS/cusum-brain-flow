import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { InvoiceEditor } from "@/components/accounting/InvoiceEditor";
import type { QBInvoice } from "@/hooks/useQuickBooksData";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Copy,
  ChevronDown,
  FileText,
  DollarSign,
  User,
  StickyNote,
  Clock,
  List,
  Globe,
  Smartphone,
  Printer,
  Lightbulb,
  X,
} from "lucide-react";
import { format, differenceInDays, startOfDay, startOfWeek, startOfMonth, startOfYear, endOfDay, subDays, subMonths, subYears } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { CreateTransactionDialog, type TransactionType } from "./CreateTransactionDialog";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

interface CustomerDetailProps {
  customer: Customer;
  onEdit: () => void;
  onDelete: () => void;
}

// ── Helper: read-only info row ──
function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export function CustomerDetail({ customer, onEdit, onDelete }: CustomerDetailProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyId();
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [notesValue, setNotesValue] = useState(customer.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // ── Transaction creation dialog state ──
  const [txnDialogOpen, setTxnDialogOpen] = useState(false);
  const [txnDialogType, setTxnDialogType] = useState<TransactionType>("Invoice");
  const [txnPrefill, setTxnPrefill] = useState<any>(undefined);
  const [dismissedPatternId, setDismissedPatternId] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<QBInvoice | null>(null);

  const openTxnDialog = (type: TransactionType, prefill?: any) => {
    setTxnDialogType(type);
    setTxnPrefill(prefill);
    setTxnDialogOpen(true);
  };

  // ── Pattern matching: load suggestions ──
  const { data: matchingPatterns = [] } = useQuery({
    queryKey: ["transaction_patterns", customer.quickbooks_id, companyId],
    enabled: !!customer.quickbooks_id && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaction_patterns")
        .select("*")
        .eq("company_id", companyId!)
        .eq("auto_suggest", true)
        .or(`customer_qb_id.eq.${customer.quickbooks_id},customer_qb_id.is.null`);
      if (error) throw error;
      return data || [];
    },
  });

  // Record pattern after transaction creation
  const recordPattern = async (payload: {
    type: TransactionType;
    lineItems: any[];
    memo: string;
    totalAmount: number;
  }) => {
    if (!companyId || !customer.quickbooks_id) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Build trigger condition from current customer state
      const triggerCondition: Record<string, any> = {};
      if (qbCustomer?.balance && qbCustomer.balance > 0) {
        triggerCondition.has_open_balance = true;
        triggerCondition.balance_gt = Math.floor(qbCustomer.balance * 0.5); // threshold at 50% of current
      }

      // Check if similar pattern exists
      const { data: existing } = await supabase
        .from("transaction_patterns")
        .select("id, times_used")
        .eq("company_id", companyId)
        .eq("action_type", payload.type)
        .eq("customer_qb_id", customer.quickbooks_id!)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("transaction_patterns")
          .update({ times_used: (existing.times_used || 0) + 1 })
          .eq("id", existing.id);
      } else {
        await supabase.from("transaction_patterns").insert({
          company_id: companyId,
          customer_qb_id: customer.quickbooks_id,
          trigger_condition: triggerCondition,
          action_type: payload.type,
          action_payload_template: {
            lineItems: payload.lineItems,
            memo: payload.memo,
          },
          times_used: 1,
          auto_suggest: true,
          created_by: user.id,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["transaction_patterns"] });
    } catch {
      // Pattern recording is best-effort, don't block the user
    }
  };

  // ── QB Customer info ──
  const { data: qbCustomer } = useQuery({
    queryKey: ["qb_customer_detail", customer.quickbooks_id],
    enabled: !!customer.quickbooks_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qb_customers")
        .select("raw_json, balance")
        .eq("qb_id", customer.quickbooks_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ── Primary contact fallback ──
  const { data: primaryContact } = useQuery({
    queryKey: ["primary_contact", customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("customer_id", customer.id)
        .eq("is_primary", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // ── All transactions for this customer ──
  const { data: transactions = [], isLoading: txnLoading } = useQuery({
    queryKey: ["qb_customer_transactions", customer.quickbooks_id],
    enabled: !!customer.quickbooks_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qb_transactions")
        .select("id, entity_type, txn_date, doc_number, total_amt, balance, raw_json")
        .eq("customer_qb_id", customer.quickbooks_id!)
        .eq("is_deleted", false)
        .eq("is_voided", false)
        .order("txn_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // ── Save notes mutation ──
  const saveNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      const { error } = await supabase
        .from("customers")
        .update({ notes })
        .eq("id", customer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setIsEditingNotes(false);
      toast({ title: "Notes saved" });
    },
  });

  // ── Extract ALL QB data ──
  const qbJson = qbCustomer?.raw_json as Record<string, any> | null;
  const email = qbJson?.PrimaryEmailAddr?.Address || primaryContact?.email || null;
  const phone = qbJson?.PrimaryPhone?.FreeFormNumber || primaryContact?.phone || null;
  const mobile = qbJson?.Mobile?.FreeFormNumber || null;
  const altPhone = qbJson?.AlternatePhone?.FreeFormNumber || null;
  const fax = qbJson?.Fax?.FreeFormNumber || null;
  const website = qbJson?.WebAddr?.URI || null;
  const billAddr = qbJson?.BillAddr;
  const shipAddr = qbJson?.ShipAddr;

  // Name parts
  const givenName = qbJson?.GivenName || null;
  const middleName = qbJson?.MiddleName || null;
  const familyName = qbJson?.FamilyName || null;
  const title = qbJson?.Title || null;
  const suffix = qbJson?.Suffix || null;
  const displayName = qbJson?.DisplayName || null;
  const printOnCheckName = qbJson?.PrintOnCheckName || null;

  // Payment & billing
  const paymentMethod = qbJson?.PaymentMethodRef?.name || null;
  const salesTerms = qbJson?.SalesTermRef?.name || null;
  const preferredDelivery = qbJson?.PreferredDeliveryMethod || null;
  const taxable = qbJson?.Taxable;
  const currencyName = qbJson?.CurrencyRef?.name || null;
  const qbActive = qbJson?.Active;
  const qbNotes = qbJson?.Notes || null;

  // Metadata
  const qbCreated = qbJson?.MetaData?.CreateTime || null;
  const qbUpdated = qbJson?.MetaData?.LastUpdatedTime || null;

  // Balances
  const qbBalance = qbCustomer?.balance ?? qbJson?.Balance ?? null;
  const balanceWithJobs = qbJson?.BalanceWithJobs ?? null;

  const formatAddr = (addr: any) => {
    if (!addr) return null;
    return [addr.Line1, addr.City, addr.CountrySubDivisionCode, addr.PostalCode]
      .filter(Boolean)
      .join(", ") || null;
  };

  const formatAddrMultiline = (addr: any) => {
    if (!addr) return null;
    const parts = [addr.Line1, [addr.City, addr.CountrySubDivisionCode].filter(Boolean).join(", "), addr.PostalCode].filter(Boolean);
    return parts.length ? parts : null;
  };

  // ── Financial summary ──
  const financialSummary = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    let openBalance = 0;
    let overdueBalance = 0;

    transactions.forEach((txn) => {
      if (txn.entity_type === "Invoice" && (txn.balance ?? 0) > 0) {
        openBalance += txn.balance ?? 0;
        const dueDate = (txn.raw_json as any)?.DueDate;
        if (dueDate && dueDate < today) {
          overdueBalance += txn.balance ?? 0;
        }
      }
    });

    return { openBalance, overdueBalance };
  }, [transactions]);

  // ── Date range helper ──
  function getDateRange(preset: string): { start: string; end: string } | null {
    if (preset === "all") return null;
    const now = new Date();
    const fmt = (d: Date) => format(d, "yyyy-MM-dd");
    const todayStr = fmt(now);
    const endStr = fmt(endOfDay(now));
    switch (preset) {
      case "today": return { start: todayStr, end: todayStr };
      case "yesterday": { const y = subDays(now, 1); return { start: fmt(y), end: fmt(y) }; }
      case "this_week": return { start: fmt(startOfWeek(now, { weekStartsOn: 0 })), end: endStr };
      case "last_week": { const s = subDays(startOfWeek(now, { weekStartsOn: 0 }), 7); return { start: fmt(s), end: fmt(subDays(startOfWeek(now, { weekStartsOn: 0 }), 1)) }; }
      case "this_month": return { start: fmt(startOfMonth(now)), end: endStr };
      case "last_month": { const s = startOfMonth(subMonths(now, 1)); return { start: fmt(s), end: fmt(subDays(startOfMonth(now), 1)) }; }
      case "last_30": return { start: fmt(subDays(now, 30)), end: endStr };
      case "last_3m": return { start: fmt(subMonths(now, 3)), end: endStr };
      case "last_6m": return { start: fmt(subMonths(now, 6)), end: endStr };
      case "last_12m": return { start: fmt(subMonths(now, 12)), end: endStr };
      case "ytd": return { start: fmt(startOfYear(now)), end: endStr };
      case "this_year": return { start: fmt(startOfYear(now)), end: endStr };
      case "last_year": { const ly = subYears(now, 1); return { start: fmt(startOfYear(ly)), end: fmt(new Date(ly.getFullYear(), 11, 31)) }; }
      case "2025": return { start: "2025-01-01", end: "2025-12-31" };
      case "2024": return { start: "2024-01-01", end: "2024-12-31" };
      case "2023": return { start: "2023-01-01", end: "2023-12-31" };
      default: return null;
    }
  }

  // ── Filtered transactions ──
  const filteredTxns = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const dateRange = getDateRange(dateFilter);
    return transactions.filter((txn) => {
      if (typeFilter !== "all" && txn.entity_type !== typeFilter) return false;
      if (statusFilter === "open" && (txn.balance ?? 0) <= 0) return false;
      if (statusFilter === "closed" && (txn.balance ?? 0) > 0) return false;
      if (statusFilter === "overdue") {
        const dueDate = (txn.raw_json as any)?.DueDate;
        if (!dueDate || dueDate >= today || (txn.balance ?? 0) <= 0) return false;
      }
      if (dateRange && txn.txn_date) {
        if (txn.txn_date < dateRange.start || txn.txn_date > dateRange.end) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, statusFilter, dateFilter]);

  const getTxnStatus = (txn: (typeof transactions)[0]) => {
    const today = new Date().toISOString().split("T")[0];
    if ((txn.balance ?? 0) <= 0) return { label: "Paid", variant: "default" as const };
    const dueDate = (txn.raw_json as any)?.DueDate;
    if (dueDate && dueDate < today) {
      const days = differenceInDays(new Date(), new Date(dueDate));
      return { label: `Overdue ${days}d`, variant: "destructive" as const };
    }
    return { label: "Open", variant: "secondary" as const };
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const initials = customer.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const fmtCurrency = (v: number | null) =>
    v != null ? `$${v.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-6 py-5 border-b border-border space-y-4">
        {/* Top: avatar + name + actions */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold truncate">{customer.name}</h2>
            {customer.company_name && (
              <p className="text-sm text-muted-foreground">{customer.company_name}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                {customer.status}
              </Badge>
              {qbActive === false && (
                <Badge variant="destructive">Inactive in QB</Badge>
              )}
              <Badge variant="outline">{customer.customer_type}</Badge>
              {customer.payment_terms && (
                <Badge variant="outline">{customer.payment_terms}</Badge>
              )}
              {salesTerms && (
                <Badge variant="outline">{salesTerms}</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="w-4 h-4 mr-1" /> Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  New transaction <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openTxnDialog("Invoice")}>Invoice</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTxnDialog("Payment")}>Payment</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTxnDialog("Estimate")}>Estimate</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTxnDialog("SalesReceipt")}>Sales receipt</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openTxnDialog("CreditMemo")}>Credit memo</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Customer</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to permanently delete <strong>{customer.name}</strong>? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Contact info grid + Financial summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Contact info */}
          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {email && (
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="truncate">{email}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(email)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            )}
            {phone && (
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p>{phone}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(phone)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            )}
            {mobile && (
              <div className="flex items-start gap-2">
                <Smartphone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Mobile</p>
                  <p>{mobile}</p>
                </div>
              </div>
            )}
            {altPhone && (
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Alt. Phone</p>
                  <p>{altPhone}</p>
                </div>
              </div>
            )}
            {fax && (
              <div className="flex items-start gap-2">
                <Printer className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Fax</p>
                  <p>{fax}</p>
                </div>
              </div>
            )}
            {website && (
              <div className="flex items-start gap-2">
                <Globe className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Website</p>
                  <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noreferrer" className="text-primary underline truncate block">{website}</a>
                </div>
              </div>
            )}
            {formatAddr(billAddr) && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Billing</p>
                  <p className="text-xs">{formatAddr(billAddr)}</p>
                </div>
              </div>
            )}
            {formatAddr(shipAddr) && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Shipping</p>
                  <p className="text-xs">{formatAddr(shipAddr)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Financial summary card */}
          <Card className="bg-secondary/30">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Financial Summary</p>
              {qbBalance != null && (
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">QB Balance</span>
                  <span className="text-lg font-semibold">{fmtCurrency(qbBalance)}</span>
                </div>
              )}
              {balanceWithJobs != null && (
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">Balance w/ Jobs</span>
                  <span className="text-sm font-medium">{fmtCurrency(balanceWithJobs)}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Open Balance</span>
                <span className="text-lg font-semibold">
                  {fmtCurrency(financialSummary.openBalance)}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Overdue</span>
                <span className={`text-lg font-semibold ${financialSummary.overdueBalance > 0 ? "text-destructive" : ""}`}>
                  {fmtCurrency(financialSummary.overdueBalance)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Smart Suggestion Banner ── */}
      {matchingPatterns.length > 0 && (() => {
        const topPattern = matchingPatterns.find((p) => p.id !== dismissedPatternId);
        if (!topPattern) return null;
        const tpl = topPattern.action_payload_template as any;
        const actionLabel = topPattern.action_type || "Transaction";
        const isAutoFill = (topPattern.times_used || 0) >= 3;
        return (
          <div className="mx-6 mt-3 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
            <Lightbulb className="w-4 h-4 text-primary shrink-0" />
            <p className="text-sm flex-1">
              {isAutoFill
                ? `Auto-draft ready: Create ${actionLabel} (used ${topPattern.times_used}× before)`
                : `Suggestion: Create ${actionLabel} for this customer`}
            </p>
            <Button
              size="sm"
              variant="default"
              className="text-xs"
              onClick={() =>
                openTxnDialog(topPattern.action_type as TransactionType, {
                  lineItems: tpl?.lineItems,
                  memo: tpl?.memo,
                })
              }
            >
              Apply
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setDismissedPatternId(topPattern.id)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })()}

      {/* ── Tabs ── */}
      <Tabs defaultValue="transactions" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-6 mt-4 justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="transactions" className="gap-1">
            <List className="w-3 h-3" /> Transaction List
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-1">
            <User className="w-3 h-3" /> Customer Details
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-1">
            <StickyNote className="w-3 h-3" /> Notes
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-1">
            <Clock className="w-3 h-3" /> Activity
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          {/* ─── Transaction List ─── */}
          <TabsContent value="transactions" className="mt-0 px-6 py-4 space-y-3">
            {/* Filters */}
            <div className="flex items-center gap-3">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="Invoice">Invoice</SelectItem>
                  <SelectItem value="Payment">Payment</SelectItem>
                  <SelectItem value="Estimate">Estimate</SelectItem>
                  <SelectItem value="CreditMemo">Credit Memo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed / Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this_week">This week</SelectItem>
                  <SelectItem value="last_week">Last week</SelectItem>
                  <SelectItem value="this_month">This month</SelectItem>
                  <SelectItem value="last_month">Last month</SelectItem>
                  <SelectItem value="last_30">Last 30 days</SelectItem>
                  <SelectItem value="last_3m">Last 3 months</SelectItem>
                  <SelectItem value="last_6m">Last 6 months</SelectItem>
                  <SelectItem value="last_12m">Last 12 months</SelectItem>
                  <SelectItem value="ytd">Year to date</SelectItem>
                  <SelectItem value="this_year">This year</SelectItem>
                  <SelectItem value="last_year">Last year</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground ml-auto">
                {filteredTxns.length} transaction{filteredTxns.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">DATE</TableHead>
                    <TableHead className="text-xs">TYPE</TableHead>
                    <TableHead className="text-xs">NO.</TableHead>
                    <TableHead className="text-xs">MEMO</TableHead>
                    <TableHead className="text-xs text-right">AMOUNT</TableHead>
                    <TableHead className="text-xs text-right">BALANCE</TableHead>
                    <TableHead className="text-xs text-right">STATUS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txnLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredTxns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTxns.map((txn) => {
                      const status = getTxnStatus(txn);
                      const memo = (txn.raw_json as any)?.PrivateNote ||
                        (txn.raw_json as any)?.CustomerMemo?.value || "";
                      return (
                        <TableRow key={txn.id}>
                          <TableCell className="text-xs">
                            {txn.txn_date ? format(new Date(txn.txn_date), "MMM d, yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-xs">{txn.entity_type}</TableCell>
                          <TableCell className="text-xs font-medium text-primary">
                            {txn.doc_number ? (
                              <button
                                className="underline hover:text-primary/80 cursor-pointer bg-transparent border-none p-0 text-primary text-xs font-medium"
                                onClick={async () => {
                                  try {
                                    const { data: rows } = await supabase
                                      .from("accounting_mirror")
                                      .select("data")
                                      .eq("entity_type", "Invoice")
                                      .filter("data->>DocNumber", "eq", txn.doc_number!)
                                      .limit(1);
                                    const raw = rows?.[0]?.data as Record<string, unknown> | null;
                                    if (raw && raw.Id) {
                                      setPreviewInvoice(raw as unknown as QBInvoice);
                                    } else {
                                      window.location.href = `/accounting?tab=invoices&search=${encodeURIComponent(txn.doc_number!)}`;
                                    }
                                  } catch {
                                    window.location.href = `/accounting?tab=invoices&search=${encodeURIComponent(txn.doc_number!)}`;
                                  }
                                }}
                              >
                                {txn.doc_number}
                              </button>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {memo || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-right font-medium">
                            ${(txn.total_amt ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            ${(txn.balance ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={status.variant} className="text-[10px]">
                              {status.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ─── Customer Details (Full QB Clone) ─── */}
          <TabsContent value="details" className="mt-0 px-6 py-4 space-y-4">
            {/* Section 1: Contact Information (from QB) */}
            {qbJson && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                  <InfoRow label="Display Name" value={displayName} />
                  <InfoRow label="Given Name" value={givenName} />
                  <InfoRow label="Middle Name" value={middleName} />
                  <InfoRow label="Family Name" value={familyName} />
                  <InfoRow label="Title" value={title} />
                  <InfoRow label="Suffix" value={suffix} />
                  <InfoRow label="Print on Check Name" value={printOnCheckName} />
                </CardContent>
              </Card>
            )}

            {/* Section 2: Communication (from QB) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">Communication</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                <InfoRow label="Primary Email" value={email} />
                <InfoRow label="Primary Phone" value={phone} />
                <InfoRow label="Mobile" value={mobile} />
                <InfoRow label="Alternate Phone" value={altPhone} />
                <InfoRow label="Fax" value={fax} />
                <InfoRow label="Website" value={website} />
                {!email && !phone && !mobile && !altPhone && !fax && !website && (
                  <p className="text-sm text-muted-foreground col-span-full">No communication info available</p>
                )}
              </CardContent>
            </Card>

            {/* Section 3: Addresses (from QB) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">Addresses</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Billing Address</p>
                  {formatAddrMultiline(billAddr) ? (
                    <div className="text-sm space-y-0.5">
                      {formatAddrMultiline(billAddr)!.map((line, i) => (
                        <p key={i} className="font-medium">{line}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Shipping Address</p>
                  {formatAddrMultiline(shipAddr) ? (
                    <div className="text-sm space-y-0.5">
                      {formatAddrMultiline(shipAddr)!.map((line, i) => (
                        <p key={i} className="font-medium">{line}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Section 4: Payment & Billing (from QB) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">Payment & Billing</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                <InfoRow label="Payment Method" value={paymentMethod} />
                <InfoRow label="Sales Terms" value={salesTerms} />
                <InfoRow label="Preferred Delivery" value={preferredDelivery} />
                <InfoRow label="Taxable" value={taxable != null ? (taxable ? "Yes" : "No") : null} />
                <InfoRow label="Currency" value={currencyName} />
                <InfoRow label="QB Balance" value={qbBalance != null ? fmtCurrency(qbBalance) : null} />
                <InfoRow label="Balance with Jobs" value={balanceWithJobs != null ? fmtCurrency(balanceWithJobs) : null} />
                {!paymentMethod && !salesTerms && !preferredDelivery && taxable == null && !currencyName && (
                  <p className="text-sm text-muted-foreground col-span-full">No payment info available</p>
                )}
              </CardContent>
            </Card>

            {/* Section 5: QB Metadata */}
            {qbJson && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">QuickBooks Metadata</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                  <InfoRow label="QuickBooks ID" value={customer.quickbooks_id} />
                  <InfoRow label="Active in QB" value={qbActive != null ? (qbActive ? "Yes" : "No") : null} />
                  <InfoRow label="QB Notes" value={qbNotes} />
                  <InfoRow label="Created in QB" value={qbCreated ? format(new Date(qbCreated), "MMM d, yyyy h:mm a") : null} />
                  <InfoRow label="Last Updated in QB" value={qbUpdated ? format(new Date(qbUpdated), "MMM d, yyyy h:mm a") : null} />
                </CardContent>
              </Card>
            )}

            {/* Section 6: Edit All Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold uppercase text-muted-foreground">Edit Customer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Open the full customer form to edit all fields including contacts, addresses, billing info, and notes.
                </p>
                <Button variant="outline" onClick={onEdit} className="gap-2">
                  <Pencil className="w-4 h-4" /> Edit All Details
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── Notes ─── */}
          <TabsContent value="notes" className="mt-0 px-6 py-4 space-y-3">
            {isEditingNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  rows={6}
                  placeholder="Add notes about this customer..."
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveNotesMutation.mutate(notesValue)} disabled={saveNotesMutation.isPending}>
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setIsEditingNotes(false); setNotesValue(customer.notes || ""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm whitespace-pre-wrap">{customer.notes || "No notes yet."}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setIsEditingNotes(true)}>
                  <Pencil className="w-3 h-3 mr-1" /> {customer.notes ? "Edit notes" : "Add notes"}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ─── Activity (placeholder) ─── */}
          <TabsContent value="activity" className="mt-0 px-6 py-4">
            <p className="text-sm text-muted-foreground">Activity feed coming soon.</p>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* ── Create Transaction Dialog ── */}
      <CreateTransactionDialog
        open={txnDialogOpen}
        onOpenChange={setTxnDialogOpen}
        type={txnDialogType}
        customerQbId={customer.quickbooks_id || ""}
        customerName={customer.name}
        prefill={txnPrefill}
        onCreated={recordPattern}
      />

      {/* ── Invoice Preview ── */}
      {previewInvoice && (
        <InvoiceEditor
          invoice={previewInvoice}
          customers={[]}
          items={[]}
          payments={[]}
          onUpdate={async () => {}}
          onClose={() => setPreviewInvoice(null)}
        />
      )}
    </div>
  );
}
