const DIM_LEFT = ["A", "B", "C", "D", "E", "F"] as const;
const DIM_RIGHT = ["G", "H", "J", "K", "O", "R"] as const;

/** Format mm value to ft-in string */
function formatMmToFtIn(mm: number): string {
  const totalInches = mm / 25.4;
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

function formatVal(val: number | null, unitSystem: string): string {
  if (val == null || val === 0) return "—";
  const rounded = Math.round(val);
  if (unitSystem === "imperial") return formatMmToFtIn(rounded);
  return String(rounded);
}

function formatDimVal(val: number | null | undefined, unitSystem: string): string {
  if (val == null || val === 0) return "";
  const rounded = Math.round(val);
  if (unitSystem === "imperial") return formatMmToFtIn(rounded);
  return String(rounded);
}

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
  shapeImageUrl?: string | null;
  unitSystem?: string;
}

export function RebarTagCard({
  mark, size, grade, qty, length, weight, shapeType,
  dwg, item, customer, reference, address, dims, shapeImageUrl,
  unitSystem = "metric",
}: RebarTagCardProps) {
  const us = unitSystem;

  return (
    <div
      className="rebar-tag border-2 border-black bg-white text-black overflow-hidden font-mono flex flex-col print:break-inside-avoid print:page-break-inside-avoid print:break-after-page"
      style={{ width: "4in", minHeight: "auto", boxSizing: "border-box" }}
    >
      {/* === TIMESTAMP === */}
      <div className="px-2 py-0.5 text-[9px] font-bold border-b border-black flex justify-between shrink-0">
        <span>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span>REBAR SHOP OS</span>
      </div>

      {/* === TOP HEADER: Mark / Size / Grade === */}
      <div className="grid grid-cols-3 border-b-2 border-black shrink-0">
        <div className="border-r-2 border-black px-2 py-2 text-center">
          <div className="text-[9px] font-bold tracking-widest uppercase">Mark</div>
          <div className="text-2xl font-black leading-tight">{mark || "—"}</div>
        </div>
        <div className="border-r-2 border-black px-2 py-2 text-center">
          <div className="text-[9px] font-bold tracking-widest uppercase">Size</div>
          <div className="text-2xl font-black leading-tight">{size || "—"}</div>
        </div>
        <div className="px-2 py-2 text-center">
          <div className="text-[9px] font-bold tracking-widest uppercase">Grade</div>
          <div className="text-2xl font-black leading-tight">{grade || "—"}</div>
        </div>
      </div>

      {/* === SECOND ROW: Qty / Length / Weight === */}
      <div className="grid grid-cols-3 border-b-2 border-black shrink-0">
        <div className="border-r-2 border-black px-2 py-2 text-center">
          <div className="text-[9px] font-bold tracking-widest uppercase">Qty</div>
          <div className="text-2xl font-black leading-tight">{qty ?? "—"}</div>
        </div>
        <div className="border-r-2 border-black px-2 py-2 text-center">
          <div className="text-[9px] font-bold tracking-widest uppercase">
            Length {us === "imperial" ? "(ft-in)" : "(mm)"}
          </div>
          <div className="text-2xl font-black leading-tight">{formatVal(length, us)}</div>
        </div>
        <div className="px-2 py-2 text-center">
          <div className="text-[9px] font-bold tracking-widest uppercase">Weight</div>
          <div className="text-lg font-black leading-tight">{weight || "—"}</div>
        </div>
      </div>

      {/* === DIMENSIONS + SHAPE CODE === */}
      <div className="grid grid-cols-[1fr_1.4fr] border-b-2 border-black shrink-0">
        {/* Shape code circle */}
        <div className="border-r-2 border-black px-2 py-2 flex flex-col items-center justify-center">
          <div className="w-10 h-10 rounded-full border-2 border-black flex items-center justify-center mb-1">
            <span className="text-sm font-black leading-none">{shapeType || "S"}</span>
          </div>
          <span className="text-[9px] font-bold uppercase">Shape</span>
        </div>
        {/* Dimensions A–R */}
        <div className="px-2 py-1.5 grid grid-cols-2 gap-x-3 gap-y-0">
          {DIM_LEFT.map((d) => (
            <div key={d} className="flex items-center gap-1 text-xs" style={{ gridColumn: 1 }}>
              <span className="font-bold w-3">{d}:</span>
              <span className="font-black">{formatDimVal(dims[d], us)}</span>
            </div>
          ))}
          {DIM_RIGHT.map((d) => (
            <div key={d} className="flex items-center gap-1 text-xs" style={{ gridColumn: 2 }}>
              <span className="font-bold w-3">{d}:</span>
              <span className="font-black">{formatDimVal(dims[d], us)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* === SHAPE IMAGE (full width, flex-1 to fill remaining space) === */}
      <div className="flex-1 min-h-0 border-b-2 border-black flex items-center justify-center bg-white px-2 py-2">
        {shapeImageUrl ? (
          <img
            src={shapeImageUrl}
            alt={`Shape ${shapeType}`}
            className="max-w-full max-h-full object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        ) : shapeType ? (
          <div className="flex flex-col items-center justify-center gap-1 text-black/40">
            <div className="w-24 h-14 border-b-2 border-black/30" />
            <span className="text-xl font-black">{shapeType}</span>
          </div>
        ) : (
          <span className="text-xs text-black/30 italic">No shape</span>
        )}
      </div>

      {/* === INFO ROW: Ref / Dwg / Item === */}
      <div className="grid grid-cols-2 border-b border-black text-xs shrink-0">
        <div className="border-r border-black px-2 py-1.5 space-y-px">
          <div className="flex gap-1">
            <span className="font-bold">Ref:</span>
            <span className="font-black uppercase truncate">{reference || customer || "—"}</span>
          </div>
          {address && <div className="text-[9px] truncate">{address}</div>}
        </div>
        <div className="px-2 py-1.5 space-y-px">
          <div className="flex gap-1">
            <span className="font-bold">Dwg:</span>
            <span className="font-black">{dwg || "—"}</span>
          </div>
          <div className="flex gap-1">
            <span className="font-bold">Item:</span>
            <span className="font-black">{item}</span>
          </div>
        </div>
      </div>

      {/* === FOOTER === */}
      <div className="px-2 py-1.5 flex items-center justify-between shrink-0">
        <span className="text-sm font-black tracking-wider">R.S</span>
        <span className="text-[9px] font-bold tracking-widest uppercase">REBAR.SHOP</span>
      </div>
    </div>
  );
}
