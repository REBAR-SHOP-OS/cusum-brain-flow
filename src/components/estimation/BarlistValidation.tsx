import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, XCircle, AlertTriangle, Minus } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ValidationItem {
  mark: string;
  bar_size: string;
  quantity: number;
  weight_kg: number;
  cut_length_mm: number;
  shape_code: string;
}

interface MatchResult {
  mark: string;
  bar_size: string;
  est_qty: number;
  act_qty: number;
  est_weight: number;
  act_weight: number;
  delta_pct: number;
  status: "match" | "close" | "mismatch";
}

interface ValidationResult {
  matched: MatchResult[];
  missing: ValidationItem[];
  extra: Array<{ mark: string; bar_size: string; quantity: number; weight_kg: number }>;
  total_est_weight: number;
  total_act_weight: number;
  accuracy_pct: number;
}

interface Props {
  projectId: string;
  items: any[];
}

const BAR_SIZE_MAP: Record<string, string> = {
  "10": "10M", "10M": "10M", "15": "15M", "15M": "15M",
  "20": "20M", "20M": "20M", "25": "25M", "25M": "25M",
  "30": "30M", "30M": "30M", "35": "35M", "35M": "35M",
};

const WEIGHT_PER_M: Record<string, number> = {
  "10M": 0.785, "15M": 1.570, "20M": 2.355,
  "25M": 3.925, "30M": 5.495, "35M": 7.850,
};

