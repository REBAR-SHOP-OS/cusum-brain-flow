import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, Package } from "lucide-react";
import { useOrders } from "@/hooks/useOrders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: {
    id: string;
    quote_number: string;
    total_amount: number | null;
    customer_name: string;
  };
  onSuccess?: (orderId: string) => void;
}

export function ConvertQuoteDialog({ open, onOpenChange, quote, onSuccess }: Props) {
  const { convertQuote } = useOrders();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [linesSynced, setLinesSynced] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSyncLines = async () => {
    setSyncing(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("odoo-sync-order-lines", {
        body: { quoteId: quote.id },
      });
      if (fnErr) throw fnErr;
      setLinesSynced(data?.linesFound ?? 0);
      toast.success(`Synced ${data?.linesFound ?? 0} line items from Odoo`);
    } catch (err) {
      toast.error("Failed to sync line items");
      console.error(err);
    } finally {
      setSyncing(false);
    }
  };

  const handleConvert = async () => {
    setLoading(true);
    setError(null);
    try {
      // Auto-sync lines if not already synced
      if (linesSynced === null) {
        try {
          await supabase.functions.invoke("odoo-sync-order-lines", {
            body: { quoteId: quote.id },
          });
        } catch { /* non-blocking */ }
      }
      const result = await convertQuote(quote.id);
      onOpenChange(false);
      onSuccess?.(result.order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convert Quote to Order</DialogTitle>
          <DialogDescription>
            This will create a new order from quote <strong>{quote.quote_number}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Customer</span>
            <span className="font-medium">{quote.customer_name}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Amount</span>
            <span className="font-semibold">{fmt(quote.total_amount || 0)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Package className="w-4 h-4 shrink-0" />
              {linesSynced !== null
                ? `${linesSynced} line item(s) synced from Odoo`
                : "Line items will be auto-synced from Odoo on convert"}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSyncLines}
              disabled={syncing}
              className="text-xs h-7"
            >
              {syncing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              {linesSynced !== null ? "Re-sync" : "Sync Lines"}
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <ArrowRight className="w-4 h-4 shrink-0" />
            The order will be created with status "pending" and line items from Odoo automatically populated.
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            Create Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
