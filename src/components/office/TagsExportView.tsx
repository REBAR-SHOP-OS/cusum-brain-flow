import { useState, useMemo, useCallback, useEffect } from "react";
import { useExtractSessions, useExtractRows } from "@/hooks/useExtractSessions";
import { useShapeSchematics } from "@/hooks/useShapeSchematics";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RebarTagCard } from "@/components/office/RebarTagCard";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ZebraZplModal } from "@/components/office/ZebraZplModal";
import { generateZpl } from "@/utils/generateZpl";
import { supabase } from "@/integrations/supabase/client";
import { sessionUnitToDisplay } from "@/lib/unitSystem";
import { toast } from "sonner";
import {
  LayoutGrid, Table as TableIcon, Download, Printer,
  Zap, Sparkles, ChevronRight, ChevronDown, Tag, Trash2,
} from "lucide-react";

// Mass per meter by bar code (RSIC Canada)
const MASS_KG_PER_M: Record<string, number> = {
  "10M": 0.785, "15M": 1.570, "20M": 2.355, "25M": 3.925,
  "30M": 5.495, "35M": 7.850, "45M": 11.775, "55M": 19.625,
};

const DIM_COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "O", "R"] as const;

/** Format a dimension value (always stored in mm in DB) for display.
 *  For imperial: converts mm → inches first, then formats as ft-in. */
function formatDim(val: number | null | undefined, unitSystem: string): string {
  if (val == null || val === 0) return "";
  const rounded = Math.round(val);
  if (unitSystem === "imperial") {
    const totalInches = rounded / 25.4; // mm → inches
    const feet = Math.floor(totalInches / 12);
    const rawInches = totalInches % 12;
    const eighths = Math.round(rawInches * 8);
    const wholeInches = Math.floor(eighths / 8);
    const remainderEighths = eighths % 8;
    const fractionMap: Record<number, string> = {
      0: "", 1: "⅛", 2: "¼", 3: "⅜", 4: "½", 5: "⅝", 6: "¾", 7: "⅞",
    };
    const frac = fractionMap[remainderEighths] || "";
    if (feet === 0) return `${wholeInches}${frac}"`;
    if (wholeInches === 0 && !frac) return `${feet}'-0"`;
    return `${feet}'-${wholeInches}${frac}"`;
  }
  return String(rounded);
}

/** Unit suffix label */
function dimUnit(unitSystem: string): string {
  return unitSystem === "imperial" ? "" : "MM";
}

function getWeight(size: string | null, lengthMm: number | null, qty: number | null): string {
  if (!size || !lengthMm) return "";
  const mass = MASS_KG_PER_M[size.toUpperCase()] || 0;
  if (!mass) return "";
  return ((lengthMm / 1000) * mass * (qty || 1)).toFixed(2);
}

