import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Upload, Download, Package, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { read } from "@e965/xlsx";
import { parseWorkbook, diagnosticMessage, type ParsedItem } from "@/lib/rebarCadParser";

const FALLBACK_WPM: Record<string, number> = {
  "10M": 0.785, "15M": 1.570, "20M": 2.355,
  "25M": 3.925, "30M": 5.495, "35M": 7.850,
};

// --- Calculation ---

interface SizeSummary {
  bar_size: string;
  total_pieces: number;
  total_length_m: number;
  length_with_waste_m: number;
  bars_to_order: number;
  total_weight_kg: number;
}

function calculate(
  items: ParsedItem[],
  stockLengthM: number,
  wastePct: number,
  wpm: Record<string, number>,
  unitFactor: number = 1
): SizeSummary[] {
  const grouped: Record<string, { pieces: number; length_mm: number }> = {};
  for (const it of items) {
    if (!grouped[it.bar_size]) grouped[it.bar_size] = { pieces: 0, length_mm: 0 };
    grouped[it.bar_size].pieces += it.quantity;
    // Convert raw value to mm using the source unit factor
    grouped[it.bar_size].length_mm += (it.cut_length_mm * unitFactor) * it.quantity;
  }

  const stockMm = stockLengthM * 1000;
  const sizes = ["10M", "15M", "20M", "25M", "30M", "35M"];

  return sizes
    .filter(s => grouped[s])
    .map(s => {
      const g = grouped[s];
      const totalM = g.length_mm / 1000;
      const withWaste = totalM * (1 + wastePct / 100);
      const bars = Math.ceil((withWaste * 1000) / stockMm);
      const w = wpm[s] ?? FALLBACK_WPM[s] ?? 0;
      const weight = Math.round(bars * stockLengthM * w * 100) / 100;
      return {
        bar_size: s,
        total_pieces: g.pieces,
        total_length_m: Math.round(totalM * 100) / 100,
        length_with_waste_m: Math.round(withWaste * 100) / 100,
        bars_to_order: bars,
        total_weight_kg: weight,
      };
    });
}

// --- Component ---

const STOCK_LENGTHS = [6, 12, 18];
type SourceUnit = "mm" | "in" | "ft";
const UNIT_TO_MM: Record<SourceUnit, number> = { mm: 1, in: 25.4, ft: 304.8 };

