import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { PortalInvoice } from "@/hooks/useCustomerPortalData";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function CustomerInvoiceList({ invoices }: { invoices: PortalInvoice[] }) {
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <FileText className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">No invoices found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-muted-foreground uppercase">Total Invoices</p>
            <p className="text-xl font-bold">{invoices.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-muted-foreground uppercase">Outstanding</p>
            <p className="text-xl font-bold text-destructive">
              {fmt(invoices.reduce((s, i) => s + (i.balance || 0), 0))}
            </p>
          </CardContent>
        </Card>
        <Card className="hidden sm:block">
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-muted-foreground uppercase">Paid</p>
            <p className="text-xl font-bold text-primary">
              {invoices.filter(i => (i.balance || 0) === 0).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice List */}
      <div className="grid gap-3">
        {invoices.map((inv) => {
          const d = inv.data || {};
          const docNumber = d.DocNumber || inv.quickbooks_id;
          const txnDate = d.TxnDate;
          const dueDate = d.DueDate;
          const totalAmt = d.TotalAmt ?? 0;
          const balance = inv.balance ?? 0;
          const isPaid = balance === 0;

          return (
            <Card key={inv.id} className="hover:bg-muted/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Invoice #{docNumber}</span>
                  </div>
                  <Badge className={isPaid
                    ? "bg-primary/20 text-primary"
                    : "bg-destructive/20 text-destructive"
                  }>
                    {isPaid ? "Paid" : "Outstanding"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    {txnDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(txnDate), "MMM d, yyyy")}
                      </span>
                    )}
                    {dueDate && !isPaid && (
                      <span className="text-destructive/70">
                        Due: {format(new Date(dueDate), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {fmt(totalAmt)}
                    </span>
                    {!isPaid && (
                      <span className="font-medium text-destructive">
                        Bal: {fmt(balance)}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
