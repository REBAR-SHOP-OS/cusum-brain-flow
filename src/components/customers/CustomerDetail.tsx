import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

interface CustomerDetailProps {
  customer: Customer;
  onEdit: () => void;
  onDelete: () => void;
}

export function CustomerDetail({ customer, onEdit, onDelete }: CustomerDetailProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notesValue, setNotesValue] = useState(customer.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  // ── QB Customer info (addresses, email, phone) ──
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

  // ── Extract QB data ──
  const qbJson = qbCustomer?.raw_json as Record<string, any> | null;
  const email = qbJson?.PrimaryEmailAddr?.Address || primaryContact?.email || null;
  const phone = qbJson?.PrimaryPhone?.FreeFormNumber || primaryContact?.phone || null;
  const billAddr = qbJson?.BillAddr;
  const shipAddr = qbJson?.ShipAddr;

  const formatAddr = (addr: any) => {
    if (!addr) return null;
    return [addr.Line1, addr.City, addr.CountrySubDivisionCode, addr.PostalCode]
      .filter(Boolean)
      .join(", ") || null;
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

  // ── Filtered transactions ──
  const filteredTxns = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return transactions.filter((txn) => {
      if (typeFilter !== "all" && txn.entity_type !== typeFilter) return false;
      if (statusFilter === "open" && (txn.balance ?? 0) <= 0) return false;
      if (statusFilter === "closed" && (txn.balance ?? 0) > 0) return false;
      if (statusFilter === "overdue") {
        const dueDate = (txn.raw_json as any)?.DueDate;
        if (!dueDate || dueDate >= today || (txn.balance ?? 0) <= 0) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, statusFilter]);

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
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                {customer.status}
              </Badge>
              <Badge variant="outline">{customer.customer_type}</Badge>
              {customer.payment_terms && (
                <Badge variant="outline">{customer.payment_terms}</Badge>
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
                <DropdownMenuItem>Invoice</DropdownMenuItem>
                <DropdownMenuItem>Payment</DropdownMenuItem>
                <DropdownMenuItem>Estimate</DropdownMenuItem>
                <DropdownMenuItem>Sales receipt</DropdownMenuItem>
                <DropdownMenuItem>Credit memo</DropdownMenuItem>
                <DropdownMenuItem>Statement</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Contact info + Financial summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Contact info */}
          <div className="md:col-span-2 grid grid-cols-2 gap-3 text-sm">
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
            {formatAddr(billAddr) && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Billing address</p>
                  <p className="text-xs">{formatAddr(billAddr)}</p>
                </div>
              </div>
            )}
            {formatAddr(shipAddr) && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Shipping address</p>
                  <p className="text-xs">{formatAddr(shipAddr)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Financial summary card */}
          <Card className="bg-secondary/30">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase">Financial Summary</p>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Open Balance</span>
                <span className="text-lg font-semibold">
                  ${financialSummary.openBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Overdue</span>
                <span className={`text-lg font-semibold ${financialSummary.overdueBalance > 0 ? "text-destructive" : ""}`}>
                  ${financialSummary.overdueBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

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
                            {txn.doc_number || "—"}
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

          {/* ─── Customer Details ─── */}
          <TabsContent value="details" className="mt-0 px-6 py-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoRow label="Name" value={customer.name} />
              <InfoRow label="Company" value={customer.company_name} />
              <InfoRow label="Email" value={email} />
              <InfoRow label="Phone" value={phone} />
              <InfoRow label="Status" value={customer.status} />
              <InfoRow label="Type" value={customer.customer_type} />
              <InfoRow label="Payment Terms" value={customer.payment_terms} />
              <InfoRow label="Credit Limit" value={customer.credit_limit ? `$${customer.credit_limit.toLocaleString()}` : null} />
              <InfoRow label="Billing Address" value={formatAddr(billAddr)} />
              <InfoRow label="Shipping Address" value={formatAddr(shipAddr)} />
              <InfoRow label="QuickBooks ID" value={customer.quickbooks_id} />
              <InfoRow label="Created" value={format(new Date(customer.created_at), "MMM d, yyyy")} />
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-1" /> Edit Customer Details
              </Button>
            </div>
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
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