export default function BarlistValidation({ projectId, items }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const parseBarlistFile = async (file: File): Promise<ValidationItem[]> => {
    const arrayBuf = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuf), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const parsed: ValidationItem[] = [];
    let headerIdx = -1;
    let colMap: Record<string, number> = {};

    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const cells = rows[i]?.map((c: any) => String(c ?? "").trim().toLowerCase()) ?? [];
      const sizeIdx = cells.findIndex((c: string) => c === "size" || c === "bar size");
      const pcsIdx = cells.findIndex((c: string) => c.includes("pcs") || c === "qty" || c === "quantity");
      const lengthIdx = cells.findIndex((c: string) => c === "length" || c.includes("cut"));
      const markIdx = cells.findIndex((c: string) => c === "mark" || c === "bar mark");
      const typeIdx = cells.findIndex((c: string) => c === "type" || c.includes("shape"));

      if (sizeIdx >= 0) {
        headerIdx = i;
        colMap = { size: sizeIdx, pcs: pcsIdx >= 0 ? pcsIdx : 1, length: lengthIdx >= 0 ? lengthIdx : 4, mark: markIdx >= 0 ? markIdx : 5, type: typeIdx >= 0 ? typeIdx : 6 };
        break;
      }
    }

    if (headerIdx < 0) return [];

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 3) continue;

      const rawSize = String(row[colMap.size] ?? "").trim().toUpperCase();
      if (!rawSize) continue;
      const barSize = BAR_SIZE_MAP[rawSize] ?? rawSize;

      const qty = parseInt(String(row[colMap.pcs] ?? "0")) || 0;
      if (qty <= 0) continue;

      const cutRaw = parseFloat(String(row[colMap.length] ?? "0")) || 0;
      const cutMm = cutRaw > 100 ? cutRaw : cutRaw * 1000;

      const wpm = WEIGHT_PER_M[barSize] ?? 0;
      const weightKg = Math.round(qty * (cutMm / 1000) * wpm * 100) / 100;

      parsed.push({
        mark: String(row[colMap.mark] ?? "").trim(),
        bar_size: barSize,
        quantity: qty,
        weight_kg: weightKg,
        cut_length_mm: cutMm,
        shape_code: String(row[colMap.type] ?? "straight").trim(),
      });
    }

    return parsed;
  };

  const handleValidate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);

    try {
      const actualItems = await parseBarlistFile(file);
      if (actualItems.length === 0) {
        toast.error("No items found in the bar list file");
        return;
      }

      // Build mark map from actual
      const actualByMark = new Map<string, ValidationItem>();
      for (const item of actualItems) {
        const key = `${item.mark}|${item.bar_size}`;
        if (actualByMark.has(key)) {
          const existing = actualByMark.get(key)!;
          existing.quantity += item.quantity;
          existing.weight_kg += item.weight_kg;
        } else {
          actualByMark.set(key, { ...item });
        }
      }

      const matched: MatchResult[] = [];
      const extra: ValidationResult["extra"] = [];
      const matchedKeys = new Set<string>();

      for (const est of items) {
        const key = `${est.mark ?? ""}|${est.bar_size}`;
        const actual = actualByMark.get(key);

        if (actual) {
          matchedKeys.add(key);
          const deltaPct = actual.weight_kg > 0
            ? Math.round(((est.weight_kg - actual.weight_kg) / actual.weight_kg) * 10000) / 100
            : 0;
          matched.push({
            mark: est.mark ?? "",
            bar_size: est.bar_size,
            est_qty: est.quantity,
            act_qty: actual.quantity,
            est_weight: est.weight_kg,
            act_weight: actual.weight_kg,
            delta_pct: deltaPct,
            status: Math.abs(deltaPct) < 5 ? "match" : Math.abs(deltaPct) < 15 ? "close" : "mismatch",
          });
        } else {
          extra.push({ mark: est.mark ?? "", bar_size: est.bar_size, quantity: est.quantity, weight_kg: est.weight_kg });
        }
      }

      const missing = actualItems.filter((a) => !matchedKeys.has(`${a.mark}|${a.bar_size}`));

      const totalEst = items.reduce((s: number, i: any) => s + (i.weight_kg ?? 0), 0);
      const totalAct = actualItems.reduce((s, i) => s + i.weight_kg, 0);
      const accuracy = totalAct > 0 ? Math.round((1 - Math.abs(totalEst - totalAct) / totalAct) * 10000) / 100 : 0;

      setResult({ matched, missing, extra, total_est_weight: totalEst, total_act_weight: totalAct, accuracy_pct: accuracy });

      toast.success(`Validated ${actualItems.length} ground truth items against ${items.length} estimated items`);
    } catch (err: any) {
      toast.error(`Parse error: ${err.message}`);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={loading}>
          <Upload className="h-3.5 w-3.5 mr-1" />
          {loading ? "Parsing..." : "Upload RebarCAD Bar List"}
        </Button>
        <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleValidate} />
        {result && (
          <Badge variant={result.accuracy_pct >= 90 ? "default" : result.accuracy_pct >= 70 ? "secondary" : "destructive"}>
            {result.accuracy_pct}% Accuracy
          </Badge>
        )}
      </div>

      {result && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Estimated Weight</p>
                <p className="text-lg font-bold">{result.total_est_weight.toLocaleString()} kg</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Actual Weight</p>
                <p className="text-lg font-bold">{result.total_act_weight.toLocaleString()} kg</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Delta</p>
                <p className="text-lg font-bold">
                  {(result.total_est_weight - result.total_act_weight).toLocaleString()} kg
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Matched Items */}
          {result.matched.length > 0 && (
            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Matched ({result.matched.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left">Mark</th>
                        <th className="p-2 text-left">Size</th>
                        <th className="p-2 text-right">Est Qty</th>
                        <th className="p-2 text-right">Act Qty</th>
                        <th className="p-2 text-right">Est Wt</th>
                        <th className="p-2 text-right">Act Wt</th>
                        <th className="p-2 text-right">Δ%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.matched.map((m, idx) => (
                        <tr key={idx} className={`border-b ${m.status === "match" ? "bg-green-50 dark:bg-green-950/20" : m.status === "close" ? "bg-yellow-50 dark:bg-yellow-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                          <td className="p-2 font-mono">{m.mark}</td>
                          <td className="p-2">{m.bar_size}</td>
                          <td className="p-2 text-right">{m.est_qty}</td>
                          <td className="p-2 text-right">{m.act_qty}</td>
                          <td className="p-2 text-right">{m.est_weight.toFixed(1)}</td>
                          <td className="p-2 text-right">{m.act_weight.toFixed(1)}</td>
                          <td className="p-2 text-right font-mono">{m.delta_pct > 0 ? "+" : ""}{m.delta_pct.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Missing Items */}
          {result.missing.length > 0 && (
            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  Missing from Estimation ({result.missing.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left">Mark</th>
                        <th className="p-2 text-left">Size</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.missing.map((m, idx) => (
                        <tr key={idx} className="border-b bg-red-50 dark:bg-red-950/20">
                          <td className="p-2 font-mono">{m.mark}</td>
                          <td className="p-2">{m.bar_size}</td>
                          <td className="p-2 text-right">{m.quantity}</td>
                          <td className="p-2 text-right">{m.weight_kg.toFixed(1)} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Extra Items */}
          {result.extra.length > 0 && (
            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Extra in Estimation ({result.extra.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 text-left">Mark</th>
                        <th className="p-2 text-left">Size</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.extra.map((m, idx) => (
                        <tr key={idx} className="border-b bg-yellow-50 dark:bg-yellow-950/20">
                          <td className="p-2 font-mono">{m.mark}</td>
                          <td className="p-2">{m.bar_size}</td>
                          <td className="p-2 text-right">{m.quantity}</td>
                          <td className="p-2 text-right">{m.weight_kg.toFixed(1)} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
