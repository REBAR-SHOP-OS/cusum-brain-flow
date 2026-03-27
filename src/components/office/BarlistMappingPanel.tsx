import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, AlertCircle, Globe, ArrowRight } from "lucide-react";
import type { ExtractRow } from "@/lib/extractService";

// ── Canonical fields required for production rows ────────────
export interface CanonicalField {
  key: string;
  label: string;
  required: boolean;
  /** DB column on extract_rows that this maps to */
  dbColumn: string;
}

const CANONICAL_FIELDS: CanonicalField[] = [
  { key: "mark", label: "Mark", required: true, dbColumn: "mark" },
  { key: "size", label: "Bar Size", required: true, dbColumn: "bar_size" },
  { key: "shape", label: "Shape / Type", required: false, dbColumn: "shape_type" },
  { key: "length", label: "Cut Length (mm)", required: true, dbColumn: "total_length_mm" },
  { key: "quantity", label: "Quantity", required: true, dbColumn: "quantity" },
  { key: "dwg", label: "Drawing Ref", required: false, dbColumn: "dwg" },
  { key: "grade", label: "Grade", required: false, dbColumn: "grade" },
];

const DIM_FIELDS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "O", "R"] as const;

type LengthUnit = "mm" | "in" | "ft" | "imperial";
const LENGTH_UNITS: { value: LengthUnit; label: string; shortLabel: string; factor: number }[] = [
  { value: "mm", label: "Millimeters", shortLabel: "mm", factor: 1 },
  { value: "in", label: "Inches", shortLabel: "in", factor: 25.4 },
  { value: "ft", label: "Feet", shortLabel: "ft", factor: 304.8 },
  { value: "imperial", label: "Imperial (ft-in)", shortLabel: "ft-in", factor: 25.4 },
];

import { formatLengthByMode, type LengthDisplayMode } from "@/lib/unitSystem";

// ── Header alias map (lowercase → canonical key) ─────────────
const HEADER_ALIASES: Record<string, string> = {
  // mark
  "mark": "mark", "bar mark": "mark", "barmark": "mark", "bar_mark": "mark",
  // size
  "size": "size", "bar size": "size", "barsize": "size", "bar_size": "size", "bar": "size", "bar code": "size",
  // shape
  "shape": "shape", "type": "shape", "shape code": "shape", "shapecode": "shape",
  "shape_code": "shape", "shape_type": "shape", "bend type": "shape",
  // length
  "length": "length", "cut length": "length", "cutlength": "length", "total length": "length",
  "total_length": "length", "cut_length": "length", "total_length_mm": "length", "cut length mm": "length",
  // quantity
  "qty": "quantity", "quantity": "quantity", "pcs": "quantity", "no. pcs": "quantity",
  "no pcs": "quantity", "pieces": "quantity", "count": "quantity",
  // dwg
  "dwg": "dwg", "dwg.no": "dwg", "dwg no": "dwg", "drawing": "dwg", "drawing ref": "dwg",
  "drawing_ref": "dwg", "drg": "dwg",
  // grade
  "grade": "grade", "steel grade": "grade",
  // dimensions
  "a": "dim_a", "b": "dim_b", "c": "dim_c", "d": "dim_d", "e": "dim_e",
  "f": "dim_f", "g": "dim_g", "h": "dim_h", "i": "__ignore__", "j": "dim_j", "k": "dim_k",
  "o": "dim_o", "r": "dim_r",
  "dim a": "dim_a", "dim b": "dim_b", "dim c": "dim_c", "dim d": "dim_d",
  "dim e": "dim_e", "dim f": "dim_f", "dim g": "dim_g", "dim h": "dim_h",
  "dim j": "dim_j", "dim k": "dim_k", "dim o": "dim_o", "dim r": "dim_r",
};

// ── Source columns available from extract_rows ───────────────
interface SourceColumn {
  key: string;
  label: string;
}

const SOURCE_COLUMNS: SourceColumn[] = [
  { key: "mark", label: "mark" },
  { key: "bar_size", label: "bar_size" },
  { key: "bar_size_mapped", label: "bar_size_mapped" },
  { key: "shape_type", label: "shape_type" },
  { key: "shape_code_mapped", label: "shape_code_mapped" },
  { key: "total_length_mm", label: "total_length_mm" },
  { key: "quantity", label: "quantity" },
  { key: "dwg", label: "dwg" },
  { key: "grade", label: "grade" },
  { key: "grade_mapped", label: "grade_mapped" },
  { key: "item_number", label: "item_number" },
  { key: "reference", label: "reference" },
  { key: "weight_kg", label: "weight_kg" },
  ...DIM_FIELDS.map(d => ({ key: `dim_${d.toLowerCase()}`, label: `dim_${d.toLowerCase()}` })),
];

