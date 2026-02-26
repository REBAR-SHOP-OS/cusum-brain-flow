import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Copy, Check, RefreshCw, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";

const WEBHOOK_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stripe-qb-webhook`;

export function StripeQBSyncPanel() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [depositAccount, setDepositAccount] = useState("");
  const [depositLoaded, setDepositLoaded] = useState(false);

  // Load deposit account config
  const { data: companyConfig } = useQuery({
    queryKey: ["qb_company_config_stripe", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase
        .from("qb_company_config")
        .select("config")
        .eq("company_id", companyId)
        .maybeSingle();
      return data;
    },
    enabled: !!companyId,
  });

  // Set initial deposit account value
  if (companyConfig && !depositLoaded) {
    const cfg = companyConfig.config as Record<string, unknown> | null;
    setDepositAccount(String(cfg?.stripe_deposit_account || "Stripe Clearing"));
    setDepositLoaded(true);
  }

  // Recent sync records
  const { data: syncRecords, isLoading } = useQuery({
    queryKey: ["stripe_qb_sync_map", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("stripe_qb_sync_map")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as Record<string, unknown>[];
    },
    enabled: !!companyId,
    refetchInterval: 30_000,
  });

  // Save deposit account
  const saveDeposit = useMutation({
    mutationFn: async (account: string) => {
      if (!companyId) throw new Error("No company");
      const { data: existing } = await supabase
        .from("qb_company_config")
        .select("company_id, config")
        .eq("company_id", companyId)
        .maybeSingle();

      const currentConfig = (existing?.config as Record<string, unknown>) || {};
      const newConfig = { ...currentConfig, stripe_deposit_account: account };

      if (existing) {
        await supabase.from("qb_company_config").update({ config: newConfig }).eq("company_id", companyId);
      } else {
        await supabase.from("qb_company_config").insert({ company_id: companyId, config: newConfig });
      }
    },
    onSuccess: () => {
      toast.success("Deposit account saved");
      queryClient.invalidateQueries({ queryKey: ["qb_company_config_stripe"] });
    },
    onError: (e) => toast.error("Failed: " + (e as Error).message),
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColor = (status: string) => {
    if (status === "synced") return "default";
    if (status === "error") return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Stripe → QuickBooks Sync</h3>
      </div>

      {/* Webhook URL */}
      <div className="space-y-2">
        <Label>Webhook URL (paste in Stripe Dashboard)</Label>
        <div className="flex gap-2">
          <Input value={WEBHOOK_URL} readOnly className="font-mono text-xs" />
          <Button variant="outline" size="icon" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Events: <code>checkout.session.completed</code>, <code>payment_intent.succeeded</code>
        </p>
      </div>

      {/* Deposit Account */}
      <div className="space-y-2">
        <Label>QB Deposit Account</Label>
        <div className="flex gap-2">
          <Input
            value={depositAccount}
            onChange={(e) => setDepositAccount(e.target.value)}
            placeholder="Stripe Clearing"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => saveDeposit.mutate(depositAccount)}
            disabled={saveDeposit.isPending}
          >
            Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          QuickBooks account where Stripe payments are deposited (e.g. "Stripe Clearing" or "Undeposited Funds")
        </p>
      </div>

      {/* Recent Syncs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Recent Syncs</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["stripe_qb_sync_map"] })}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {(syncRecords?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No sync records yet. Stripe webhook events will appear here.
          </p>
        ) : (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>QB Invoice</TableHead>
                  <TableHead>QB Payment</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncRecords?.map((r) => (
                  <TableRow key={String(r.id)}>
                    <TableCell className="text-xs">
                      {r.created_at ? new Date(String(r.created_at)).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">
                      {String(r.customer_email || "—")}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      ${Number(r.total_amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {String(r.qb_doc_number || r.qb_invoice_id || "—")}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {String(r.qb_payment_id || "—")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColor(String(r.status))}>
                        {String(r.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
