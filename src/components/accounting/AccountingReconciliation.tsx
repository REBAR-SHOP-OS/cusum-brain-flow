import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export function AccountingReconciliation() {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data: matches = [], isLoading } = useQuery({
    queryKey: ["reconciliation-matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reconciliation_matches" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const runReconciliation = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-reconcile");
      if (error) throw error;
      toast.success(data?.message || "Reconciliation complete");
      queryClient.invalidateQueries({ queryKey: ["reconciliation-matches"] });
    } catch (e: any) {
      toast.error("Reconciliation failed: " + (e.message || "Unknown error"));
    } finally {
      setRunning(false);
    }
  };

  const updateMatch = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("reconciliation_matches" as any)
        .update({ status, reviewed_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-matches"] });
      toast.success("Match updated");
    },
  });

  const autoMatched = matches.filter((m: any) => m.status === "auto_matched");
  const pending = matches.filter((m: any) => m.status === "pending");
  const approved = matches.filter((m: any) => m.status === "approved");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Auto-Reconciliation</h2>
          <p className="text-sm text-muted-foreground">
            Only 100% confidence matches are auto-approved. Everything else goes to Vicky.
          </p>
        </div>
        <Button onClick={runReconciliation} disabled={running} className="gap-2">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Run Reconciliation
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <ShieldCheck className="w-6 h-6 mx-auto text-emerald-500 mb-1" />
            <p className="text-2xl font-bold">{autoMatched.length}</p>
            <p className="text-xs text-muted-foreground">Auto-Matched (100%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold">{pending.length}</p>
            <p className="text-xs text-muted-foreground">Pending Review</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <CheckCircle2 className="w-6 h-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{approved.length}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : matches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No reconciliation matches yet. Click "Run Reconciliation" to start.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Pending reviews first */}
          {pending.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-4">
                Pending Review (Needs Vicky's Approval)
              </h3>
              {pending.map((m: any) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  onApprove={() => updateMatch.mutate({ id: m.id, status: "approved" })}
                  onReject={() => updateMatch.mutate({ id: m.id, status: "rejected" })}
                  showActions
                />
              ))}
            </>
          )}

          {/* Auto-matched */}
          {autoMatched.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-6">
                Auto-Matched (100% Confidence)
              </h3>
              {autoMatched.map((m: any) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </>
          )}

          {/* Approved */}
          {approved.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-6">
                Approved
              </h3>
              {approved.map((m: any) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MatchCard({
  match,
  onApprove,
  onReject,
  showActions = false,
}: {
  match: any;
  onApprove?: () => void;
  onReject?: () => void;
  showActions?: boolean;
}) {
  const confidence = match.confidence || 0;
  const badgeVariant = confidence === 100 ? "default" : confidence >= 70 ? "secondary" : "destructive";

  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium text-sm truncate">{match.bank_txn_description}</p>
              <Badge variant={badgeVariant as any} className="text-xs shrink-0">
                {confidence}% confidence
              </Badge>
              <Badge variant="outline" className="text-xs shrink-0">
                {match.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{match.match_reason}</p>
            {match.matched_entity_type && (
              <p className="text-xs text-muted-foreground mt-1">
                → Matched to: {match.matched_entity_type} #{match.matched_entity_id}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-sm">{fmt(Math.abs(match.bank_txn_amount || 0))}</p>
            <p className="text-xs text-muted-foreground">{match.bank_txn_date}</p>
          </div>
        </div>
        {showActions && (
          <div className="flex gap-2 mt-3 justify-end">
            <Button size="sm" variant="outline" onClick={onReject} className="gap-1">
              <XCircle className="w-3 h-3" /> Reject
            </Button>
            <Button size="sm" onClick={onApprove} className="gap-1">
              <CheckCircle2 className="w-3 h-3" /> Approve
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