export function OrderCalcView() {
  const [stockLength, setStockLength] = useState(12);
  const [wastePct, setWastePct] = useState(5);
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [results, setResults] = useState<SizeSummary[]>([]);
  const [sourceUnit, setSourceUnit] = useState<SourceUnit>("mm");
  const [fileName, setFileName] = useState<string | null>(null);
  const [wpm, setWpm] = useState<Record<string, number>>(FALLBACK_WPM);

  // Fetch weight-per-meter from DB
  useEffect(() => {
    supabase
      .from("rebar_sizes")
      .select("bar_code, mass_kg_per_m")
      .then(({ data }) => {
        if (data?.length) {
          const map: Record<string, number> = {};
          for (const r of data) map[r.bar_code] = r.mass_kg_per_m;
          setWpm(prev => ({ ...prev, ...map }));
        }
      });
  }, []);

  // Recalculate when inputs change
  useEffect(() => {
    if (items.length) setResults(calculate(items, stockLength, wastePct, wpm, UNIT_TO_MM[sourceUnit]));
  }, [items, stockLength, wastePct, wpm, sourceUnit]);

  const handleFile = useCallback(async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = utils.sheet_to_json(ws, { header: 1 });
      const parsed = parseRows(rows);
      if (parsed.length === 0) {
        toast.warning("No rebar items found in the uploaded file. Please check the file format.");
        return;
      }
      setItems(parsed);
      setFileName(file.name);
      toast.success(`Parsed ${parsed.length} rebar item(s) from ${file.name}`);
    } catch (err: any) {
      console.error("Order Calc file parse error:", err);
      toast.error(`Failed to parse file: ${err?.message || "Unknown error"}`);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const exportCSV = () => {
    if (!results.length) return;
    const header = "Bar Size,Total Pieces,Total Length (m),With Waste (m),Stock Length (m),Bars to Order,Weight (kg)\n";
    const rows = results.map(r =>
      `${r.bar_size},${r.total_pieces},${r.total_length_m},${r.length_with_waste_m},${stockLength},${r.bars_to_order},${r.total_weight_kg}`
    ).join("\n");
    const totals = `\nTOTAL,${results.reduce((s, r) => s + r.total_pieces, 0)},,,,${results.reduce((s, r) => s + r.bars_to_order, 0)},${results.reduce((s, r) => s + r.total_weight_kg, 0).toFixed(2)}`;
    const blob = new Blob([header + rows + totals], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `order-calc-${stockLength}m-${wastePct}pct.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalBars = results.reduce((s, r) => s + r.bars_to_order, 0);
  const totalWeight = results.reduce((s, r) => s + r.total_weight_kg, 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Calculator className="w-6 h-6 text-primary" />
        <h1 className="text-lg font-bold tracking-wide uppercase text-foreground">Order Calculator</h1>
      </div>

      {/* Upload zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => document.getElementById("order-calc-file")?.click()}
      >
        <input
          id="order-calc-file"
          type="file"
          accept=".xls,.xlsx"
          className="hidden"
          onChange={onFileSelect}
        />
        <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {fileName ? (
            <span className="text-foreground font-medium">{fileName} — {items.length} items parsed</span>
          ) : (
            "Drop a RebarCAD XLS/XLSX file here or click to browse"
          )}
        </p>
      </div>

      {/* Controls */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Source Unit */}
          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Source Unit
            </label>
            <div className="flex gap-2">
              {(["mm", "in", "ft"] as SourceUnit[]).map(u => (
                <Button
                  key={u}
                  size="sm"
                  variant={sourceUnit === u ? "default" : "outline"}
                  onClick={() => setSourceUnit(u)}
                  className="flex-1"
                >
                  {u === "mm" ? "mm" : u === "in" ? "Inches" : "Feet"}
                </Button>
              ))}
            </div>
          </div>

          {/* Stock length */}
          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Stock Length
            </label>
            <div className="flex gap-2">
              {STOCK_LENGTHS.map(len => (
                <Button
                  key={len}
                  size="sm"
                  variant={stockLength === len ? "default" : "outline"}
                  onClick={() => setStockLength(len)}
                  className="flex-1"
                >
                  {len}M
                </Button>
              ))}
            </div>
          </div>

          {/* Waste factor */}
          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Waste Factor: {wastePct}%
            </label>
            <Slider
              value={[wastePct]}
              onValueChange={v => setWastePct(v[0])}
              min={0}
              max={20}
              step={1}
            />
          </div>
        </div>
      )}

      {/* Results table */}
      {results.length > 0 && (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">Bar Size</TableHead>
                  <TableHead className="text-xs text-right">Pieces</TableHead>
                  <TableHead className="text-xs text-right">Length (m)</TableHead>
                  <TableHead className="text-xs text-right">+ Waste (m)</TableHead>
                  <TableHead className="text-xs text-right">Stock ({stockLength}M)</TableHead>
                  <TableHead className="text-xs text-right font-bold">Bars to Order</TableHead>
                  <TableHead className="text-xs text-right">Weight (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map(r => (
                  <TableRow key={r.bar_size}>
                    <TableCell className="font-medium">{r.bar_size}</TableCell>
                    <TableCell className="text-right">{r.total_pieces.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{r.total_length_m.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{r.length_with_waste_m.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{stockLength}M</TableCell>
                    <TableCell className="text-right font-bold text-primary">{r.bars_to_order.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{r.total_weight_kg.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-muted/20 font-bold border-t-2 border-border">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right">{results.reduce((s, r) => s + r.total_pieces, 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{results.reduce((s, r) => s + r.total_length_m, 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{results.reduce((s, r) => s + r.length_with_waste_m, 0).toLocaleString()}</TableCell>
                  <TableCell />
                  <TableCell className="text-right text-primary">{totalBars.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{totalWeight.toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">Total Bars</p>
              <p className="text-2xl font-bold text-primary">{totalBars.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">Total Weight</p>
              <p className="text-2xl font-bold text-foreground">{Math.round(totalWeight).toLocaleString()} kg</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">Stock Length</p>
              <p className="text-2xl font-bold text-foreground">{stockLength}M</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-1">Waste Factor</p>
              <p className="text-2xl font-bold text-foreground">{wastePct}%</p>
            </div>
          </div>

          {/* Export */}
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </>
      )}
    </div>
  );
}
