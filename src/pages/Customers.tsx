import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SmartSearchInput, type SmartSearchHint } from "@/components/ui/SmartSearchInput";
import { Plus, Printer, Download, Settings } from "lucide-react";
import { CustomerTable, type SortField, type SortDir } from "@/components/customers/CustomerTable";
import { CustomerSummaryBar } from "@/components/customers/CustomerSummaryBar";
import { CustomerDetail } from "@/components/customers/CustomerDetail";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

export default function Customers() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Customers ──
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("customers")
        .select("*")
        .order("name", { ascending: true });
      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
  });

  // ── Primary contacts (phone) ──
  const { data: primaryContacts = [] } = useQuery({
    queryKey: ["primary_contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("customer_id, phone")
        .eq("is_primary", true)
        .not("phone", "is", null);
      if (error) throw error;
      return data as { customer_id: string | null; phone: string | null }[];
    },
  });

  // ── QB invoice balances ──
  const { data: invoiceBalances = [] } = useQuery({
    queryKey: ["qb_invoice_balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qb_transactions")
        .select("customer_qb_id, balance, total_amt, txn_date")
        .eq("entity_type", "Invoice")
        .eq("is_deleted", false)
        .eq("is_voided", false)
        .gt("balance", 0);
      if (error) throw error;
      return data as { customer_qb_id: string | null; balance: number | null; total_amt: number | null; txn_date: string | null }[];
    },
  });

  // ── Quote totals ──
  const { data: quoteStats } = useQuery({
    queryKey: ["quote_stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, total_amount, status");
      if (error) throw error;
      const active = (data || []).filter((q) => q.status !== "rejected" && q.status !== "expired");
      return { count: active.length, total: active.reduce((s, q) => s + (q.total_amount ?? 0), 0) };
    },
  });

  // ── Overdue invoices ──
  const { data: overdueInvoices = [] } = useQuery({
    queryKey: ["qb_overdue_invoices"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("qb_transactions")
        .select("id, balance, raw_json, customer_qb_id")
        .eq("entity_type", "Invoice")
        .eq("is_deleted", false)
        .eq("is_voided", false)
        .gt("balance", 0)
        .lt("txn_date", today);
      if (error) throw error;
      // Filter by DueDate from raw_json
      return (data || []).filter((inv) => {
        const dueDate = (inv.raw_json as any)?.DueDate;
        return dueDate && dueDate < today;
      });
    },
  });

  // ── Recently paid ──
  const { data: recentlyPaid = [] } = useQuery({
    queryKey: ["qb_recently_paid"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("qb_transactions")
        .select("id, total_amt")
        .eq("entity_type", "Payment")
        .eq("is_deleted", false)
        .eq("is_voided", false)
        .gte("txn_date", thirtyDaysAgo);
      if (error) throw error;
      return data || [];
    },
  });

  // ── Derived data ──
  const phoneMap = useMemo(() => {
    const m = new Map<string, string>();
    primaryContacts.forEach((c) => { if (c.customer_id && c.phone) m.set(c.customer_id, c.phone); });
    return m;
  }, [primaryContacts]);

  const balanceByQbId = useMemo(() => {
    const m = new Map<string, number>();
    invoiceBalances.forEach((inv) => {
      if (inv.customer_qb_id) {
        m.set(inv.customer_qb_id, (m.get(inv.customer_qb_id) || 0) + (inv.balance || 0));
      }
    });
    return m;
  }, [invoiceBalances]);

  // ── Invoice counts per customer ──
  const invoiceCountByQbId = useMemo(() => {
    const m = new Map<string, number>();
    invoiceBalances.forEach((inv) => {
      if (inv.customer_qb_id) {
        m.set(inv.customer_qb_id, (m.get(inv.customer_qb_id) || 0) + 1);
      }
    });
    return m;
  }, [invoiceBalances]);

  const overdueCountByQbId = useMemo(() => {
    const m = new Map<string, number>();
    overdueInvoices.forEach((inv) => {
      // overdueInvoices already filtered by customer_qb_id isn't available directly
      // We need to get customer_qb_id from the raw_json or re-query
      const custQbId = (inv as any).customer_qb_id;
      if (custQbId) {
        m.set(custQbId, (m.get(custQbId) || 0) + 1);
      }
    });
    return m;
  }, [overdueInvoices]);

  const rows = useMemo(() => {
    const mapped = customers.map((c) => ({
      customer: c,
      phone: phoneMap.get(c.id) || null,
      openBalance: c.quickbooks_id ? (balanceByQbId.get(c.quickbooks_id) || 0) : 0,
      invoiceCount: c.quickbooks_id ? (invoiceCountByQbId.get(c.quickbooks_id) || 0) : 0,
      overdueCount: c.quickbooks_id ? (overdueCountByQbId.get(c.quickbooks_id) || 0) : 0,
    }));

    mapped.sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.customer.name.localeCompare(b.customer.name);
      else if (sortField === "company_name") cmp = (a.customer.company_name || "").localeCompare(b.customer.company_name || "");
      else if (sortField === "open_balance") cmp = a.openBalance - b.openBalance;
      return sortDir === "desc" ? -cmp : cmp;
    });

    return mapped;
  }, [customers, phoneMap, balanceByQbId, invoiceCountByQbId, overdueCountByQbId, sortField, sortDir]);

  // ── Summary stats ──
  const summaryStats = useMemo(() => {
    const openTotal = invoiceBalances.reduce((s, inv) => s + (inv.balance || 0), 0);
    const overdueTotal = overdueInvoices.reduce((s, inv) => s + ((inv.balance as number) || 0), 0);
    const paidTotal = recentlyPaid.reduce((s, p) => s + ((p.total_amt as number) || 0), 0);

    return [
      { label: "Estimates", count: quoteStats?.count || 0, total: quoteStats?.total || 0, color: "hsl(210, 70%, 55%)" },
      { label: "Unbilled Income", count: 0, total: 0, color: "hsl(170, 60%, 45%)" },
      { label: "Overdue", count: overdueInvoices.length, total: overdueTotal, color: "hsl(0, 70%, 55%)" },
      { label: "Open Invoices", count: invoiceBalances.length, total: openTotal, color: "hsl(35, 80%, 55%)" },
      { label: "Recently Paid", count: recentlyPaid.length, total: paidTotal, color: "hsl(130, 50%, 50%)" },
    ];
  }, [quoteStats, invoiceBalances, overdueInvoices, recentlyPaid]);

  // ── Mutations ──
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setSelectedCustomerId(null);
      toast({ title: "Customer deleted" });
    },
    onError: (error) => {
      toast({ title: "Error deleting customer", description: error.message, variant: "destructive" });
    },
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleFormClose = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) setEditingCustomer(null);
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-semibold">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {customers.length} customer{customers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Customer</span>
        </Button>
      </header>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="px-4 sm:px-6 py-4 space-y-4">
          {/* Summary Cards */}
          <CustomerSummaryBar stats={summaryStats} />

          {/* Search + Toolbar */}
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-md">
              <SmartSearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search customers..."
                hints={[
                  { category: "Status", suggestions: ["active", "inactive", "prospect"] },
                ]}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Printer className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Full-Width Table */}
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <CustomerTable
              rows={rows}
              isLoading={isLoading}
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
              onRowClick={(id) => setSelectedCustomerId(id)}
            />
          </div>
        </div>
      </ScrollArea>

      {/* Detail Sheet */}
      <Sheet open={!!selectedCustomer} onOpenChange={(open) => { if (!open) setSelectedCustomerId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-4xl p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{selectedCustomer?.name ?? "Customer Detail"}</SheetTitle>
            <SheetDescription>Customer details and history</SheetDescription>
          </SheetHeader>
          {selectedCustomer && (
            <CustomerDetail
              customer={selectedCustomer}
              onEdit={() => handleEdit(selectedCustomer)}
              onDelete={() => handleDelete(selectedCustomer.id)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Form Modal */}
      <CustomerFormModal
        open={isFormOpen}
        onOpenChange={handleFormClose}
        customer={editingCustomer}
      />
    </div>
  );
}
