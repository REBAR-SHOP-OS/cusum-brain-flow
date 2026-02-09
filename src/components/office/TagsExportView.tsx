import { useState, useMemo } from "react";
import { useExtractSessions, useExtractRows } from "@/hooks/useExtractSessions";
import { useShapeSchematics } from "@/hooks/useShapeSchematics";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RebarTagCard } from "@/components/office/RebarTagCard";
import {
  LayoutGrid, Table as TableIcon, Download, Printer,
  Zap, Sparkles, ChevronRight,
} from "lucide-react";

// Mass per meter by bar code (RSIC Canada)
const MASS_KG_PER_M: Record<string, number> = {
  "10M": 0.785, "15M": 1.570, "20M": 2.355, "25M": 3.925,
  "30M": 5.495, "35M": 7.850, "45M": 11.775, "55M": 19.625,
};

const DIM_COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "O", "R"] as const;

function getWeight(size: string | null, lengthMm: number | null, qty: number | null): string {
  if (!size || !lengthMm) return "";
  const mass = MASS_KG_PER_M[size.toUpperCase()] || 0;
  if (!mass) return "";
  return ((lengthMm / 1000) * mass * (qty || 1)).toFixed(2);
}

export function TagsExportView() {
  const { sessions, loading: sessionsLoading } = useExtractSessions();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const { rows, loading: rowsLoading } = useExtractRows(selectedSessionId);
  const { getShapeImageUrl } = useShapeSchematics();
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [sortMode, setSortMode] = useState<"standard" | "optimized">("standard");

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

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
    const headers = ["DWG #", "ITEM", "GRADE", "MARK", "QUANTITY", "SIZE", "TYPE", "TOTAL LENGTH",
      ...DIM_COLS, "WEIGHT", "PICTURE", "CUSTOMER", "REF", "ADD"];
    const csvRows = sortedRows.map((r) => {
      const size = r.bar_size_mapped || r.bar_size || "";
      const shapeType = r.shape_code_mapped || r.shape_type || "";
      const weight = getWeight(size, r.total_length_mm, r.quantity);
      const picture = shapeType ? `TYPE-${shapeType}.PNG` : "";
      return [
        r.dwg || "", r.row_index, r.grade_mapped || r.grade || "", r.mark || "",
        r.quantity || "", size, shapeType, r.total_length_mm || "",
        ...DIM_COLS.map((d) => {
          const key = `dim_${d.toLowerCase()}` as keyof typeof r;
          return r[key] != null ? String(r[key]) : "";
        }),
        weight, picture, r.customer || "", r.reference || "", r.address || "",
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

  // Print tags — open dedicated print window to avoid CSS ancestor issues
  const handlePrint = () => {
    const tags = document.querySelectorAll('.rebar-tag');
    if (!tags.length) return;

    const printWindow = window.open('', '_blank', 'width=700,height=500');
    if (!printWindow) return;

    const tagsHtml = Array.from(tags).map(t => t.outerHTML).join('');
    
    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>Print Tags</title>
<style>
  @page { size: 6in 4in; margin: 0; padding: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; background: #fff; color: #000; }
  .rebar-tag {
    width: 6in; height: 4in; border: 1px solid #000;
    display: flex; flex-direction: column; overflow: hidden;
    page-break-after: always; page-break-inside: avoid;
    background: #fff; color: #000; box-sizing: border-box;
  }
  .rebar-tag * { color: #000 !important; border-color: #000 !important; }
  .grid { display: grid; }
  .grid-cols-5 { grid-template-columns: repeat(5, 1fr); }
  .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .flex-1 { flex: 1; }
  .items-center { align-items: center; }
  .justify-center { justify-content: center; }
  .justify-between { justify-content: space-between; }
  .text-center { text-align: center; }
  .font-bold { font-weight: 700; }
  .font-black { font-weight: 900; }
  .font-mono { font-family: 'Courier New', monospace; }
  .text-lg { font-size: 1.125rem; }
  .text-sm { font-size: 0.875rem; }
  .text-xs { font-size: 0.75rem; }
  .text-\\[8px\\] { font-size: 8px; }
  .text-\\[9px\\] { font-size: 9px; }
  .text-\\[10px\\] { font-size: 10px; }
  .text-\\[11px\\] { font-size: 11px; }
  .uppercase { text-transform: uppercase; }
  .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .leading-tight { line-height: 1.25; }
  .tracking-widest { letter-spacing: 0.1em; }
  .tracking-wider { letter-spacing: 0.05em; }
  .gap-1 { gap: 0.25rem; }
  .gap-0\\.5 { gap: 0.125rem; }
  .gap-\\[1px\\] { gap: 1px; }
  .gap-x-3 { column-gap: 0.75rem; }
  .gap-y-0\\.5 { row-gap: 0.125rem; }
  .space-y-0\\.5 > * + * { margin-top: 0.125rem; }
  .space-y-px > * + * { margin-top: 1px; }
  .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
  .py-0\\.5 { padding-top: 0.125rem; padding-bottom: 0.125rem; }
  .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
  .py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
  .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
  .mb-1\\.5 { margin-bottom: 0.375rem; }
  .ml-auto { margin-left: auto; }
  .my-0\\.5 { margin-top: 0.125rem; margin-bottom: 0.125rem; }
  .w-3 { width: 0.75rem; }
  .w-8 { width: 2rem; }
  .w-20 { width: 5rem; }
  .h-8 { height: 2rem; }
  .h-12 { height: 3rem; }
  .min-h-0 { min-height: 0; }
  .max-w-full { max-width: 100%; }
  .max-h-full { max-height: 100%; }
  .object-contain { object-fit: contain; }
  .shrink-0 { flex-shrink: 0; }
  .rounded-full { border-radius: 9999px; }
  .border { border-width: 1px; border-style: solid; }
  .border-2 { border-width: 2px; border-style: solid; }
  .border-b { border-bottom-width: 1px; border-bottom-style: solid; }
  .border-b-2 { border-bottom-width: 2px; border-bottom-style: solid; }
  .border-r-2 { border-right-width: 2px; border-right-style: solid; }
  .border-t { border-top-width: 1px; border-top-style: solid; }
  .overflow-hidden { overflow: hidden; }
  .bg-black { background: #000 !important; }
  .bg-white { background: #fff !important; }
  img { max-width: 100%; max-height: 100%; object-fit: contain; }
</style>
</head><body>${tagsHtml}</body></html>`);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
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
            {availableSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSessionId(s.id)}
                className="w-full flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
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
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border">
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
              <Zap className="w-3 h-3" /> Standard
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
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={handlePrint}>
            <Printer className="w-3.5 h-3.5" /> Print Tags
          </Button>
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
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Total Length</th>
                  {DIM_COLS.map((c) => (
                    <th key={c} className="text-[10px] font-bold tracking-widest text-primary uppercase text-right px-3 py-2 whitespace-nowrap">{c}</th>
                  ))}
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-right px-3 py-2 whitespace-nowrap">Weight</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Picture</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Customer</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Ref</th>
                  <th className="text-[10px] font-bold tracking-widest text-primary uppercase text-left px-3 py-2 whitespace-nowrap">Add</th>
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
                    const shapeType = row.shape_code_mapped || row.shape_type || "";
                    const weight = getWeight(size, row.total_length_mm, row.quantity);

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
                            <>{row.total_length_mm} <sub className="text-[8px] text-primary/60">MM</sub></>
                          ) : "—"}
                        </td>
                        {DIM_COLS.map((d) => {
                          const key = `dim_${d.toLowerCase()}` as keyof typeof row;
                          const val = row[key];
                          return (
                            <td key={d} className="text-xs text-muted-foreground text-right px-3 py-2.5 whitespace-nowrap">
                              {val != null && val !== 0 ? (
                                <>{String(val)} <sub className="text-[8px] ml-0.5">MM</sub></>
                              ) : ""}
                            </td>
                          );
                        })}
                        <td className="text-xs text-muted-foreground text-right px-3 py-2.5 whitespace-nowrap">{weight}</td>
                        <td className="text-[10px] text-muted-foreground px-3 py-2.5 whitespace-nowrap">
                          {shapeType ? `TYPE-${shapeType}.PNG` : "—"}
                        </td>
                        <td className="text-xs text-muted-foreground px-3 py-2.5 whitespace-nowrap">{row.customer || "—"}</td>
                        <td className="text-xs text-muted-foreground px-3 py-2.5 whitespace-nowrap">{row.reference || "—"}</td>
                        <td className="text-xs text-muted-foreground px-3 py-2.5">{row.address || "—"}</td>
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
          <div className="p-6 grid grid-cols-1 gap-6 max-w-[6.5in] mx-auto">
            {rowsLoading ? (
              <div className="col-span-full text-center text-muted-foreground text-sm p-8">Loading...</div>
            ) : sortedRows.length === 0 ? (
              <div className="col-span-full text-center text-muted-foreground text-sm p-8">No items.</div>
            ) : (
              sortedRows.map((row) => {
                const size = row.bar_size_mapped || row.bar_size || "";
                const shapeType = row.shape_code_mapped || row.shape_type || "";
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
                    address={row.address || ""}
                    dims={dims}
                    shapeImageUrl={getShapeImageUrl(shapeType)}
                  />
                );
              })
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