// ── Auto-detect mapping from existing data ───────────────────
function autoDetectMapping(rows: ExtractRow[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  // Direct canonical → DB column mapping (these always exist in extract_rows)
  for (const field of CANONICAL_FIELDS) {
    mapping[field.key] = field.dbColumn;
  }

  // Dimensions are always dim_X
  for (const d of DIM_FIELDS) {
    mapping[`dim_${d.toLowerCase()}`] = `dim_${d.toLowerCase()}`;
  }

  // If mapped variants have data, prefer them
  if (rows.some(r => r.bar_size_mapped)) {
    mapping["size"] = "bar_size_mapped";
  }
  if (rows.some(r => r.shape_code_mapped)) {
    mapping["shape"] = "shape_code_mapped";
  }
  if (rows.some(r => r.grade_mapped)) {
    mapping["grade"] = "grade_mapped";
  }

  return mapping;
}

// ── Check which required fields have data ────────────────────
function checkDataCoverage(rows: ExtractRow[], mapping: Record<string, string>) {
  const issues: Array<{ field: string; type: "missing" | "empty" }> = [];

  for (const field of CANONICAL_FIELDS) {
    if (!field.required) continue;
    const sourceCol = mapping[field.key];
    if (!sourceCol) {
      issues.push({ field: field.label, type: "missing" });
      continue;
    }
    // Check if any row actually has data in this column
    const hasData = rows.some(r => {
      const val = (r as any)[sourceCol];
      return val !== null && val !== undefined && val !== "" && val !== 0;
    });
    if (!hasData) {
      issues.push({ field: field.label, type: "empty" });
    }
  }

  return issues;
}

// ── Build dimensions JSON from row (with unit conversion) ────
function buildDimensionsJson(row: ExtractRow): Record<string, number> {
  const dims: Record<string, number> = {};
  for (const d of DIM_FIELDS) {
    const val = (row as any)[`dim_${d.toLowerCase()}`];
    if (val != null && val !== 0) dims[d] = Math.round(Number(val));
  }
  return dims;
}

// ── Component Props ──────────────────────────────────────────
interface BarlistMappingPanelProps {
  rows: ExtractRow[];
  sessionId: string;
  onConfirmMapping: (mappedRows: MappedRow[], unitSystem: string) => void;
  disabled?: boolean;
  /** Controlled unit system from parent */
  unitSystem?: LengthUnit;
  /** Callback when user changes unit */
  onUnitSystemChange?: (unit: LengthUnit) => void;
}

export interface MappedRow {
  source_row_id: string;
  source_row_index: number;
  mark: string;
  size: string;
  shape: string;
  length: number;
  quantity: number;
  dimensions_json: Record<string, number>;
  dwg: string;
  grade: string;
}

export function BarlistMappingPanel({ rows, sessionId, onConfirmMapping, disabled, unitSystem: controlledUnit, onUnitSystemChange }: BarlistMappingPanelProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(() => autoDetectMapping(rows));
  const [confirmed, setConfirmed] = useState(false);
  // Use controlled unit from parent if provided, otherwise local state
  const [localLengthUnit, setLocalLengthUnit] = useState<LengthUnit>("mm");
  const lengthUnit = controlledUnit ?? localLengthUnit;
  const setLengthUnit = (unit: LengthUnit) => {
    if (onUnitSystemChange) onUnitSystemChange(unit);
    else setLocalLengthUnit(unit);
  };

  const lengthFactor = useMemo(() => LENGTH_UNITS.find(u => u.value === lengthUnit)?.factor ?? 1, [lengthUnit]);
  const unitLabel = useMemo(() => LENGTH_UNITS.find(u => u.value === lengthUnit)?.shortLabel ?? "mm", [lengthUnit]);

  const issues = useMemo(() => checkDataCoverage(rows, mapping), [rows, mapping]);
  const blockers = issues.filter(i => i.type === "missing" || i.type === "empty");
  const canConfirm = blockers.length === 0 && rows.length > 0;

  const updateMapping = useCallback((canonicalKey: string, sourceCol: string) => {
    setMapping(prev => ({ ...prev, [canonicalKey]: sourceCol }));
    setConfirmed(false);
  }, []);

  // Preview first 5 mapped rows
  const previewRows = useMemo((): MappedRow[] => {
    return rows.slice(0, 5).map(row => ({
      source_row_id: row.id,
      source_row_index: row.row_index,
      mark: String((row as any)[mapping.mark] ?? ""),
      size: String((row as any)[mapping.size] ?? ""),
      shape: String((row as any)[mapping.shape] ?? ""),
      length: Math.round(Number((row as any)[mapping.length] ?? 0)),
      quantity: Number((row as any)[mapping.quantity] ?? 0),
      dimensions_json: buildDimensionsJson(row),
      dwg: String((row as any)[mapping.dwg] ?? ""),
      grade: String((row as any)[mapping.grade] ?? ""),
    }));
  }, [rows, mapping, lengthFactor]);

  const handleConfirm = () => {
    if (!canConfirm) return;
    const allMapped: MappedRow[] = rows.map(row => ({
      source_row_id: row.id,
      source_row_index: row.row_index,
      mark: String((row as any)[mapping.mark] ?? ""),
      size: String((row as any)[mapping.size] ?? ""),
      shape: String((row as any)[mapping.shape] ?? ""),
      length: Math.round(Number((row as any)[mapping.length] ?? 0)),
      quantity: Number((row as any)[mapping.quantity] ?? 0),
      dimensions_json: buildDimensionsJson(row),
      dwg: String((row as any)[mapping.dwg] ?? ""),
      grade: String((row as any)[mapping.grade] ?? ""),
    }));
    setConfirmed(true);
    onConfirmMapping(allMapped, lengthUnit);
  };

  return (
    <Card className="border-primary/30 bg-primary/5 overflow-hidden max-w-full min-w-0 flex flex-col max-h-[80vh]">
      <CardContent className="p-4 flex flex-col flex-1 min-h-0 gap-4">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Bar List Column Mapping</span>
            <Badge variant="secondary" className="text-[10px]">
              {rows.length} rows · {CANONICAL_FIELDS.filter(f => f.required).length} required fields
            </Badge>
          </div>
          {confirmed && (
            <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/40 text-[10px]">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Mapping Confirmed
            </Badge>
          )}
        </div>

        {/* ── Unit System Toggle ── */}
        <div className="shrink-0 space-y-1.5">
          <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            Source Data Units
          </span>
          <div className="flex gap-1 p-1 rounded-lg bg-muted/60 border border-border w-fit">
            {LENGTH_UNITS.map(u => (
              <button
                key={u.value}
                type="button"
                disabled={disabled}
                onClick={() => { setLengthUnit(u.value); setConfirmed(false); }}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                  lengthUnit === u.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                } disabled:opacity-50`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable content: mapping grid + blockers + preview */}
        <div className="flex-1 overflow-auto min-h-0 space-y-4">
          {/* Mapping Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {CANONICAL_FIELDS.map(field => (
              <div key={field.key} className="flex flex-wrap items-center gap-2 p-2 rounded-md bg-background/60 border border-border min-w-0">
                <div className="flex items-center gap-1 min-w-[70px] shrink-0">
                  {field.required && <span className="text-destructive text-[10px]">*</span>}
                  <span className="text-xs font-medium text-foreground truncate">
                    {field.key === "length" ? `Cut Length` : field.label}
                  </span>
                </div>
                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                <Select
                  value={mapping[field.key] || ""}
                  onValueChange={(val) => updateMapping(field.key, val)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_COLUMNS.map(col => (
                      <SelectItem key={col.key} value={col.key} className="text-xs">
                        {col.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Blockers */}
          {blockers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {blockers.map((b, i) => (
                <Badge key={i} variant="destructive" className="text-[10px] gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {b.field}: {b.type === "missing" ? "no column mapped" : "all values empty"}
                </Badge>
              ))}
            </div>
          )}

          {/* Preview Table */}
          {previewRows.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-1.5 border-b border-border">
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  Mapped Preview — First {previewRows.length} of {rows.length} rows
                  {lengthUnit !== "mm" && (
                    <span className="ml-2 text-primary">
                      (source: {unitLabel} → stored as mm)
                    </span>
                  )}
                </span>
              </div>
              <div className="overflow-x-auto max-h-52">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-[10px] font-bold tracking-wider w-[40px]">#</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider">MARK</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider">SIZE</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider">SHAPE</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider text-right">LENGTH ({unitLabel})</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider text-right">QTY</TableHead>
                      <TableHead className="text-[10px] font-bold tracking-wider">DIMS ({unitLabel})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row) => {
                      const dimEntries = Object.entries(row.dimensions_json).filter(([, v]) => v > 0);
                      return (
                        <TableRow key={row.source_row_id}>
                          <TableCell className="text-xs p-1.5 text-muted-foreground">{row.source_row_index}</TableCell>
                          <TableCell className="text-xs p-1.5 font-medium">{row.mark || "—"}</TableCell>
                          <TableCell className="text-xs p-1.5">{row.size || "—"}</TableCell>
                          <TableCell className="text-xs p-1.5">{row.shape || "—"}</TableCell>
                          <TableCell className="text-xs p-1.5 text-right font-mono">
                            {row.length ? String(row.length) : "—"}
                          </TableCell>
                          <TableCell className="text-xs p-1.5 text-right font-mono">{row.quantity || "—"}</TableCell>
                          <TableCell className="text-[10px] p-1.5 text-muted-foreground max-w-[150px] truncate">
                            {dimEntries.length > 0
                              ? dimEntries.map(([k, v]) => `${k}=${v}`).join(" ")
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Button — fixed footer, always visible */}
        <div className="shrink-0 pt-3 border-t border-border" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="flex items-center justify-end gap-2">
            {!canConfirm && rows.length > 0 && (
              <span className="text-xs text-destructive">
                Fix mapping issues above before confirming
              </span>
            )}
            <Button
              onClick={handleConfirm}
              disabled={!canConfirm || disabled || confirmed}
              size="sm"
              className="gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {confirmed ? "Mapping Confirmed" : "Confirm Mapping"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
