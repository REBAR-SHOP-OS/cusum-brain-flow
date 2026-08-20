import { useState } from "react";
import { ShieldCheck, Check, X, Plus, Trash2, Loader2 } from "lucide-react";
import { useOfficeClearances, type OfficeClearanceStatus } from "@/hooks/useOfficeClearances";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const STATUS_META: Record<OfficeClearanceStatus, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  approved: { label: "Approved", tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  rejected: { label: "Rejected", tone: "bg-red-500/10 text-red-600 border-red-500/30" },
};

const ORDER: OfficeClearanceStatus[] = ["pending", "approved", "rejected"];

export function OfficeClearancesView() {
  const { data, isLoading, create, review, remove } = useOfficeClearances();
  const { isAdmin, isOffice } = useUserRole();
  const canReview = isAdmin || isOffice;

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      await create.mutateAsync({ title: title.trim(), notes: notes.trim() || undefined });
      toast({ title: "Clearance requested" });
      setTitle(""); setNotes(""); setOpen(false);
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleReview = async (id: string, status: "approved" | "rejected") => {
    try {
      await review.mutateAsync({ id, status });
      toast({ title: `Marked ${status}` });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this clearance?")) return;
    try {
      await remove.mutateAsync(id);
      toast({ title: "Deleted" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const grouped: Record<OfficeClearanceStatus, typeof data> = {
    pending: [], approved: [], rejected: [],
  } as any;
  (data ?? []).forEach((c) => grouped[c.status].push(c));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold">Office Clearances</h1>
            <p className="text-xs text-muted-foreground">Office-side approvals and sign-offs</p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Request clearance</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={!title.trim() || create.isPending}>
                {create.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (data ?? []).length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">
          No clearances yet. Click "New" to request one.
        </Card>
      ) : (
        <div className="space-y-6">
          {ORDER.map((status) => {
            const items = grouped[status];
            if (!items?.length) return null;
            const meta = STATUS_META[status];
            return (
              <div key={status} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={meta.tone}>{meta.label}</Badge>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((c) => (
                    <Card key={c.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm">{c.title}</div>
                        {c.notes && (
                          <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{c.notes}</div>
                        )}
                        <div className="text-[11px] text-muted-foreground/70 mt-2">
                          Requested {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                          {c.reviewed_at && ` · Reviewed ${formatDistanceToNow(new Date(c.reviewed_at), { addSuffix: true })}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canReview && status === "pending" && (
                          <>
                            <Button size="sm" variant="outline"
                              onClick={() => handleReview(c.id, "approved")}
                              disabled={review.isPending}>
                              <Check className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline"
                              onClick={() => handleReview(c.id, "rejected")}
                              disabled={review.isPending}>
                              <X className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </>
                        )}
                        {isAdmin && (
                          <Button size="icon" variant="ghost"
                            onClick={() => handleDelete(c.id)}
                            disabled={remove.isPending}>
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
