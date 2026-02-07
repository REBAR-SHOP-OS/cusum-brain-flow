import { AsaShapeDiagram } from "@/components/shopfloor/AsaShapeDiagram";

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
  // Build dimension record for AsaShapeDiagram (needs Record<string, number>)
  const shapeDims: Record<string, number> = {};
  Object.entries(dims).forEach(([k, v]) => {
    if (v != null && v !== 0) shapeDims[k] = v;
  });

  return (
    <div className="rebar-tag border-2 border-foreground/80 bg-white text-black overflow-hidden font-mono print:break-inside-avoid print:page-break-inside-avoid">
      {/* === TOP HEADER ROW === */}
      <div className="grid grid-cols-5 border-b-2 border-foreground/80">
        <div className="border-r border-foreground/60 px-2 py-1.5 text-center">
          <div className="text-[8px] font-bold tracking-widest uppercase">Mark</div>
          <div className="text-sm font-black leading-tight">{mark || "—"}</div>
        </div>
        <div className="border-r border-foreground/60 px-2 py-1.5 text-center">
          <div className="text-[8px] font-bold tracking-widest uppercase">Size</div>
          <div className="text-sm font-black leading-tight">{size || "—"}</div>
        </div>
        <div className="border-r border-foreground/60 px-2 py-1.5 text-center">
          <div className="text-[8px] font-bold tracking-widest uppercase">Grade</div>
          <div className="text-sm font-black leading-tight">{grade || "—"}</div>
        </div>
        <div className="border-r border-foreground/60 px-2 py-1.5 text-center">
          <div className="text-[8px] font-bold tracking-widest uppercase">Qty</div>
          <div className="text-sm font-black leading-tight">{qty ?? "—"}</div>
        </div>
        <div className="px-2 py-1.5 text-center">
          <div className="text-[8px] font-bold tracking-widest uppercase">Length</div>
          <div className="text-sm font-black leading-tight">{length ?? "—"}</div>
        </div>
      </div>

      {/* === MAIN BODY === */}
      <div className="grid grid-cols-[100px_1fr_1fr]" style={{ minHeight: 140 }}>
        {/* LEFT: summary fields */}
        <div className="border-r border-foreground/60 px-2 py-1.5 text-[10px] space-y-px">
          <div className="flex justify-between"><span className="font-bold">Qty:</span><span className="font-black">{qty ?? ""}</span></div>
          <div className="flex justify-between"><span className="font-bold">Size:</span><span className="font-black">{size}</span></div>
          <div className="flex justify-between"><span className="font-bold">Grd:</span><span className="font-black">{grade}</span></div>
          <div className="flex justify-between"><span className="font-bold">Length:</span><span className="font-black">{length ?? ""}</span></div>
          <div className="border-t border-foreground/30 my-0.5" />
          <div className="flex justify-between"><span className="font-bold">Mark:</span><span className="font-black">{mark}</span></div>
          <div className="flex justify-between"><span className="font-bold">Bndl:</span><span className="font-black"></span></div>
          <div className="flex justify-between"><span className="font-bold">KG:</span><span className="font-black">{weight}</span></div>
          <div className="flex justify-between"><span className="font-bold">Item:</span><span className="font-black">{item}</span></div>
        </div>

        {/* CENTER: shape code circle + dimensions A-R */}
        <div className="border-r border-foreground/60 px-2 py-1.5">
          {/* Shape code badge */}
          <div className="flex justify-center mb-1">
            <div className="w-7 h-7 rounded-full border-2 border-black flex items-center justify-center">
              <span className="text-xs font-black">{shapeType || "S"}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0 text-[10px]">
            {DIM_LEFT.map((d, i) => (
              <div key={d} className="flex items-center gap-1" style={{ gridColumn: 1, gridRow: i + 1 }}>
                <span className="font-bold w-3">{d}:</span>
                <span className="font-black">{dims[d] || ""}</span>
              </div>
            ))}
            {DIM_RIGHT.map((d, i) => (
              <div key={d} className="flex items-center gap-1" style={{ gridColumn: 2, gridRow: i + 1 }}>
                <span className="font-bold w-3">{d}:</span>
                <span className="font-black">{dims[d] || ""}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: ASA shape diagram */}
        <div className="px-1 py-1 flex flex-col items-center justify-center">
          {shapeType ? (
            <AsaShapeDiagram
              shapeCode={shapeType}
              dimensions={Object.keys(shapeDims).length > 0 ? shapeDims : undefined}
              size="sm"
              className="print:brightness-0"
            />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="w-full h-8 border-b-2 border-black/40" />
              <span className="text-lg font-black text-black/30">A</span>
            </div>
          )}
        </div>
      </div>

      {/* === BOTTOM INFO ROW === */}
      <div className="grid grid-cols-[1.3fr_0.8fr_0.7fr] border-t-2 border-foreground/80 text-[9px]">
        <div className="border-r border-foreground/60 px-2 py-1 space-y-px">
          <div className="flex gap-1">
            <span className="font-bold">Ref:</span>
            <span className="font-black uppercase truncate">{reference || customer || "—"}</span>
          </div>
          {address && <div className="text-[8px] truncate">{address}</div>}
          <div className="flex gap-1">
            <span className="font-bold">Dwg:</span>
            <span className="font-black">{dwg || "—"}</span>
          </div>
        </div>
        <div className="border-r border-foreground/60 px-2 py-1 space-y-px">
          <div className="flex justify-between"><span className="font-bold">Bndl:</span><span></span></div>
          <div className="flex justify-between"><span className="font-bold">KG:</span><span className="font-black">{weight}</span></div>
          <div className="flex justify-between"><span className="font-bold">Item:</span><span className="font-black">{item}</span></div>
        </div>
        <div className="px-2 py-1 space-y-px">
          <div className="flex gap-1"><span className="font-bold">Job:</span></div>
          <div className="flex gap-1"><span className="font-bold">Dwg:</span><span className="font-black">{dwg || "—"}</span></div>
        </div>
      </div>

      {/* === FOOTER === */}
      <div className="border-t-2 border-foreground/80 px-2 py-1 flex items-center justify-between">
        <span className="text-xs font-black tracking-wider">R.S</span>
        <span className="text-[8px] font-bold tracking-widest uppercase">REBAR.SHOP</span>
        {/* Barcode placeholder */}
        <div className="flex gap-[1px]">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="bg-black"
              style={{ width: i % 3 === 0 ? 2 : 1, height: 16 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
