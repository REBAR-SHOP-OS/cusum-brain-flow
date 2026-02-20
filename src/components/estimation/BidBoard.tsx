import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyId } from "@/hooks/useCompanyId";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-700",
  scope_confirmed: "bg-cyan-500/15 text-cyan-700",
  takeoff_in_progress: "bg-yellow-500/15 text-yellow-700",
  takeoff_complete: "bg-green-500/15 text-green-700",
  quoted: "bg-purple-500/15 text-purple-700",
  won: "bg-emerald-500/15 text-emerald-700",
  lost: "bg-red-500/15 text-red-700",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-blue-500/15 text-blue-700",
  high: "bg-orange-500/15 text-orange-700",
  urgent: "bg-red-500/15 text-red-700",
};

export default function BidBoard() {
  const { companyId } = useCompanyId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newBid, setNewBid] = useState({ project_name: "", customer_name: "", location: "", priority: "medium", estimated_value: 0 });

  const { data: bids = [] } = useQuery({
    queryKey: ["bid_board", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bid_board")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const addBid = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("bid_board").insert({
        ...newBid,
        company_id: companyId!,
        status: "new",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bid_board"] });
      setShowAdd(false);
      setNewBid({ project_name: "", customer_name: "", location: "", priority: "medium", estimated_value: 0 });
      toast.success("Bid added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = bids.filter((b: any) => {
    const matchSearch = b.project_name?.toLowerCase().includes(search.toLowerCase()) || b.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search bids..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="scope_confirmed">Scope Confirmed</SelectItem>
            <SelectItem value="takeoff_in_progress">Takeoff In Progress</SelectItem>
            <SelectItem value="takeoff_complete">Takeoff Complete</SelectItem>
            <SelectItem value="quoted">Quoted</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> Add Bid</Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Priority</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Bid Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Value ($)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No bids yet.</TableCell></TableRow>
            ) : (
              filtered.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell><Badge className={priorityColors[b.priority] || ""} variant="secondary">{b.priority}</Badge></TableCell>
                  <TableCell className="font-medium">{b.project_name}</TableCell>
                  <TableCell>{b.customer_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{b.location || "—"}</TableCell>
                  <TableCell className="text-sm">{b.bid_due_date ? new Date(b.bid_due_date).toLocaleDateString() : "—"}</TableCell>
                  <TableCell><Badge className={statusColors[b.status] || ""} variant="secondary">{b.status.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell className="text-right">{(b.estimated_value ?? 0).toLocaleString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Bid</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Project Name</Label><Input value={newBid.project_name} onChange={(e) => setNewBid({ ...newBid, project_name: e.target.value })} /></div>
            <div><Label>Customer</Label><Input value={newBid.customer_name} onChange={(e) => setNewBid({ ...newBid, customer_name: e.target.value })} /></div>
            <div><Label>Location</Label><Input value={newBid.location} onChange={(e) => setNewBid({ ...newBid, location: e.target.value })} /></div>
            <div><Label>Priority</Label>
              <Select value={newBid.priority} onValueChange={(v) => setNewBid({ ...newBid, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Estimated Value ($)</Label><Input type="number" value={newBid.estimated_value} onChange={(e) => setNewBid({ ...newBid, estimated_value: Number(e.target.value) })} /></div>
            <Button className="w-full" onClick={() => addBid.mutate()} disabled={!newBid.project_name || addBid.isPending}>Add Bid</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
