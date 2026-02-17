import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Users, Search, Loader2, Plus } from "lucide-react";
import { CustomerDetail } from "@/components/customers/CustomerDetail";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingCustomers({ data }: Props) {
  const { customers, invoices } = data;
  const [search, setSearch] = useState("");
  const [selectedQbId, setSelectedQbId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Look up local customer by quickbooks_id when a row is selected
  const { data: localCustomer, isLoading: localLoading } = useQuery({
    queryKey: ["local_customer_by_qb", selectedQbId],
    enabled: !!selectedQbId,
    queryFn: async () => {
      const { data: c, error } = await supabase
        .from("customers")
        .select("*")
        .eq("quickbooks_id", selectedQbId!)
        .maybeSingle();
      if (error) throw error;
      return c;
    },
  });

  const filtered = customers.filter(
    (c) =>
      c.DisplayName.toLowerCase().includes(search.toLowerCase()) ||
      (c.CompanyName || "").toLowerCase().includes(search.toLowerCase())
  );

  const enriched = filtered.map((c) => {
    const custInvoices = invoices.filter(i => i.CustomerRef?.value === c.Id);
    const openBalance = custInvoices.reduce((sum, i) => sum + (i.Balance || 0), 0);
    const overdue = custInvoices.filter(i => i.Balance > 0 && new Date(i.DueDate) < new Date()).length;
    return { ...c, openBalance, overdue, invoiceCount: custInvoices.length };
  });

  enriched.sort((a, b) => a.DisplayName.localeCompare(b.DisplayName, undefined, { sensitivity: 'base' }));

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Customers ({enriched.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {enriched.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-lg">
              No customers found — sync from QuickBooks first
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Name</TableHead>
                  <TableHead className="text-base">Company</TableHead>
                  <TableHead className="text-base text-center">Invoices</TableHead>
                  <TableHead className="text-base text-right">Open Balance</TableHead>
                  <TableHead className="text-base text-center">Overdue</TableHead>
                  <TableHead className="text-base">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.map((c) => (
                  <TableRow
                    key={c.Id}
                    className="text-base cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedQbId(c.Id)}
                  >
                    <TableCell className="font-semibold">{c.DisplayName}</TableCell>
                    <TableCell>{c.CompanyName || "—"}</TableCell>
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
                      <Badge className={`border-0 text-sm ${c.Active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {c.Active ? "Active" : "Inactive"}
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
      <Sheet open={!!selectedQbId} onOpenChange={(open) => { if (!open) setSelectedQbId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0 overflow-hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Customer Details</SheetTitle>
            <SheetDescription>View and edit customer details</SheetDescription>
          </SheetHeader>
          {selectedQbId && localLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
          {selectedQbId && !localLoading && localCustomer && (
            <CustomerDetail
              customer={localCustomer}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          )}
          {selectedQbId && !localLoading && !localCustomer && (
            <div className="p-8 text-center space-y-3">
              <p className="text-lg font-semibold">QB-Only Customer</p>
              <p className="text-muted-foreground">
                This customer exists in QuickBooks but hasn't been synced to your local database yet.
                Run a sync to view full details.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CustomerFormModal open={isFormOpen} onOpenChange={setIsFormOpen} customer={null} />
    </div>
  );
}

AccountingCustomers.displayName = "AccountingCustomers";