export function TagsExportView() {
  const { sessions, loading: sessionsLoading, refresh } = useExtractSessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const { rows, loading: rowsLoading } = useExtractRows(selectedSessionId);
  const { getShapeImageUrl } = useShapeSchematics();
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [sortMode, setSortMode] = useState<"standard" | "optimized">("standard");
  const [zebraOpen, setZebraOpen] = useState(false);
  const [zebraZpl, setZebraZpl] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [projectAddress, setProjectAddress] = useState("");

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  // Fetch project address as fallback for tags
  useEffect(() => {
    if (!selectedSessionId) { setProjectAddress(""); return; }
    supabase
      .from("barlists")
      .select("project:projects(site_address)")
      .eq("extract_session_id", selectedSessionId)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const addr = (data as any)?.project?.site_address;
        setProjectAddress(addr || "");
      });
  }, [selectedSessionId]);

  // Only show approved/validated/mapped sessions that have data
  const availableSessions = useMemo(
    () => sessions.filter((s) => ["approved", "validated", "mapping", "extracted"].includes(s.status)),
    [sessions],
  );

  const sortedRows = useMemo(() => {
    if (sortMode === "standard") return rows;
    // Optimized: group by bar_size then sort by length
    return [...rows].sort((a, b) => {
      const sizeA = a.bar_size_mapped || a.bar_size || "";
      const sizeB = b.bar_size_mapped || b.bar_size || "";
      if (sizeA !== sizeB) return sizeA.localeCompare(sizeB);
      return (a.total_length_mm || 0) - (b.total_length_mm || 0);
    });
  }, [rows, sortMode]);

  // CSV export
  const handleExportCSV = () => {
    if (!sortedRows.length) return;
    const us = sessionUnitToDisplay((selectedSession as any)?.unit_system);
    const lengthHeader = us === "imperial" ? "TOTAL LENGTH (ft-in)" : "TOTAL LENGTH (mm)";
    const dimUnit = us === "imperial" ? "in" : "mm";
    const headers = ["DWG #", "ITEM", "GRADE", "MARK", "QUANTITY", "SIZE", "TYPE", lengthHeader,
      ...DIM_COLS.map(d => `${d} (${dimUnit})`), "WEIGHT", "PICTURE", "CUSTOMER", "REF", "ADD"];
    const csvRows = sortedRows.map((r) => {
      const size = r.bar_size_mapped || r.bar_size || "";
      const shapeType = r.shape_code_mapped || r.shape_type || "STRAIGHT";
      const weight = getWeight(size, r.total_length_mm, r.quantity);
      const picture = shapeType ? (getShapeImageUrl(shapeType) || `TYPE-${shapeType}.PNG`) : "";
      const formattedLength = r.total_length_mm ? formatDim(r.total_length_mm, us) : "";
      return [
        r.dwg || "", r.row_index, r.grade_mapped || r.grade || "", r.mark || "",
        r.quantity || "", size, shapeType, formattedLength,
        ...DIM_COLS.map((d) => {
          const key = `dim_${d.toLowerCase()}` as keyof typeof r;
          return r[key] != null ? formatDim(Number(r[key]), us) : "";
        }),
        weight, picture, r.customer || "", r.reference || "", r.address || (selectedSession as any)?.site_address || projectAddress || "",
      ].join(",");
    });
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedSession?.name || "tags-export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print tags — open dedicated print route in new window
  const handlePrint = useCallback(() => {
    const us = sessionUnitToDisplay((selectedSession as any)?.unit_system);
    const url = `/print-tags?sessionId=${selectedSessionId}&unit=${us}&sort=${sortMode}`;
    window.open(url, "_blank");
  }, [selectedSession, selectedSessionId, sortMode]);

  // Intercept Ctrl+P / Cmd+P → redirect to clean print route
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        e.stopPropagation();
        handlePrint();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [handlePrint]);

  // Zebra ZPL export
  const handleZebraZPL = () => {
    const zplRows = sortedRows.map((row) => {
      const size = row.bar_size_mapped || row.bar_size || "";
      const dims: Record<string, number | null> = {};
      DIM_COLS.forEach((d) => {
        const key = `dim_${d.toLowerCase()}` as keyof typeof row;
        const v = row[key];
        dims[d] = typeof v === "number" ? v : null;
      });
      return {
        mark: row.mark || "",
        size,
        grade: row.grade_mapped || row.grade || "",
        qty: row.quantity,
        total_length_mm: row.total_length_mm,
        weight: getWeight(size, row.total_length_mm, row.quantity),
        dwg: row.dwg || "",
        row_index: row.row_index,
        reference: row.reference || "",
        customer: row.customer || "",
        remark: row.address || "",
        dims,
      };
    });
    const zplUnit = sessionUnitToDisplay(selectedSession?.unit_system);
    setZebraZpl(generateZpl(zplRows, selectedSession?.name || "tags-export", zplUnit));
    setZebraOpen(true);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    const { error } = await supabase
      .from("extract_sessions")
      .delete()
      .in("id", Array.from(selectedIds));
    if (error) toast.error(error.message);
    else {
      toast.success(`Deleted ${selectedIds.size} session(s)`);
      setSelectedIds(new Set());
      refresh();
    }
    setDeleting(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Session selection screen
  if (!selectedSessionId) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-black italic text-foreground uppercase">Tags & Export</h1>
        <p className="text-sm text-muted-foreground">Select a manifest session to view tags and export data.</p>
        {sessionsLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : availableSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions with extracted data found.</p>
        ) : (
          <div className="space-y-2">
            {/* Select All + Bulk Delete toolbar */}
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedIds.size === availableSessions.length && availableSessions.length > 0}
                onCheckedChange={(checked) => {
                  if (checked) setSelectedIds(new Set(availableSessions.map((s) => s.id)));
                  else setSelectedIds(new Set());
                }}
              />
              <span className="text-xs text-muted-foreground">Select All</span>
              {selectedIds.size > 0 && (
                <Button variant="destructive" size="sm" className="h-7 gap-1.5 text-xs" onClick={handleBulkDelete} disabled={deleting}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete {selectedIds.size}
                </Button>
              )}
            </div>

            {availableSessions.map((s) => (
              <div
                key={s.id}
                className="w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={selectedIds.has(s.id)}
                  onCheckedChange={() => toggleSelect(s.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  className="flex-1 flex items-center justify-between"
                  onClick={() => setSelectedSessionId(s.id)}
                >
                  <div>
                    <span className="font-bold text-foreground">{s.name}</span>
                    {s.customer && (
                      <span className="ml-3 text-xs text-muted-foreground">{s.customer}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={`text-[10px] tracking-wider border-0 ${
                        s.status === "approved"
                          ? "bg-emerald-500/20 text-emerald-500"
                          : "bg-primary/20 text-primary"
                      }`}
                    >
                      {s.status.toUpperCase()}
                    </Badge>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header — hidden in print */}
      <div className="no-print-tag px-6 py-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <LayoutGrid className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">{selectedSession?.name}</h2>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase">
                Tags & Dispatch Tooling
              </p>
            </div>
          </div>

          {/* Sort mode toggle */}
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <Button
              variant={sortMode === "standard" ? "default" : "ghost"}
              size="sm" className="h-7 text-xs gap-1"
              onClick={() => setSortMode("standard")}
            >
               <Zap className="w-3 h-3" /> Raw
            </Button>
            <Button
              variant={sortMode === "optimized" ? "default" : "ghost"}
              size="sm" className="h-7 text-xs gap-1"
              onClick={() => setSortMode("optimized")}
            >
              <Sparkles className="w-3 h-3" /> Optimized
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm" className="h-7 text-xs gap-1"
              onClick={() => setViewMode("table")}
            >
              <TableIcon className="w-3 h-3" /> Table
            </Button>
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm" className="h-7 text-xs gap-1"
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="w-3 h-3" /> Cards
            </Button>
          </div>

          <Button
            variant="outline" size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={handleExportCSV}
            disabled={sortedRows.length === 0}
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          {/* Print Tags split button */}
          <div className="flex items-center">
            <Button size="sm" className="gap-1.5 text-xs h-8 rounded-r-none" onClick={handlePrint}>
              <Printer className="w-3.5 h-3.5" /> Print Tags
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="h-8 px-1.5 rounded-l-none border-l border-primary-foreground/30">
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleZebraZPL}>
                  <Tag className="w-3.5 h-3.5 mr-2" />
                  Zebra ZT411 (4×6 in) — ZPL
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Table view */}
      {viewMode === "table" ? (
        <ScrollArea className="flex-1">
          <div className="min-w-[2400px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-primary/10 border-b border-border sticky top-0 z-10">
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">DWG #</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Item</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Grade</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Mark</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Qty</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Size</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Type</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">
                    Total Length {sessionUnitToDisplay((selectedSession as any)?.unit_system) === "imperial" ? "(ft-in)" : "(mm)"}
                  </th>
                  {DIM_COLS.map((c) => (
                    <th key={c} className="text-[10px] font-bold tracking-widest text-primary uppercase text-right px-3 py-2 whitespace-nowrap">{c}</th>
                  ))}
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-right px-3 py-2 whitespace-nowrap">Weight</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Picture</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Customer</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Ref</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Add</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Delivery Date</th>
                </tr>
              </thead>
              <tbody>
                {rowsLoading ? (
                  <tr><td colSpan={25} className="p-8 text-center text-muted-foreground text-sm">Loading...</td></tr>
                ) : sortedRows.length === 0 ? (
                  <tr><td colSpan={25} className="p-8 text-center text-muted-foreground text-sm">No items.</td></tr>
                ) : (
                  sortedRows.map((row) => {
                    const size = row.bar_size_mapped || row.bar_size || "";
                     const shapeType = row.shape_code_mapped || row.shape_type || "STRAIGHT";
                    const weight = getWeight(size, row.total_length_mm, row.quantity);
                    const us = sessionUnitToDisplay((selectedSession as any)?.unit_system);
                    const unit = dimUnit(us);

                    return (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="text-xs text-muted-foreground font-mono px-3 py-2.5 whitespace-nowrap">{row.dwg || "—"}</td>
                        <td className="text-xs text-muted-foreground px-3 py-2.5">{row.row_index}</td>
                        <td className="text-xs text-muted-foreground px-3 py-2.5">{row.grade_mapped || row.grade || "—"}</td>
                        <td className="text-xs font-bold text-foreground px-3 py-2.5 whitespace-nowrap">{row.mark || "—"}</td>
                        <td className="text-xs font-medium px-3 py-2.5">{row.quantity ?? "—"}</td>
                        <td className="text-xs px-3 py-2.5">{size || "—"}</td>
                        <td className="text-xs px-3 py-2.5">{shapeType || "—"}</td>
                        <td className="text-xs font-bold text-primary px-3 py-2.5 whitespace-nowrap">
                          {row.total_length_mm ? (
                            <>{formatDim(row.total_length_mm, us)} {unit && <sub className="text-[8px] text-primary/60">{unit}</sub>}</>
                          ) : "—"}
                        </td>
                        {DIM_COLS.map((d) => {
                          const key = `dim_${d.toLowerCase()}` as keyof typeof row;
                          const val = row[key] as number | null;
                          return (
                            <td key={d} className="text-xs text-muted-foreground text-right px-3 py-2.5 whitespace-nowrap">
                              {val != null && val !== 0 ? (
                                <>{formatDim(val, us)} {unit && <sub className="text-[8px] ml-0.5">{unit}</sub>}</>
                              ) : ""}
                            </td>
                          );
                        })}
                        <td className="text-xs text-muted-foreground text-right px-3 py-2.5 whitespace-nowrap">{weight}</td>
                        <td className="text-[10px] text-muted-foreground px-3 py-2.5 whitespace-nowrap">
                          {shapeType ? (getShapeImageUrl(shapeType) ? "✓" : `TYPE-${shapeType}.PNG`) : "—"}
                        </td>
                        <td className="text-xs text-muted-foreground px-3 py-2.5 whitespace-nowrap">{row.customer || "—"}</td>
                        <td className="text-xs text-muted-foreground px-3 py-2.5 whitespace-nowrap">{row.reference || "—"}</td>
                        <td className="text-xs text-muted-foreground px-3 py-2.5">{row.address || "—"}</td>
                        <td className="text-xs text-muted-foreground px-3 py-2.5 whitespace-nowrap">
                          {selectedSession?.target_eta
                            ? new Date(selectedSession.target_eta).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : (
        /* Cards view — physical tag layout */
        <ScrollArea className="flex-1">
          <div className="p-6 flex flex-wrap gap-6 justify-center">
            {rowsLoading ? (
              <div className="col-span-full text-center text-muted-foreground text-sm p-8">Loading...</div>
            ) : sortedRows.length === 0 ? (
              <div className="col-span-full text-center text-muted-foreground text-sm p-8">No items.</div>
            ) : (
              sortedRows.map((row) => {
                const size = row.bar_size_mapped || row.bar_size || "";
                const shapeType = row.shape_code_mapped || row.shape_type || "STRAIGHT";
                const weight = getWeight(size, row.total_length_mm, row.quantity);
                const dims: Record<string, number | null> = {};
                DIM_COLS.forEach((d) => {
                  const key = `dim_${d.toLowerCase()}` as keyof typeof row;
                  const v = row[key];
                  dims[d] = typeof v === "number" ? v : null;
                });

                return (
                  <RebarTagCard
                    key={row.id}
                    mark={row.mark || ""}
                    size={size}
                    grade={row.grade_mapped || row.grade || ""}
                    qty={row.quantity}
                    length={row.total_length_mm}
                    weight={weight}
                    shapeType={shapeType}
                    dwg={row.dwg || ""}
                    item={row.row_index}
                    customer={row.customer || ""}
                    reference={row.reference || ""}
                    address={row.address || (selectedSession as any)?.site_address || projectAddress || ""}
                    dims={dims}
                    shapeImageUrl={getShapeImageUrl(shapeType)}
                    unitSystem={sessionUnitToDisplay((selectedSession as any)?.unit_system)}
                  />
                );
              })
            )}
          </div>
        </ScrollArea>
      )}

      <ZebraZplModal
        open={zebraOpen}
        onOpenChange={setZebraOpen}
        zpl={zebraZpl}
        labelCount={sortedRows.length}
        sessionName={selectedSession?.name || "tags-export"}
      />
    </div>
  );
}
