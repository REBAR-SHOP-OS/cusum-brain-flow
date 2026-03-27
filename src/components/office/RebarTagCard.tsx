import logoCoin from "@/assets/logo-coin.png";

export const DIM_LEFT = ["A", "B", "C", "D", "E", "F"] as const;
export const DIM_RIGHT = ["G", "H", "J", "K", "O", "R"] as const;
export const DIM_COLS = [...DIM_LEFT, ...DIM_RIGHT] as const;

export const MASS_KG_PER_M: Record<string, number> = {
  "10M": 0.785, "15M": 1.570, "20M": 2.355, "25M": 3.925,
  "30M": 5.495, "35M": 7.850, "45M": 11.775, "55M": 19.625,
};
export function getWeight(size: string | null, lengthMm: number | null, qty: number | null): string {
  if (!size || !lengthMm) return "";
  const mass = MASS_KG_PER_M[size.toUpperCase()] || 0;
  if (!mass) return "";
  return ((lengthMm / 1000) * mass * (qty || 1)).toFixed(2);
}

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

function formatDim(val: number | null | undefined, unitSystem: string): string {
  if (val == null || val === 0) return "";
  return unitSystem === "imperial" ? formatMmToFtIn(Math.round(val)) : String(Math.round(val));
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
  bndl?: string;
  job?: string;
}

export function RebarTagCard({
  mark, size, grade, qty, length, weight, shapeType,
  dwg, item, customer, reference, address, dims, shapeImageUrl,
  unitSystem = "metric",
}: RebarTagCardProps) {
  const us = unitSystem;
  const now = new Date();
  const ts = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div
      className="rebar-tag border-2 border-black bg-white text-black overflow-hidden font-mono flex flex-col print:break-inside-avoid print:page-break-inside-avoid print:break-after-page"
      style={{ width: "4in", height: "6in", boxSizing: "border-box" }}
    >
      {/* Timestamp */}
      <div className="flex justify-between items-center px-2 py-0.5 border-b border-black text-[9px] font-bold shrink-0">
        <span>{ts}</span>
        <span>REBAR SHOP OS</span>
      </div>

      {/* Mark / Size / Grade */}
      <div className="grid grid-cols-3 border-b-2 border-black shrink-0">
        {[["Mark", mark], ["Size", size], ["Grade", grade]].map(([label, val], i) => (
          <div key={label} className={`text-center py-2 px-2 ${i < 2 ? "border-r-2 border-black" : ""}`}>
            <div className="text-[9px] font-bold tracking-widest uppercase">{label}</div>
            <div className="text-[22px] font-black leading-tight">{val || "—"}</div>
          </div>
        ))}
      </div>

      {/* Qty / Length / Weight */}
      <div className="grid grid-cols-3 border-b-2 border-black shrink-0">
        <div className="text-center py-2 px-2 border-r-2 border-black">
          <div className="text-[9px] font-bold tracking-widest uppercase">Qty</div>
          <div className="text-[22px] font-black leading-tight">{qty ?? "—"}</div>
        </div>
        <div className="text-center py-2 px-2 border-r-2 border-black">
          <div className="text-[9px] font-bold tracking-widest uppercase">
            Length {us === "imperial" ? "(ft-in)" : "(mm)"}
          </div>
          <div className="text-[22px] font-black leading-tight">{formatVal(length, us)}</div>
        </div>
        <div className="text-center py-2 px-2">
          <div className="text-[9px] font-bold tracking-widest uppercase">Weight</div>
          <div className="text-[18px] font-black leading-tight">{weight || "—"}</div>
        </div>
      </div>

      {/* Logo + Dims */}
      <div className="grid shrink-0 border-b-2 border-black" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
        {/* Brand logo */}
        <div className="border-r-2 border-black p-2 flex flex-col items-center justify-center">
          <img src={logoCoin} alt="Brand logo" className="w-16 h-16 object-contain" />
        </div>
        {/* Dims grid — parallel columns */}
        <div className="p-1.5" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "repeat(6, auto)", gap: "0 0.75rem" }}>
          {DIM_LEFT.map((d, i) => (
            <div key={d} className="text-xs flex gap-1" style={{ gridRow: i + 1, gridColumn: 1 }}>
              <span className="font-bold w-3.5">{d}:</span>
              <span className="font-black">{formatDim(dims[d], us)}</span>
            </div>
          ))}
          {DIM_RIGHT.map((d, i) => (
            <div key={d} className="text-xs flex gap-1" style={{ gridRow: i + 1, gridColumn: 2 }}>
              <span className="font-bold w-3.5">{d}:</span>
              <span className="font-black">{formatDim(dims[d], us)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shape image + Dwg/Item */}
      <div className="flex-1 min-h-0 border-b-2 border-black flex flex-col items-center justify-center p-2 bg-white">
        <div className="flex-1 min-h-0 flex items-center justify-center w-full">
          {shapeImageUrl ? (
            <img
              src={shapeImageUrl}
              alt={`Shape ${shapeType}`}
              className="max-w-full max-h-full object-contain"
              style={{ imageRendering: "pixelated" }}
            />
          ) : shapeType ? (
            <div className="text-center">
              <div className="w-24 h-14 border-b-2 border-black/30 mx-auto" />
              <span className="text-xl font-black">{shapeType}</span>
            </div>
          ) : (
            <span className="text-[11px] text-black/30 italic">No shape</span>
          )}
        </div>
        <div className="flex gap-4 text-xs shrink-0 mt-1">
          <div className="flex gap-1"><span className="font-bold">Weight:</span><span className="font-black">{weight || "—"}</span></div>
          <div className="flex gap-1"><span className="font-bold">Item:</span><span className="font-black">{item}</span></div>
        </div>
      </div>

      {/* Ref — full width */}
      <div className="border-b border-black text-xs shrink-0 px-2 py-2 min-h-[3.5rem]">
        <div className="flex gap-1">
          <span className="font-bold">Ref:</span>
          <span className="font-black uppercase">{reference || customer || "—"}</span>
        </div>
        {address && <div className="text-[9px] leading-tight mt-0.5">{address}</div>}
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center px-2 py-1.5 shrink-0">
        <span className="text-sm font-black tracking-widest">R.S</span>
        <span className="text-[9px] font-bold tracking-[3px] uppercase">REBAR.SHOP</span>
      </div>
    </div>
  );
}