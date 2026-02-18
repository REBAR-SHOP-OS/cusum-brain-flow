import { useState } from "react";
import { useInventoryCounts, useInventoryCountLines, InventoryCount } from "@/hooks/useInventoryCounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, ClipboardList, CheckCircle2, ArrowLeft, AlertTriangle, Package } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  canceled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export function InventoryCountView() {
  const { counts, isLoading, createCount, updateCount } = useInventoryCounts();
  const [showCreate, setShowCreate] = useState(false);
  const [countType, setCountType] = useState("full");
  const [selectedCount, setSelectedCount] = useState<InventoryCount | null>(null);

  const handleCreate = () => {
    createCount.mutate({ count_type: countType }, {
      onSuccess: (data) => { setShowCreate(false); setSelectedCount(data as InventoryCount); },
    });
  };

  if (selectedCount) {
    return <CountDetail count={selectedCount} onBack={() => setSelectedCount(null)} onUpdate={updateCount.mutate} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" /> Inventory Counts
          </h2>
          <p className="text-sm text-muted-foreground">Cycle counting and stock adjustment workflow</p>
        </div>
        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-1">
          <Plus className="w-4 h-4" /> New Count
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {["draft", "in_progress", "completed", "approved"].map(status => (
          <Card key={status}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide capitalize">{status.replace("_", " ")}</p>
              <p className="text-2xl font-bold mt-1">{counts.filter(c => c.status === status).length}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* List */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">All Counts</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Count #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
              ) : counts.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No inventory counts yet.</TableCell></TableRow>
              ) : counts.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedCount(c)}>
                  <TableCell className="font-medium">{c.count_number}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize">{c.count_type}</Badge></TableCell>
                  <TableCell><Badge className={`text-xs ${STATUS_COLORS[c.status] || ""}`}>{c.status.replace("_", " ")}</Badge></TableCell>
                  <TableCell className="text-sm">{c.count_date}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.location || "—"}</TableCell>
                  <TableCell><Button variant="ghost" size="sm">View</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Inventory Count</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Count Type</p>
              <Select value={countType} onValueChange={setCountType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Count</SelectItem>
                  <SelectItem value="cycle">Cycle Count</SelectItem>
                  <SelectItem value="spot">Spot Check</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">All rebar sizes will be pre-populated with expected quantities from current stock.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createCount.isPending}>Create & Start</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CountDetail({ count, onBack, onUpdate }: {
  count: InventoryCount;
  onBack: () => void;
  onUpdate: (data: Partial<InventoryCount> & { id: string }) => void;
}) {
  const { lines, isLoading, updateLine, totalExpected, totalCounted, totalVariance, uncounted } = useInventoryCountLines(count.id);

  const handleQtyChange = (lineId: string, value: string) => {
    const qty = value === "" ? null : parseInt(value);
    updateLine.mutate({ id: lineId, counted_qty: qty });
  };

  const handleComplete = () => onUpdate({ id: count.id, status: "completed" });
  const handleApprove = () => onUpdate({ id: count.id, status: "approved" });
  const handleStart = () => onUpdate({ id: count.id, status: "in_progress" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-4 h-4" /></Button>
          <div>
            <h2 className="text-lg font-bold">{count.count_number}</h2>
            <div className="flex items-center gap-2">
              <Badge className={`text-xs ${STATUS_COLORS[count.status] || ""}`}>{count.status.replace("_", " ")}</Badge>
              <span className="text-xs text-muted-foreground capitalize">{count.count_type} count • {count.count_date}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {count.status === "draft" && <Button size="sm" onClick={handleStart}>Start Counting</Button>}
          {count.status === "in_progress" && <Button size="sm" onClick={handleComplete} disabled={uncounted > 0}>Mark Complete</Button>}
          {count.status === "completed" && <Button size="sm" variant="default" onClick={handleApprove} className="gap-1"><CheckCircle2 className="w-4 h-4" /> Approve</Button>}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">Expected</p>
            <p className="text-xl font-bold">{totalExpected.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">Counted</p>
            <p className="text-xl font-bold">{totalCounted.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">Variance</p>
            <p className={`text-xl font-bold ${totalVariance < 0 ? "text-destructive" : totalVariance > 0 ? "text-green-600" : ""}`}>
              {totalVariance > 0 ? "+" : ""}{totalVariance.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-xs text-muted-foreground">Uncounted</p>
            <p className="text-xl font-bold">{uncounted}</p>
            {uncounted > 0 && <p className="text-xs text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {uncounted} remaining</p>}
          </CardContent>
        </Card>
      </div>

      {/* Count Lines */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bar Code</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right w-[120px]">Counted</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : lines.map(line => (
                  <TableRow key={line.id} className={line.variance !== 0 && line.counted_qty !== null ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      {line.bar_code}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{line.expected_qty}</TableCell>
                    <TableCell className="text-right">
                      {count.status === "in_progress" ? (
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-20 text-right ml-auto"
                          value={line.counted_qty ?? ""}
                          onChange={e => handleQtyChange(line.id, e.target.value)}
                        />
                      ) : (
                        <span className="tabular-nums">{line.counted_qty ?? "—"}</span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${line.variance < 0 ? "text-destructive" : line.variance > 0 ? "text-green-600" : ""}`}>
                      {line.counted_qty !== null ? (line.variance > 0 ? "+" : "") + line.variance : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{line.notes || ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
