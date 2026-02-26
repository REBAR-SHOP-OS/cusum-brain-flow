import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

interface StripeLink {
  id: string;
  invoice_number: string | null;
  customer_name: string | null;
  amount: number;
  status: string;
  created_at: string;
  stripe_url: string;
}

export function StripeCard() {
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected" | "error">("loading");
  const [accountName, setAccountName] = useState("");
  const [links, setLinks] = useState<StripeLink[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.functions.invoke("stripe-payment", {
          body: { action: "check-status" },
        });
        if (data?.status === "connected") {
          setStatus("connected");
          setAccountName(data.accountName || "Stripe");

          // Fetch payment links
          const { data: linksData } = await supabase.functions.invoke("stripe-payment", {
            body: { action: "list-payments" },
          });
          const allLinks = (linksData?.links || []) as StripeLink[];
          setLinks(allLinks.slice(0, 5));
          setTotalAmount(allLinks.reduce((s: number, l: StripeLink) => s + Number(l.amount || 0), 0));
        } else {
          setStatus("disconnected");
        }
      } catch {
        setStatus("error");
      }
    }
    load();
  }, []);

  return (
    <Card className="transition-all hover:ring-2 hover:ring-primary/30">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-base">Stripe</h3>
          </div>
          {status === "loading" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {status === "connected" && (
            <Badge variant="secondary" className="text-xs gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Connected
            </Badge>
          )}
          {status === "disconnected" && (
            <Badge variant="outline" className="text-xs gap-1">
              <XCircle className="w-3 h-3 text-muted-foreground" /> Not Connected
            </Badge>
          )}
        </div>

        {status === "connected" && (
          <>
            <p className="text-xs text-muted-foreground mb-3 truncate">{accountName}</p>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active Links</span>
                <span className="font-semibold tabular-nums">{links.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Outstanding</span>
                <span className="font-semibold tabular-nums">{fmt(totalAmount)}</span>
              </div>
            </div>

            {links.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Links</span>
                {links.slice(0, 3).map((l) => (
                  <div key={l.id} className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground truncate max-w-[55%]">
                      #{l.invoice_number || "—"} {l.customer_name || ""}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums">{fmt(l.amount)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => window.open(l.stripe_url, "_blank")}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {status === "disconnected" && (
          <p className="text-sm text-muted-foreground">
            Connect Stripe in Integrations to generate payment links for invoices.
          </p>
        )}

        {status === "error" && (
          <p className="text-sm text-destructive">
            Unable to check Stripe status.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
