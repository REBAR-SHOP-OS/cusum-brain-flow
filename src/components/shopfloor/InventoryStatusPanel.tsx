import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, ArrowDown, Recycle, Trash2, Layers } from "lucide-react";
import type { InventorySummary, Reservation, InventoryLot, ScrapRecord } from "@/hooks/useInventoryData";

interface InventoryStatusPanelProps {
  summary: InventorySummary;
  reservations: Reservation[];
  remnants: InventoryLot[];
  scrapRecords: ScrapRecord[];
  barCode?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  lot: "Yard Lot",
  remnant: "Remnant",
  floor: "Floor Stock",
  wip: "WIP (Cut Output)",
};

const SOURCE_COLORS: Record<string, string> = {
  lot: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  remnant: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  floor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  wip: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export function InventoryStatusPanel({
  summary,
  reservations,
  remnants,
  scrapRecords,
  barCode,
}: InventoryStatusPanelProps) {
  const activeReservations = reservations.filter(
    (r) => r.status === "reserved" || r.status === "partial"
  );

  return (
    <Card className="bg-muted/30 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs flex items-center gap-2 tracking-wider uppercase text-muted-foreground">
          <Package className="w-3.5 h-3.5" />
          Inventory Status {barCode && <Badge variant="outline" className="text-[10px] font-mono">{barCode}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats grid */}
        <div className="grid grid-cols-2 gap-2">
          <StatBlock
            icon={<Layers className="w-3.5 h-3.5 text-blue-400" />}
            label="Reserved"
            value={summary.totalReserved}
            accent="text-blue-400"
          />
          <StatBlock
            icon={<ArrowDown className="w-3.5 h-3.5 text-emerald-400" />}
            label="Consumed"
            value={summary.totalConsumed}
            accent="text-emerald-400"
          />
          <StatBlock
            icon={<Recycle className="w-3.5 h-3.5 text-amber-400" />}
            label="Remnants"
            value={summary.remnantsCreated}
            accent="text-amber-400"
          />
          <StatBlock
            icon={<Trash2 className="w-3.5 h-3.5 text-destructive" />}
            label="Scrap"
            value={summary.scrapRecorded}
            accent="text-destructive"
          />
        </div>

        {/* Reserved by source */}
        {Object.keys(summary.reservationsBySource).length > 0 && (
          <>
            <Separator className="opacity-30" />
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
                Reserved by Source
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(summary.reservationsBySource).map(([src, qty]) => (
                  <Badge
                    key={src}
                    variant="outline"
                    className={`text-[10px] font-mono ${SOURCE_COLORS[src] || ""}`}
                  >
                    {SOURCE_LABELS[src] || src}: {qty}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Active reservations */}
        {activeReservations.length > 0 && (
          <>
            <Separator className="opacity-30" />
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
                Active Reservations
              </p>
              <ScrollArea className="max-h-28">
                <div className="space-y-1">
                  {activeReservations.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between text-[11px] font-mono px-2 py-1 rounded bg-muted/50"
                    >
                      <span className="text-muted-foreground">
                        {SOURCE_LABELS[r.source_type] || r.source_type}
                      </span>
                      <span>
                        {r.qty_consumed}/{r.qty_reserved}
                        <span className="text-muted-foreground ml-1">
                          @ {r.stock_length_mm.toLocaleString()}mm
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </>
        )}

        {/* Remnants */}
        {remnants.length > 0 && (
          <>
            <Separator className="opacity-30" />
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
                Remnants (≥300mm)
              </p>
              <div className="flex flex-wrap gap-1">
                {remnants.slice(0, 8).map((rem) => (
                  <Badge
                    key={rem.id}
                    variant="outline"
                    className="text-[10px] font-mono bg-amber-500/10 text-amber-400 border-amber-500/20"
                  >
                    {rem.standard_length_mm.toLocaleString()}mm × {rem.qty_on_hand}
                  </Badge>
                ))}
                {remnants.length > 8 && (
                  <Badge variant="outline" className="text-[10px]">
                    +{remnants.length - 8} more
                  </Badge>
                )}
              </div>
            </div>
          </>
        )}

        {/* Scrap */}
        {scrapRecords.length > 0 && (
          <>
            <Separator className="opacity-30" />
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
                Recent Scrap (&lt;300mm)
              </p>
              <div className="flex flex-wrap gap-1">
                {scrapRecords.slice(0, 6).map((s) => (
                  <Badge
                    key={s.id}
                    variant="outline"
                    className="text-[10px] font-mono bg-destructive/10 text-destructive border-destructive/20"
                  >
                    {s.length_mm}mm × {s.qty}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatBlock({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/40 p-2">
      {icon}
      <div className="min-w-0">
        <p className={`text-base font-bold font-mono leading-none ${accent}`}>{value}</p>
        <p className="text-[9px] text-muted-foreground tracking-wider uppercase mt-0.5">{label}</p>
      </div>
    </div>
  );
}
