import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { QBInvoice } from "@/hooks/useQuickBooksData";

interface Props {
  invoice: QBInvoice;
  amountDue: number;
}

function rawField(invoice: QBInvoice, key: string): unknown {
  return (invoice as unknown as Record<string, unknown>)[key];
}

export function PaymentLinksSection({ invoice, amountDue }: Props) {
  const { toast } = useToast();
  const [stripeUrl, setStripeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // QuickBooks payment link
  const invoiceLink = rawField(invoice, "InvoiceLink") as string | undefined;
  const qbPayUrl = invoiceLink || `https://app.qbo.intuit.com/app/customerbalance?invoiceId=${invoice.Id}`;

  const generateStripeLink = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create-payment-link",
          amount: amountDue,
          currency: "cad",
          invoiceNumber: invoice.DocNumber,
          customerName: invoice.CustomerRef?.name,
          qbInvoiceId: invoice.Id,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.paymentLink?.stripe_url) {
        setStripeUrl(data.paymentLink.stripe_url);
        toast({ title: "Stripe link ready", description: "Payment link generated" });
      } else {
        throw new Error("No link returned");
      }
    } catch (e) {
      toast({ title: "Error", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Copied!", description: `${label} link copied to clipboard` });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <div className="mt-4 p-4 rounded-lg border border-border bg-muted/30 print:hidden">
      <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <CreditCard className="w-4 h-4" />
        Payment Links
      </h4>

      <div className="flex flex-col sm:flex-row gap-2">
        {/* QuickBooks Pay */}
        <div className="flex-1 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            onClick={() => window.open(qbPayUrl, "_blank")}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Pay via QuickBooks
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => copyToClipboard(qbPayUrl, "QuickBooks")}
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Stripe Pay */}
        <div className="flex-1 flex items-center gap-2">
          {stripeUrl ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2"
                onClick={() => window.open(stripeUrl, "_blank")}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Pay via Stripe
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => copyToClipboard(stripeUrl, "Stripe")}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              onClick={generateStripeLink}
              disabled={loading}
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
              {loading ? "Generating…" : "Generate Stripe Link"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
