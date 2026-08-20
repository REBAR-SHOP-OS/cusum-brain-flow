import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
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

const ERROR_MESSAGES: Record<string, string> = {
  no_key: "Stripe secret key is not configured.",
  invalid_key: "Invalid API key — make sure you're using a secret key (sk_…).",
  timeout: "Stripe API timed out. Try again shortly.",
  api_error: "Stripe returned an error.",
  unknown: "Unable to reach Stripe.",
};

export function StripeCard() {
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected" | "error">("loading");
  const [errorType, setErrorType] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [links, setLinks] = useState<StripeLink[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus(): Promise<{ ok: boolean; data: any }> {
      const { data } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "check-status" },
      });
      return { ok: data?.status === "connected", data };
    }

    async function load() {
      try {
        let result = await checkStatus();

        // Retry once after 3s if not connected (skip retry for invalid_key)
        if (!result.ok && result.data?.errorType !== "invalid_key" && !cancelled) {
          await new Promise(r => setTimeout(r, 3000));
          if (cancelled) return;
          result = await checkStatus();
        }

        if (cancelled) return;

        if (result.ok) {
          setStatus("connected");
          setAccountName(result.data.accountName || "Stripe");

          const { data: linksData } = await supabase.functions.invoke("stripe-payment", {
            body: { action: "list-payments" },
          });
          if (cancelled) return;
          const allLinks = (linksData?.links || []) as StripeLink[];
          setLinks(allLinks.slice(0, 5));
          setTotalAmount(allLinks.reduce((s: number, l: StripeLink) => s + Number(l.amount || 0), 0));
        } else if (result.data?.errorType) {
          setStatus("error");
          setErrorType(result.data.errorType);
        } else {
          setStatus("disconnected");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    load();
    return () => { cancelled = true; };
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
          {status === "error" && (
            <Badge variant="outline" className="text-xs gap-1 border-destructive/40 text-destructive">
              <AlertTriangle className="w-3 h-3" /> Error
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
            {ERROR_MESSAGES[errorType || "unknown"] || ERROR_MESSAGES.unknown}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
