import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Search, Plus, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { useQuickBooksData } from "@/hooks/useQuickBooksData";

interface Props {
  data: ReturnType<typeof useQuickBooksData>;
}

interface JournalEntry {
  Id: string;
  DocNumber: string;
  TxnDate: string;
  TotalAmt: number;
  PrivateNote?: string;
  Line?: { Amount: number; Description?: string; JournalEntryLineDetail?: { PostingType: string; AccountRef?: { name: string } } }[];
}

interface JournalLine {
  accountId: string;
  accountName: string;
  amount: string;
  type: "debit" | "credit";
  description: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const emptyLine = (): JournalLine => ({ accountId: "", accountName: "", amount: "", type: "debit", description: "" });

export function AccountingJournalEntries({ data }: Props) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);
  const [memo, setMemo] = useState("");
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split("T")[0]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: { action: "list-journal-entries" },
      });
      if (error) throw error;
      setEntries(result?.journalEntries || []);
    } catch (e: any) {
      toast({ title: "Error loading journal entries", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEntries(); }, []);

  const updateLine = (idx: number, field: keyof JournalLine, value: string) => {
    setLines(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === "accountId") {
        const acct = data.accounts.find(a => a.Id === value);
        next[idx].accountName = acct?.Name || "";
      }
      return next;
    });
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter((_, i) => i !== idx));
  };

  const totals = useMemo(() => {
    const debits = lines.filter(l => l.type === "debit").reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    const credits = lines.filter(l => l.type === "credit").reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    return { debits, credits, balanced: Math.abs(debits - credits) < 0.01 };
  }, [lines]);

  const handleCreate = async () => {
    if (!totals.balanced) return;
    const validLines = lines.filter(l => l.accountId && parseFloat(l.amount) > 0);
    if (validLines.length < 2) return;
    setCreating(true);
    try {
      const { error } = await supabase.functions.invoke("quickbooks-oauth", {
        body: {
          action: "create-journal-entry",
          lines: validLines.map(l => ({
            accountId: l.accountId,
            accountName: l.accountName,
            amount: parseFloat(l.amount),
            type: l.type,
            description: l.description,
          })),
          memo,
          txnDate,
        },
      });
      if (error) throw error;
      toast({ title: "Journal entry created" });
      setShowCreate(false);
      setLines([emptyLine(), emptyLine()]);
      setMemo("");
      loadEntries();
    } catch (e: any) {
      toast({ title: "Error creating journal entry", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const sorted = [...entries].sort((a, b) => new Date(b.TxnDate).getTime() - new Date(a.TxnDate).getTime());
  const filtered = sorted.filter(e =>
    (e.DocNumber || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.PrivateNote || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input placeholder="Search journal entries..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-12 text-base" />
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Journal Entry
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Journal Entries ({filtered.length})
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              {loading ? "Loading..." : "No journal entries found."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doc #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.Id}>
                    <TableCell className="font-medium">{e.DocNumber || "—"}</TableCell>
                    <TableCell>{new Date(e.TxnDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">{e.PrivateNote || "—"}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {(e.Line || []).filter(l => l.JournalEntryLineDetail).slice(0, 4).map((l, i) => (
                          <div key={i} className="text-xs flex gap-2">
                            <Badge variant="outline" className={`text-[10px] ${l.JournalEntryLineDetail?.PostingType === "Debit" ? "border-blue-300 text-blue-600" : "border-amber-300 text-amber-600"}`}>
                              {l.JournalEntryLineDetail?.PostingType === "Debit" ? "DR" : "CR"}
                            </Badge>
                            <span className="truncate max-w-[120px]">{l.JournalEntryLineDetail?.AccountRef?.name || "—"}</span>
                            <span className="font-mono">{fmt(l.Amount)}</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmt(e.TotalAmt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} />
              </div>
              <div>
                <Label>Memo</Label>
                <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Journal entry description" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lines</Label>
              {lines.map((line, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select value={line.accountId} onChange={(e) => updateLine(idx, "accountId", e.target.value)} className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">Account...</option>
                    {data.accounts.map(a => <option key={a.Id} value={a.Id}>{a.Name}</option>)}
                  </select>
                  <select value={line.type} onChange={(e) => updateLine(idx, "type", e.target.value)} className="w-24 h-9 rounded-md border border-input bg-background px-2 text-sm">
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                  <Input type="number" step="0.01" value={line.amount} onChange={(e) => updateLine(idx, "amount", e.target.value)} placeholder="0.00" className="w-28 h-9" />
                  <Input value={line.description} onChange={(e) => updateLine(idx, "description", e.target.value)} placeholder="Desc" className="w-32 h-9" />
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeLine(idx)} disabled={lines.length <= 2}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setLines(prev => [...prev, emptyLine()])}>+ Add Line</Button>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex gap-6 text-sm">
                <span>Debits: <span className="font-semibold">{fmt(totals.debits)}</span></span>
                <span>Credits: <span className="font-semibold">{fmt(totals.credits)}</span></span>
              </div>
              {!totals.balanced && totals.debits + totals.credits > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" /> Unbalanced
                </Badge>
              )}
              {totals.balanced && totals.debits > 0 && (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">✓ Balanced</Badge>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !totals.balanced || totals.debits === 0}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Post Journal Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
