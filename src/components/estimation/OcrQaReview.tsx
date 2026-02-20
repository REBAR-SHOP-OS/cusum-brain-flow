import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronUp,
  Shield,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

type VerificationStatus = "pending_review" | "auto_approved" | "human_approved" | "rejected" | "override";

interface BarlistReview {
  id: string;
  name: string;
  source_type: string;
  status: string;
  created_at: string;
  ocr_confidence_score: number;
  verification_status: VerificationStatus;
  verified_at: string | null;
  verification_notes: string | null;
  auto_approved: boolean;
  qa_flags: any[];
  project_id: string;
  lead_id: string | null;
}

const statusConfig: Record<VerificationStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending_review: { label: "Pending Review", color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  auto_approved: { label: "Auto-Approved", color: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: <Shield className="h-3.5 w-3.5" /> },
  human_approved: { label: "Verified", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive border-destructive/30", icon: <XCircle className="h-3.5 w-3.5" /> },
  override: { label: "Override", color: "bg-purple-500/10 text-purple-600 border-purple-500/30", icon: <ShieldAlert className="h-3.5 w-3.5" /> },
};

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score);
  const color = pct >= 90 ? "text-emerald-600" : pct >= 70 ? "text-amber-600" : "text-destructive";
  return <span className={`font-mono font-bold ${color}`}>{pct}%</span>;
}

export default function OcrQaReview() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const { data: barlists = [], isLoading } = useQuery({
    queryKey: ["ocr_qa_review", companyId, filter],
    queryFn: async () => {
      let query = supabase
        .from("barlists")
        .select("id, name, source_type, status, created_at, ocr_confidence_score, verification_status, verified_at, verification_notes, auto_approved, qa_flags, project_id, lead_id")
        .in("source_type", ["ai_vision_extract", "ai_deep_ocr_extract", "historical_import"])
        .order("created_at", { ascending: false })
        .limit(100);

      if (filter === "pending") {
        query = query.eq("verification_status", "pending_review");
      } else if (filter === "approved") {
        query = query.in("verification_status", ["human_approved", "auto_approved"]);
      } else if (filter === "rejected") {
        query = query.in("verification_status", ["rejected"]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as BarlistReview[];
    },
    enabled: !!companyId,
  });

  const { data: itemCounts = {} } = useQuery({
    queryKey: ["ocr_qa_item_counts", barlists.map(b => b.id)],
    queryFn: async () => {
      if (barlists.length === 0) return {};
      const { data, error } = await supabase
        .from("barlist_items")
        .select("barlist_id, id")
        .in("barlist_id", barlists.map(b => b.id));
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const item of data ?? []) {
        counts[item.barlist_id] = (counts[item.barlist_id] || 0) + 1;
      }
      return counts;
    },
    enabled: barlists.length > 0,
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: VerificationStatus; note?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("barlists")
        .update({
          verification_status: status,
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
          verification_notes: note || null,
        } as any)
        .eq("id", id);
      if (error) throw error;

      // Update verification stats for "first 10" rule
      if (status === "human_approved") {
        const barlist = barlists.find(b => b.id === id);
        if (barlist) {
          try {
            await supabase.from("ocr_verification_stats" as any).upsert({
              company_id: companyId,
              project_id: barlist.project_id,
              human_verified_count: 1,
              updated_at: new Date().toISOString(),
            } as any, { onConflict: "company_id,project_id" });
          } catch (e) {
            console.error("Stats upsert error:", e);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ocr_qa_review"] });
      toast.success("Verification updated");
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const pendingCount = barlists.filter(b => b.verification_status === "pending_review").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            OCR Quality Review
          </h2>
          <p className="text-sm text-muted-foreground">
            Verify AI-extracted barlists before they enter production. First 10 per project require manual review.
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="text-sm px-3 py-1">
            {pendingCount} pending
          </Badge>
        )}
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "pending" ? "Pending Review" : f === "approved" ? "Approved" : f === "rejected" ? "Rejected" : "All"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : barlists.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500" />
            <p>No extractions {filter === "all" ? "found" : `in "${filter}" status`}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {barlists.map((bl) => {
            const expanded = expandedId === bl.id;
            const cfg = statusConfig[bl.verification_status] || statusConfig.pending_review;
            const count = itemCounts[bl.id] || 0;

            return (
              <Card key={bl.id} className="overflow-hidden">
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : bl.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{bl.name}</span>
                      <Badge variant="outline" className={`text-xs ${cfg.color} flex items-center gap-1`}>
                        {cfg.icon} {cfg.label}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">{bl.source_type.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>Confidence: <ConfidenceBadge score={bl.ocr_confidence_score} /></span>
                      <span>{count} items</span>
                      <span>{new Date(bl.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>

                {expanded && (
                  <CardContent className="border-t bg-muted/30 space-y-3 pt-3">
                    {/* QA Flags */}
                    {Array.isArray(bl.qa_flags) && bl.qa_flags.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">QA Flags:</p>
                        {bl.qa_flags.map((flag: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs bg-amber-500/10 p-2 rounded">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                            <span>{typeof flag === "string" ? flag : flag.message || JSON.stringify(flag)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Previous notes */}
                    {bl.verification_notes && (
                      <div className="text-xs text-muted-foreground bg-card p-2 rounded border">
                        <strong>Previous note:</strong> {bl.verification_notes}
                      </div>
                    )}

                    {/* Note input */}
                    <Textarea
                      placeholder="Add verification notes (optional)..."
                      value={notes[bl.id] || ""}
                      onChange={(e) => setNotes({ ...notes, [bl.id]: e.target.value })}
                      className="text-sm h-16"
                    />

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => verifyMutation.mutate({ id: bl.id, status: "human_approved", note: notes[bl.id] })}
                        disabled={verifyMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => verifyMutation.mutate({ id: bl.id, status: "rejected", note: notes[bl.id] })}
                        disabled={verifyMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => verifyMutation.mutate({ id: bl.id, status: "override", note: notes[bl.id] })}
                        disabled={verifyMutation.isPending}
                      >
                        <Eye className="h-4 w-4 mr-1" /> Override & Approve
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
