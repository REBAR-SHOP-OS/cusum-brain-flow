import { Badge } from "@/components/ui/badge";

const DIM_LEFT = ["A", "B", "C", "D", "E", "F"] as const;
const DIM_RIGHT = ["G", "H", "J", "K", "O", "R"] as const;

interface RebarTagCardProps {
  mark: string;
  size: string;
  grade: string;
  qty: number | null;
  length: number | null;
  weight: string;
  shapeType: string;
  dwg: string;
  item: number;
  customer: string;
  reference: string;
  address: string;
  dims: Record<string, number | null>;
}

export function RebarTagCard({
  mark, size, grade, qty, length, weight, shapeType,
  dwg, item, customer, reference, address, dims,
}: RebarTagCardProps) {
  return (
    <div className="border-2 border-border rounded-lg bg-card overflow-hidden font-mono text-foreground print:break-inside-avoid">
      {/* === TOP HEADER ROW === */}
      <div className="grid grid-cols-5 border-b-2 border-border">
        <div className="border-r border-border px-3 py-2 text-center">
          <div className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">Mark</div>
          <div className="text-base font-black">{mark || "—"}</div>
        </div>
        <div className="border-r border-border px-3 py-2 text-center">
          <div className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">Size</div>
          <div className="text-base font-black text-primary">{size || "—"}</div>
        </div>
        <div className="border-r border-border px-3 py-2 text-center">
          <div className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">Grade</div>
          <div className="text-base font-black">{grade || "—"}</div>
        </div>
        <div className="border-r border-border px-3 py-2 text-center">
          <div className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">Qty</div>
          <div className="text-base font-black">{qty ?? "—"}</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">Length</div>
          <div className="text-base font-black">{length ?? "—"}</div>
        </div>
      </div>

      {/* === MAIN BODY === */}
      <div className="grid grid-cols-[1fr_1.4fr_1fr] min-h-[160px]">
        {/* LEFT: summary fields */}
        <div className="border-r border-border px-3 py-2 space-y-0.5 text-[11px]">
          <div className="flex justify-between"><span className="text-muted-foreground font-bold">Qty:</span><span className="font-black">{qty ?? ""}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground font-bold">Size:</span><span className="font-black">{size}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground font-bold">Grd:</span><span className="font-black">{grade}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground font-bold">Length:</span><span className="font-black">{length ?? ""}</span></div>
          <div className="border-t border-border/60 my-1" />
          <div className="flex justify-between"><span className="text-muted-foreground font-bold">Mark:</span><span className="font-black">{mark}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground font-bold">Bndl:</span><span className="font-black"></span></div>
          <div className="flex justify-between"><span className="text-muted-foreground font-bold">KG:</span><span className="font-black">{weight}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground font-bold">Item:</span><span className="font-black">{item}</span></div>
        </div>

        {/* CENTER: dimensions A-R */}
        <div className="border-r border-border px-3 py-2">
          {/* Shape code badge */}
          {shapeType && (
            <div className="flex justify-center mb-2">
              <div className="w-9 h-9 rounded-full border-2 border-foreground flex items-center justify-center">
                <span className="text-sm font-black">{shapeType}</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-0 text-[11px]">
            {DIM_LEFT.map((d) => (
              <div key={d} className="flex items-center gap-1.5">
                <span className="font-bold text-muted-foreground w-3">{d}:</span>
                <span className="font-black">{dims[d] || ""}</span>
              </div>
            ))}
            {DIM_RIGHT.map((d, i) => (
              <div key={d} className="flex items-center gap-1.5" style={{ gridColumn: 2, gridRow: i + 1 }}>
                <span className="font-bold text-muted-foreground w-3">{d}:</span>
                <span className="font-black">{dims[d] || ""}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: shape diagram placeholder */}
        <div className="px-3 py-2 flex flex-col items-center justify-center">
          {shapeType ? (
            <>
              <div className="w-full h-12 border-b-2 border-foreground/40 mb-2" />
              <span className="text-2xl font-black text-muted-foreground/50">{shapeType}</span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground/40 italic">No shape</span>
          )}
        </div>
      </div>

      {/* === BOTTOM INFO ROW === */}
      <div className="grid grid-cols-[1.2fr_1fr_0.8fr] border-t-2 border-border text-[10px]">
        <div className="border-r border-border px-3 py-2 space-y-0.5">
          <div className="flex gap-2">
            <span className="text-muted-foreground font-bold">Ref:</span>
            <span className="font-black uppercase truncate">{reference || customer || "—"}</span>
          </div>
          {address && (
            <div className="text-muted-foreground truncate">{address}</div>
          )}
          <div className="flex gap-2">
            <span className="text-muted-foreground font-bold">Dwg:</span>
            <span className="font-black">{dwg || "—"}</span>
          </div>
        </div>
        <div className="border-r border-border px-3 py-2 space-y-0.5">
          <div className="flex justify-between"><span className="text-muted-foreground font-bold">Bndl:</span><span></span></div>
          <div className="flex justify-between"><span className="text-muted-foreground font-bold">KG:</span><span className="font-black">{weight}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground font-bold">Item:</span><span className="font-black">{item}</span></div>
        </div>
        <div className="px-3 py-2 space-y-0.5">
          <div className="flex gap-1"><span className="text-muted-foreground font-bold">Job:</span></div>
          <div className="flex gap-1"><span className="text-muted-foreground font-bold">Dwg:</span><span className="font-black">{dwg || "—"}</span></div>
        </div>
      </div>

      {/* === FOOTER === */}
      <div className="border-t-2 border-border px-3 py-1.5 flex items-center justify-between bg-muted/30">
        <span className="text-sm font-black tracking-wider">R.S</span>
        <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">REBAR.SHOP</span>
        <div className="flex gap-[1px]">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="bg-foreground/70"
              style={{ width: i % 3 === 0 ? 2 : 1, height: 18 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
