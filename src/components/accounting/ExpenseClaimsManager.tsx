import { useState, useEffect } from "react";
import { useExpenseClaims, useExpenseClaimItems, type ExpenseClaim } from "@/hooks/useExpenseClaims";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus, Receipt, Trash2, Send, CheckCircle2, XCircle,
  DollarSign, Clock, FileText, ArrowLeft, Loader2,
} from "lucide-react";

const STATUS_BADGES: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
  draft: { variant: "outline", label: "Draft" },
  submitted: { variant: "secondary", label: "Submitted" },
  approved: { variant: "default", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
  paid: { variant: "default", label: "Paid" },
};

const CATEGORIES = [
  "travel", "meals", "accommodation", "transport", "office_supplies",
  "equipment", "training", "communication", "fuel", "other",
];

function ClaimEditor({ claim, onBack }: { claim: ExpenseClaim; onBack: () => void }) {
  const { updateClaim } = useExpenseClaims();
  const { items, isLoading, addItem, removeItem } = useExpenseClaimItems(claim.id);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ expense_date: new Date().toISOString().split("T")[0], category: "other", description: "", amount: 0, notes: "" });
  const [reviewNote, setReviewNote] = useState("");
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        supabase.from("profiles").select("id").eq("user_id", data.user.id).single()
          .then(({ data: p }) => setMyProfileId(p?.id ?? null));
      }
    });
  }, []);

  const isDraft = claim.status === "draft";
  const isSubmitted = claim.status === "submitted";
  const isOwnClaim = myProfileId === claim.profile_id;
  const total = items.reduce((s, i) => s + i.amount, 0);

  const handleAddItem = () => {
    if (!newItem.description || newItem.amount <= 0) return;
    addItem.mutate({ ...newItem, claim_id: claim.id, receipt_url: null, notes: newItem.notes || null });
    setNewItem({ expense_date: new Date().toISOString().split("T")[0], category: "other", description: "", amount: 0, notes: "" });
    setShowAddItem(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h2 className="text-lg font-bold">{claim.claim_number} — {claim.title}</h2>
            {claim.description && <p className="text-sm text-muted-foreground">{claim.description}</p>}
          </div>
          <Badge variant={STATUS_BADGES[claim.status]?.variant}>{STATUS_BADGES[claim.status]?.label}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {isDraft && items.length > 0 && (
            <Button size="sm" onClick={() => updateClaim.mutate({ id: claim.id, status: "submitted" })}>
              <Send className="w-4 h-4 mr-1" /> Submit
            </Button>
          )}
          {isSubmitted && !isOwnClaim && (
            <>
              <Button size="sm" variant="default" onClick={() => updateClaim.mutate({ id: claim.id, status: "approved", review_note: reviewNote })}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => updateClaim.mutate({ id: claim.id, status: "rejected", review_note: reviewNote })}>
                <XCircle className="w-4 h-4 mr-1" /> Reject
              </Button>
            </>
          )}
          {claim.status === "approved" && (
            <Button size="sm" onClick={() => updateClaim.mutate({ id: claim.id, status: "paid" })}>
              <DollarSign className="w-4 h-4 mr-1" /> Mark Paid
            </Button>
          )}
        </div>
      </div>

      {isSubmitted && (
        <Input placeholder="Review note (optional)" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-3 pb-2">
          <p className="text-[10px] uppercase text-muted-foreground">Items</p>
          <p className="text-xl font-bold">{items.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2">
          <p className="text-[10px] uppercase text-muted-foreground">Total</p>
          <p className="text-xl font-bold">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2">
          <p className="text-[10px] uppercase text-muted-foreground">Status</p>
          <p className="text-xl font-bold capitalize">{claim.status}</p>
        </CardContent></Card>
      </div>

      {/* Items list */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Expense Items</CardTitle>
            {isDraft && <Button size="sm" variant="outline" onClick={() => setShowAddItem(true)}><Plus className="w-4 h-4 mr-1" /> Add Item</Button>}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No items yet. Add your first expense.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] capitalize">{item.category.replace("_", " ")}</Badge>
                      <span className="text-xs text-muted-foreground">{item.expense_date}</span>
                    </div>
                    <p className="text-sm font-medium truncate">{item.description}</p>
                    {item.notes && <p className="text-xs text-muted-foreground truncate">{item.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold">${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    {isDraft && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeItem.mutate(item.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Expense Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={newItem.expense_date} onChange={(e) => setNewItem({ ...newItem, expense_date: e.target.value })} />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={newItem.category} onValueChange={(v) => setNewItem({ ...newItem, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} placeholder="What was this expense for?" />
            </div>
            <div>
              <Label>Amount ($)</Label>
              <Input type="number" min={0} step={0.01} value={newItem.amount || ""} onChange={(e) => setNewItem({ ...newItem, amount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={newItem.notes} onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={!newItem.description || newItem.amount <= 0}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ExpenseClaimsManager() {
  const { claims, isLoading, createClaim, deleteClaim } = useExpenseClaims();
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaim | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [filter, setFilter] = useState("all");

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createClaim.mutate({ title: newTitle, description: newDesc }, {
      onSuccess: (data) => {
        setShowCreate(false);
        setNewTitle("");
        setNewDesc("");
        if (data) setSelectedClaim(data as ExpenseClaim);
      },
    });
  };

  if (selectedClaim) {
    const fresh = claims.find((c) => c.id === selectedClaim.id) || selectedClaim;
    return <ClaimEditor claim={fresh} onBack={() => setSelectedClaim(null)} />;
  }

  const filtered = filter === "all" ? claims : claims.filter((c) => c.status === filter);
  const stats = {
    total: claims.length,
    draft: claims.filter((c) => c.status === "draft").length,
    submitted: claims.filter((c) => c.status === "submitted").length,
    approved: claims.filter((c) => c.status === "approved").length,
    totalAmount: claims.filter((c) => c.status === "approved" || c.status === "paid").reduce((s, c) => s + c.total_amount, 0),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Receipt className="w-5 h-5" /> Expense Claims</h2>
          <p className="text-sm text-muted-foreground">Submit, track, and approve employee expenses</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> New Claim</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:bg-muted/30" onClick={() => setFilter("all")}><CardContent className="pt-3 pb-2">
          <p className="text-[10px] uppercase text-muted-foreground">Total Claims</p>
          <p className="text-xl font-bold">{stats.total}</p>
        </CardContent></Card>
        <Card className="cursor-pointer hover:bg-muted/30" onClick={() => setFilter("submitted")}><CardContent className="pt-3 pb-2">
          <p className="text-[10px] uppercase text-muted-foreground">Pending Review</p>
          <p className="text-xl font-bold text-amber-500">{stats.submitted}</p>
        </CardContent></Card>
        <Card className="cursor-pointer hover:bg-muted/30" onClick={() => setFilter("approved")}><CardContent className="pt-3 pb-2">
          <p className="text-[10px] uppercase text-muted-foreground">Approved</p>
          <p className="text-xl font-bold text-emerald-500">{stats.approved}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-2">
          <p className="text-[10px] uppercase text-muted-foreground">Approved Value</p>
          <p className="text-xl font-bold">${stats.totalAmount.toLocaleString()}</p>
        </CardContent></Card>
      </div>

      {/* Filter */}
      <div className="flex gap-1">
        {["all", "draft", "submitted", "approved", "rejected", "paid"].map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "ghost"} className="text-xs capitalize" onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>

      {/* Claims list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p>No expense claims found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((claim) => (
            <Card key={claim.id} className="cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setSelectedClaim(claim)}>
              <CardContent className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">
                    <Badge variant={STATUS_BADGES[claim.status]?.variant} className="text-[10px]">{STATUS_BADGES[claim.status]?.label}</Badge>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{claim.claim_number} — {claim.title}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      {new Date(claim.created_at).toLocaleDateString()}
                      {claim.description && <span className="truncate max-w-[200px]">• {claim.description}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-bold text-sm">${claim.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  {claim.status === "draft" && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); deleteClaim.mutate(claim.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Expense Claim</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. March Travel Expenses" /></div>
            <div><Label>Description (optional)</Label><Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} placeholder="Brief description of expenses" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim() || createClaim.isPending}>
              {createClaim.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
