import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCompanyId } from "@/hooks/useCompanyId";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Calculator, FileText, History, Plus, Trash2, Loader2, CheckCircle, AlertTriangle, DollarSign, Weight, Truck } from "lucide-react";

// ─── Default empty lines ───
const emptyStraight = () => ({ line_id: `SR-${Date.now()}`, bar_size: "10M", length_ft: 20, quantity: 0, notes: "" });
const emptyFab = () => ({ line_id: `FB-${Date.now()}`, bar_size: "15M", shape_code: "S1", cut_length_ft: 0, quantity: 0, notes: "" });
const emptyDowel = () => ({ line_id: `DW-${Date.now()}`, type: "15M", size: '8"x24"', quantity: 0, notes: "" });
const emptyTie = () => ({ line_id: `TC-${Date.now()}`, type: "10M", diameter: '12"', quantity: 0, notes: "" });
const emptyCage = () => ({ line_id: `CG-${Date.now()}`, cage_type: "pile_cage", total_cage_weight_kg: 0, quantity: 1, notes: "" });

const BAR_SIZES = ["10M", "15M", "20M", "25M", "30M", "35M", "45M", "55M"];

export default function QuoteEngine() {
  const { toast } = useToast();
  const { companyId } = useCompanyId();
  const [activeTab, setActiveTab] = useState("new-quote");
  const [loading, setLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<string[] | null>(null);

  // Form state
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [coatingType, setCoatingType] = useState("black");
  const [shopDrawings, setShopDrawings] = useState(true);
  const [taxRate, setTaxRate] = useState(0.13);
  const [distanceKm, setDistanceKm] = useState(0);

  const [straightLines, setStraightLines] = useState([emptyStraight()]);
  const [fabLines, setFabLines] = useState([emptyFab()]);
  const [dowelLines, setDowelLines] = useState([emptyDowel()]);
  const [tieLines, setTieLines] = useState([emptyTie()]);
  const [cageLines, setCageLines] = useState([emptyCage()]);

  // History query
  const { data: quoteHistory } = useQuery({
    queryKey: ["quote-engine-history", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("quotes")
        .select("id, quote_number, total_amount, status, created_at, notes, metadata")
        .eq("company_id", companyId)
        .eq("source", "quote_engine")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const buildEstimateRequest = () => ({
    meta: {
      request_id: `REQ-${Date.now()}`,
      quote_type: "firm",
      currency: "CAD",
      created_by: "quote-engine-ui",
      created_at: new Date().toISOString().split("T")[0],
    },
    project: {
      project_name: projectName,
      customer_name: customerName,
      site_address: siteAddress,
      quote_date: new Date().toISOString().split("T")[0],
      notes: "",
    },
    scope: {
      coating_type: coatingType,
      shop_drawings_required: shopDrawings,
      scrap_percent_override: null,
      tax_rate: taxRate,
      straight_rebar_lines: straightLines.filter((l) => l.quantity > 0),
      fabricated_rebar_lines: fabLines.filter((l) => l.quantity > 0),
      dowels: dowelLines.filter((l) => l.quantity > 0),
      ties_circular: tieLines.filter((l) => l.quantity > 0),
      cages: cageLines.filter((l) => l.quantity > 0),
      mesh: [],
    },
    shipping: {
      delivery_required: distanceKm > 0,
      distance_km: distanceKm,
      truck_capacity_tons: 7,
      notes: "",
    },
    customer_confirmations: {
      confirmed_no_engineering_changes: true,
      confirmed_inputs_are_final: true,
      confirmed_pdf_is_reference_only: true,
    },
  });

  const handleValidate = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("quote-engine", {
        body: { action: "validate", estimate_request: buildEstimateRequest(), company_id: companyId },
      });
      if (error) throw error;
      setValidationErrors(data.missing_inputs_questions);
      if (data.valid) {
        toast({ title: "✅ Validation passed", description: "All inputs look good." });
      } else {
        toast({ title: "⚠️ Missing inputs", description: `${data.missing_inputs_questions.length} issue(s) found.`, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuote = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("quote-engine", {
        body: { action: "quote", estimate_request: buildEstimateRequest(), company_id: companyId },
      });
      if (error) throw error;
      setQuoteResult(data);
      setActiveTab("results");
      toast({ title: "✅ Quote generated", description: `Grand total: $${data.summary.grand_total.toFixed(2)} CAD` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Helper to update line arrays
  const updateLine = <T extends Record<string, any>>(arr: T[], idx: number, field: string, value: any, setter: (v: T[]) => void) => {
    const next = [...arr];
    (next[idx] as any)[field] = value;
    setter(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quote Engine</h1>
          <p className="text-sm text-muted-foreground">Deterministic rebar pricing — no AI, pure math</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="new-quote"><Calculator className="h-4 w-4 mr-1" />New Quote</TabsTrigger>
          <TabsTrigger value="results"><FileText className="h-4 w-4 mr-1" />Results</TabsTrigger>
          <TabsTrigger value="history"><History className="h-4 w-4 mr-1" />History</TabsTrigger>
        </TabsList>

        {/* ── NEW QUOTE TAB ── */}
        <TabsContent value="new-quote" className="space-y-4">
          {/* Project details */}
          <Card>
            <CardHeader><CardTitle className="text-base">Project Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>Project Name</Label><Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. Tower A Foundation" /></div>
              <div><Label>Customer</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. ABC Concrete" /></div>
              <div><Label>Site Address</Label><Input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} placeholder="e.g. Toronto, ON" /></div>
            </CardContent>
          </Card>

          {/* Config */}
          <Card>
            <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label>Coating</Label>
                <Select value={coatingType} onValueChange={setCoatingType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="black">Black (1×)</SelectItem>
                    <SelectItem value="epoxy">Epoxy (2×)</SelectItem>
                    <SelectItem value="galvanized">Galvanized (2×)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Tax Rate</Label><Input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} /></div>
              <div><Label>Shipping Distance (km)</Label><Input type="number" value={distanceKm} onChange={(e) => setDistanceKm(Number(e.target.value))} /></div>
              <div className="flex items-end">
                <Button variant={shopDrawings ? "default" : "outline"} onClick={() => setShopDrawings(!shopDrawings)} className="w-full">
                  {shopDrawings ? "Shop Drawings ✓" : "No Shop Drawings"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Straight Bars */}
          <ScopeSection title="Straight Bars" lines={straightLines} setLines={setStraightLines} emptyFn={emptyStraight} renderLine={(line, idx) => (
            <div className="grid grid-cols-4 gap-2 items-end" key={line.line_id}>
              <div><Label className="text-xs">Bar Size</Label>
                <Select value={line.bar_size} onValueChange={(v) => updateLine(straightLines, idx, "bar_size", v, setStraightLines)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BAR_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Length (ft)</Label><Input type="number" value={line.length_ft} onChange={(e) => updateLine(straightLines, idx, "length_ft", Number(e.target.value), setStraightLines)} /></div>
              <div><Label className="text-xs">Quantity</Label><Input type="number" value={line.quantity} onChange={(e) => updateLine(straightLines, idx, "quantity", Number(e.target.value), setStraightLines)} /></div>
              <Button variant="ghost" size="icon" onClick={() => setStraightLines(straightLines.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          )} />

          {/* Fabricated Bars */}
          <ScopeSection title="Fabricated Bars" lines={fabLines} setLines={setFabLines} emptyFn={emptyFab} renderLine={(line, idx) => (
            <div className="grid grid-cols-5 gap-2 items-end" key={line.line_id}>
              <div><Label className="text-xs">Bar Size</Label>
                <Select value={line.bar_size} onValueChange={(v) => updateLine(fabLines, idx, "bar_size", v, setFabLines)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BAR_SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Shape</Label><Input value={line.shape_code} onChange={(e) => updateLine(fabLines, idx, "shape_code", e.target.value, setFabLines)} /></div>
              <div><Label className="text-xs">Length (ft)</Label><Input type="number" value={line.cut_length_ft} onChange={(e) => updateLine(fabLines, idx, "cut_length_ft", Number(e.target.value), setFabLines)} /></div>
              <div><Label className="text-xs">Qty</Label><Input type="number" value={line.quantity} onChange={(e) => updateLine(fabLines, idx, "quantity", Number(e.target.value), setFabLines)} /></div>
              <Button variant="ghost" size="icon" onClick={() => setFabLines(fabLines.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          )} />

          {/* Dowels */}
          <ScopeSection title="Dowels" lines={dowelLines} setLines={setDowelLines} emptyFn={emptyDowel} renderLine={(line, idx) => (
            <div className="grid grid-cols-4 gap-2 items-end" key={line.line_id}>
              <div><Label className="text-xs">Type</Label><Input value={line.type} onChange={(e) => updateLine(dowelLines, idx, "type", e.target.value, setDowelLines)} /></div>
              <div><Label className="text-xs">Size</Label><Input value={line.size} onChange={(e) => updateLine(dowelLines, idx, "size", e.target.value, setDowelLines)} /></div>
              <div><Label className="text-xs">Qty</Label><Input type="number" value={line.quantity} onChange={(e) => updateLine(dowelLines, idx, "quantity", Number(e.target.value), setDowelLines)} /></div>
              <Button variant="ghost" size="icon" onClick={() => setDowelLines(dowelLines.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          )} />

          {/* Ties */}
          <ScopeSection title="Ties (Circular)" lines={tieLines} setLines={setTieLines} emptyFn={emptyTie} renderLine={(line, idx) => (
            <div className="grid grid-cols-4 gap-2 items-end" key={line.line_id}>
              <div><Label className="text-xs">Type</Label><Input value={line.type} onChange={(e) => updateLine(tieLines, idx, "type", e.target.value, setTieLines)} /></div>
              <div><Label className="text-xs">Diameter</Label><Input value={line.diameter} onChange={(e) => updateLine(tieLines, idx, "diameter", e.target.value, setTieLines)} /></div>
              <div><Label className="text-xs">Qty</Label><Input type="number" value={line.quantity} onChange={(e) => updateLine(tieLines, idx, "quantity", Number(e.target.value), setTieLines)} /></div>
              <Button variant="ghost" size="icon" onClick={() => setTieLines(tieLines.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          )} />

          {/* Cages */}
          <ScopeSection title="Cages" lines={cageLines} setLines={setCageLines} emptyFn={emptyCage} renderLine={(line, idx) => (
            <div className="grid grid-cols-5 gap-2 items-end" key={line.line_id}>
              <div><Label className="text-xs">Type</Label><Input value={line.cage_type} onChange={(e) => updateLine(cageLines, idx, "cage_type", e.target.value, setCageLines)} /></div>
              <div><Label className="text-xs">Weight/cage (kg)</Label><Input type="number" value={line.total_cage_weight_kg} onChange={(e) => updateLine(cageLines, idx, "total_cage_weight_kg", Number(e.target.value), setCageLines)} /></div>
              <div><Label className="text-xs">Qty</Label><Input type="number" value={line.quantity} onChange={(e) => updateLine(cageLines, idx, "quantity", Number(e.target.value), setCageLines)} /></div>
              <div />
              <Button variant="ghost" size="icon" onClick={() => setCageLines(cageLines.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          )} />

          {/* Validation errors */}
          {validationErrors && validationErrors.length > 0 && (
            <Card className="border-destructive">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-destructive" /><span className="font-medium text-destructive">Validation Issues</span></div>
                <ul className="text-sm space-y-1">{validationErrors.map((q, i) => <li key={i} className="text-muted-foreground">• {q}</li>)}</ul>
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleValidate} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}Validate
            </Button>
            <Button onClick={handleGenerateQuote} disabled={loading || !projectName}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Calculator className="h-4 w-4 mr-1" />}Generate Quote
            </Button>
          </div>
        </TabsContent>

        {/* ── RESULTS TAB ── */}
        <TabsContent value="results" className="space-y-4">
          {!quoteResult ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No quote generated yet. Go to "New Quote" to create one.</CardContent></Card>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard icon={<Weight className="h-5 w-5" />} label="Total Weight" value={`${quoteResult.weights_summary.total_kg.toLocaleString()} kg`} sub={`${quoteResult.weights_summary.total_tons.toFixed(2)} tons`} />
                <SummaryCard icon={<DollarSign className="h-5 w-5" />} label="Grand Total" value={`$${quoteResult.summary.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} sub={`Tax: $${quoteResult.summary.tax.toFixed(2)}`} />
                <SummaryCard icon={<Truck className="h-5 w-5" />} label="Shipping" value={`${quoteResult.pricing_method_summary.shipping_trips} trip(s)`} sub={`Coating: ${quoteResult.summary.coating_type}`} />
                <SummaryCard icon={<FileText className="h-5 w-5" />} label="Fab Bracket" value={quoteResult.pricing_method_summary.tonnage_bracket_used.split("@")[0]} sub={quoteResult.pricing_method_summary.tonnage_bracket_used.split("@")[1] || ""} />
              </div>

              {/* Spreadsheet table */}
              <Card>
                <CardHeader><CardTitle className="text-base">Line Items</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {quoteResult.spreadsheet_table[0]?.map((h: string, i: number) => (
                          <TableHead key={i} className="text-xs whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quoteResult.spreadsheet_table.slice(1).map((row: string[], ri: number) => (
                        <TableRow key={ri}>
                          {row.map((cell: string, ci: number) => (
                            <TableCell key={ci} className="text-xs whitespace-nowrap">{cell}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Assumptions */}
              <Card>
                <CardHeader><CardTitle className="text-base">Assumptions & Exclusions</CardTitle></CardHeader>
                <CardContent>
                  <ul className="text-sm space-y-1">
                    {quoteResult.assumptions_and_exclusions.map((a: string, i: number) => (
                      <li key={i} className="text-muted-foreground">• {a}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── HISTORY TAB ── */}
        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle className="text-base">Quote History</CardTitle></CardHeader>
            <CardContent>
              {!quoteHistory?.length ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No quotes yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quote #</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quoteHistory.map((q: any) => (
                      <TableRow key={q.id} className="cursor-pointer" onClick={() => {
                        if (q.metadata?.result) {
                          setQuoteResult(q.metadata.result);
                          setActiveTab("results");
                        }
                      }}>
                        <TableCell className="font-mono text-xs">{q.quote_number}</TableCell>
                        <TableCell className="text-sm">{q.metadata?.result?.summary?.project_name || q.notes || "—"}</TableCell>
                        <TableCell className="font-medium">${q.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "—"}</TableCell>
                        <TableCell><Badge variant="outline">{q.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ───

function ScopeSection<T extends { line_id: string }>({
  title, lines, setLines, emptyFn, renderLine,
}: {
  title: string; lines: T[]; setLines: (v: T[]) => void; emptyFn: () => T; renderLine: (line: T, idx: number) => React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setLines([...lines, emptyFn()])}><Plus className="h-3 w-3 mr-1" />Add</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {lines.length === 0 ? (
          <p className="text-xs text-muted-foreground">No items. Click Add to start.</p>
        ) : (
          lines.map((line, idx) => renderLine(line, idx))
        )}
      </CardContent>
    </Card>
  );
}

function SummaryCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">{icon}<span className="text-xs">{label}</span></div>
        <div className="text-lg font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}
