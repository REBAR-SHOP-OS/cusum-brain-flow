import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Users, Search, Loader2, Plus } from "lucide-react";
import { DocumentUploadZone } from "@/components/accounting/DocumentUploadZone";
import { CustomerDetail } from "@/components/customers/CustomerDetail";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import type { Tables } from "@/integrations/supabase/types";

type Customer = Tables<"customers">;

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingCustomers() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Unified customer list from v_customers_clean ──
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ["customers", companyId, search],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("v_customers_clean" as any)
        .select("*")
        .eq("company_id", companyId!);
      if (search) {
        q = q.or(`name.ilike.%${search}%,company_name.ilike.%${search}%`);
      }
      q = q.order("display_name", { ascending: true });
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown) as Customer[];
    },
    staleTime: 1000 * 60 * 2,
  });

  // ── QB balance enrichment ──
  const { data: balanceMap } = useQuery({
    queryKey: ["qb_customer_balances", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data: rows, error } = await supabase.rpc("get_qb_customer_balances", {
        p_company_id: companyId!,
      });
      if (error) throw error;
      const map = new Map<string, { openBalance: number; invoiceCount: number; totalInvoiceCount: number }>();
      for (const r of rows ?? []) {
        if (r.customer_qb_id) {
          map.set(String(r.customer_qb_id), {
            openBalance: Number(r.open_balance),
            invoiceCount: Number(r.open_invoice_count),
            totalInvoiceCount: Number((r as any).total_invoice_count),
          });
        }
      }
      return map;
    },
    staleTime: 1000 * 60 * 2,
  });

  // ── Enriched rows ──
  const enriched = useMemo(() => {
    return customers.map((c) => {
      const bal = c.quickbooks_id ? balanceMap?.get(String(c.quickbooks_id)) : undefined;
      return {
        ...c,
        displayName: c.company_name || c.name || "—",
        secondaryName: c.company_name && c.name !== c.company_name ? c.name : null,
        openBalance: bal?.openBalance ?? 0,
        overdue: 0,
        invoiceCount: bal?.totalInvoiceCount ?? 0,
      };
    });
  }, [customers, balanceMap]);

  // ── Selected customer ──
  const selectedCustomer = selectedCustomerId
    ? customers.find((c) => c.id === selectedCustomerId)
    : null;

  // ── Delete mutation with pre-check ──
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Pre-check for linked financial records
      const [invoices, orders, quotes, leads] = await Promise.all([
        supabase.from("accounting_mirror").select("id", { count: "exact", head: true }).eq("customer_id", id).eq("entity_type", "Invoice"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", id),
        supabase.from("quotes").select("id", { count: "exact", head: true }).eq("customer_id", id),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("customer_id", id),
      ]);
      const total = (invoices.count ?? 0) + (orders.count ?? 0) + (quotes.count ?? 0) + (leads.count ?? 0);
      if (total > 0) {
        const parts: string[] = [];
        if (invoices.count) parts.push(`${invoices.count} invoice(s)`);
        if (orders.count) parts.push(`${orders.count} order(s)`);
        if (quotes.count) parts.push(`${quotes.count} quote(s)`);
        if (leads.count) parts.push(`${leads.count} lead(s)`);
        throw new Error(`Cannot delete: customer has ${parts.join(", ")}. Reassign or archive them first.`);
      }
      const { error: contactErr } = await supabase.from("contacts").delete().eq("customer_id", id);
      if (contactErr) console.warn("Failed to delete child contacts:", contactErr.message);
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["qb_customer_balances"] });
      setSelectedCustomerId(null);
      toast({ title: "Customer deleted" });
    },
    onError: (error) => {
      toast({ title: "Cannot delete customer", description: error.message, variant: "destructive" });
    },
  });

  // ── Callback after form save ──
  const handleFormSaved = useCallback(async (savedCustomer: Customer | null) => {
    if (!savedCustomer?.quickbooks_id) return;
    const { error } = await supabase
      .from("qb_customers")
      .update({
        display_name: savedCustomer.name,
        company_name: savedCustomer.company_name || null,
      })
      .eq("qb_id", savedCustomer.quickbooks_id);
    if (error) console.warn("Failed to sync qb_customers mirror after edit:", error.message);
    queryClient.invalidateQueries({ queryKey: ["customers"] });
  }, [queryClient]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="h-12 gap-2">
          <Plus className="w-4 h-4" /> Add Customer
        </Button>
      </div>

      <DocumentUploadZone
        targetType="customer"
        onImport={(result) => {
          toast({ title: "Customer imported", description: `${result.documentType} with ${result.fields.length} fields extracted.` });
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Customers ({enriched.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {customersLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : enriched.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-lg">
              No customers found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Company / Name</TableHead>
                  <TableHead className="text-base text-center">Invoices</TableHead>
                  <TableHead className="text-base text-right">Open Balance</TableHead>
                  <TableHead className="text-base text-center">Overdue</TableHead>
                  <TableHead className="text-base">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.map((c) => (
                  <TableRow
                    key={c.id}
                    className="text-base cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedCustomerId(c.id)}
                  >
                    <TableCell>
                      <div>
                        <span className="font-semibold">{c.displayName}</span>
                        {c.secondaryName && (
                          <span className="block text-sm text-muted-foreground">{c.secondaryName}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{c.invoiceCount}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {c.openBalance > 0 ? fmt(c.openBalance) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {c.overdue > 0 ? (
                        <Badge variant="destructive" className="text-sm">{c.overdue}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`border-0 text-sm ${c.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {c.status || "—"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Customer Detail Sheet */}
      <Sheet open={!!selectedCustomer} onOpenChange={(open) => { if (!open) setSelectedCustomerId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 overflow-hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Customer Details</SheetTitle>
            <SheetDescription>View and edit customer details</SheetDescription>
          </SheetHeader>
          {selectedCustomer && (
            <CustomerDetail
              customer={selectedCustomer}
              onEdit={() => {
                setEditingCustomer(selectedCustomer);
                setIsFormOpen(true);
              }}
              onDelete={() => deleteMutation.mutate(selectedCustomer.id)}
            />
          )}
        </SheetContent>
      </Sheet>

      <CustomerFormModal
        open={isFormOpen}
        onOpenChange={(open) => { setIsFormOpen(open); if (!open) setEditingCustomer(null); }}
        customer={editingCustomer}
        onSaved={handleFormSaved}
      />
    </div>
  );
}

AccountingCustomers.displayName = "AccountingCustomers";
