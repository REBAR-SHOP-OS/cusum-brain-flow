import { useState, useMemo } from "react";
import { useExtractSessions, useExtractRows } from "@/hooks/useExtractSessions";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  // Print tags
  const handlePrint = () => window.print();

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
        /* Cards view */
        <ScrollArea className="flex-1">
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rowsLoading ? (
              <div className="col-span-full text-center text-muted-foreground text-sm p-8">Loading...</div>
            ) : sortedRows.length === 0 ? (
              <div className="col-span-full text-center text-muted-foreground text-sm p-8">No items.</div>
            ) : (
              sortedRows.map((row) => {
                const size = row.bar_size_mapped || row.bar_size || "";
                const shapeType = row.shape_code_mapped || row.shape_type || "";
                const weight = getWeight(size, row.total_length_mm, row.quantity);
                const activeDims = DIM_COLS.filter((d) => {
                  const key = `dim_${d.toLowerCase()}` as keyof typeof row;
                  return row[key] != null && row[key] !== 0;
                });

                return (
                  <div
                    key={row.id}
                    className="border border-border rounded-lg bg-card p-4 space-y-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-black text-foreground">{row.mark || "—"}</span>
                      <Badge variant="secondary" className="text-[10px] font-bold">{size}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Qty</span>
                        <span className="font-bold">{row.quantity ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Length</span>
                        <span className="font-bold text-primary">{row.total_length_mm ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px] uppercase tracking-wider">Weight</span>
                        <span className="font-bold">{weight || "—"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{row.dwg || "—"}</span>
                      <span>·</span>
                      <span>{row.grade_mapped || row.grade || "—"}</span>
                      {shapeType && (
                        <>
                          <span>·</span>
                          <Badge variant="outline" className="text-[9px] px-1">{shapeType}</Badge>
                        </>
                      )}
                    </div>
                    {activeDims.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {activeDims.map((d) => {
                          const key = `dim_${d.toLowerCase()}` as keyof typeof row;
                          return (
                            <span key={d} className="text-[10px] bg-muted rounded px-1.5 py-0.5">
                              {d}: {String(row[key])}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {row.customer && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {row.customer}{row.reference ? ` · ${row.reference}` : ""}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
