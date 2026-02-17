import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, CreditCard, Loader2 } from "lucide-react";
import { format } from "date-fns";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingVendorPayments() {
  const { companyId } = useCompanyId();
  const [search, setSearch] = useState("");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["qb_vendor_payments", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qb_transactions")
        .select("id, entity_type, txn_date, doc_number, total_amt, balance, vendor_qb_id, raw_json")
        .eq("company_id", companyId!)
        .eq("entity_type", "BillPayment")
        .eq("is_deleted", false)
        .eq("is_voided", false)
        .order("txn_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = payments.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const vendorName = (p.raw_json as any)?.VendorRef?.name || "";
    return (
      vendorName.toLowerCase().includes(s) ||
      (p.doc_number || "").toLowerCase().includes(s)
    );
  });

  const totalPaid = filtered.reduce((sum, p) => sum + (p.total_amt ?? 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search vendor payments..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
        <Card className="shrink-0">
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="text-lg font-bold">{fmt(totalPaid)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Vendor Payments ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-lg">
              No vendor payments found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">Date</TableHead>
                  <TableHead className="text-base">No.</TableHead>
                  <TableHead className="text-base">Vendor</TableHead>
                  <TableHead className="text-base text-right">Amount</TableHead>
                  <TableHead className="text-base">Method</TableHead>
                  <TableHead className="text-base">Account</TableHead>
                  <TableHead className="text-base">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const raw = p.raw_json as any;
                  const vendorName = raw?.VendorRef?.name || "Unknown";
                  const payMethod = raw?.PayType || "—";
                  const account = raw?.CheckPayment?.BankAccountRef?.name
                    || raw?.CreditCardPayment?.CCAccountRef?.name
                    || raw?.APAccountRef?.name
                    || "—";
                  const balance = p.balance ?? 0;
                  const status = balance <= 0 ? "Paid" : "Partial";

                  return (
                    <TableRow key={p.id} className="text-base">
                      <TableCell>{p.txn_date ? format(new Date(p.txn_date), "MMM d, yyyy") : "—"}</TableCell>
                      <TableCell>{p.doc_number || "—"}</TableCell>
                      <TableCell className="font-semibold">{vendorName}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(p.total_amt ?? 0)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{payMethod}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{account}</TableCell>
                      <TableCell>
                        <Badge variant={status === "Paid" ? "secondary" : "outline"} className="text-xs">
                          {status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
