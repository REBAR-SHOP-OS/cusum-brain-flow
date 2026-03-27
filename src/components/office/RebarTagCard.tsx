const DIM_LEFT = ["A", "B", "C", "D", "E", "F"] as const;
const DIM_RIGHT = ["G", "H", "J", "K", "O", "R"] as const;

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
  bndl?: string;
  job?: string;
}

export function RebarTagCard({
  mark, size, grade, qty, length, weight, shapeType,
  dwg, item, customer, reference, address, dims, shapeImageUrl,
  unitSystem = "metric", bndl = "", job = "",
}: RebarTagCardProps) {
  const us = unitSystem;

  return (
    <div
      className="rebar-tag border-2 border-black bg-white text-black overflow-hidden font-mono flex flex-col print:break-inside-avoid print:page-break-inside-avoid print:break-after-page"
      style={{ width: "4in", minHeight: "auto", boxSizing: "border-box" }}
    >
      {/* === TOP HEADER: Mark / Size / Grade / Qty / Length === */}
      <div className="grid grid-cols-5 border-b-2 border-black shrink-0">
        <div className="border-r-2 border-black px-1 py-1.5 text-center">
          <div className="text-[8px] font-bold tracking-wider uppercase">Mark</div>
          <div className="text-lg font-black leading-tight truncate">{mark || "—"}</div>
        </div>
        <div className="border-r-2 border-black px-1 py-1.5 text-center">
          <div className="text-[8px] font-bold tracking-wider uppercase">Size</div>
          <div className="text-lg font-black leading-tight">{size || "—"}</div>
        </div>
        <div className="border-r-2 border-black px-1 py-1.5 text-center">
          <div className="text-[8px] font-bold tracking-wider uppercase">Grade</div>
          <div className="text-lg font-black leading-tight">{grade || "—"}</div>
        </div>
        <div className="border-r-2 border-black px-1 py-1.5 text-center">
          <div className="text-[8px] font-bold tracking-wider uppercase">Qty</div>
          <div className="text-lg font-black leading-tight">{qty ?? "—"}</div>
        </div>
        <div className="px-1 py-1.5 text-center">
          <div className="text-[8px] font-bold tracking-wider uppercase">
            Len {us === "imperial" ? "ft" : "mm"}
          </div>
          <div className="text-lg font-black leading-tight">{formatVal(length, us)}</div>
        </div>
      </div>

      {/* === MAIN BODY: Sidebar | Shape+Dims | Shape Image === */}
      <div className="grid border-b-2 border-black shrink-0" style={{ gridTemplateColumns: "80px 1fr 1fr" }}>
        {/* Left Sidebar — specs list */}
        <div className="border-r-2 border-black px-1.5 py-1 flex flex-col justify-center gap-0">
          {[
            { l: "Qty", v: qty != null ? String(qty) : "—" },
            { l: "Size", v: size || "—" },
            { l: "Grd", v: grade || "—" },
            { l: "Len", v: formatVal(length, us) },
            { l: "Mark", v: mark || "—" },
            { l: "Bndl", v: bndl || "—" },
            { l: "KG", v: weight || "—" },
            { l: "Item", v: String(item) },
          ].map((r) => (
            <div key={r.l} className="flex items-center gap-0.5 text-[9px] leading-tight">
              <span className="font-bold min-w-[28px]">{r.l}:</span>
              <span className="font-black truncate">{r.v}</span>
            </div>
          ))}
        </div>

        {/* Center — Shape circle + Dimensions */}
        <div className="border-r-2 border-black px-1.5 py-1 flex flex-col items-center gap-1">
          {/* Shape circle */}
          <div className="w-9 h-9 rounded-full border-2 border-black flex items-center justify-center">
            <span className="text-xs font-black leading-none">{shapeType || "S"}</span>
          </div>
          {/* Dims grid */}
          <div className="w-full grid grid-cols-2 gap-x-2 gap-y-0">
            {DIM_LEFT.map((d) => (
              <div key={d} className="flex items-center gap-0.5 text-[9px]" style={{ gridColumn: 1 }}>
                <span className="font-bold w-2.5">{d}:</span>
                <span className="font-black">{formatDimVal(dims[d], us)}</span>
              </div>
            ))}
            {DIM_RIGHT.map((d) => (
              <div key={d} className="flex items-center gap-0.5 text-[9px]" style={{ gridColumn: 2 }}>
                <span className="font-bold w-2.5">{d}:</span>
                <span className="font-black">{formatDimVal(dims[d], us)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right — Shape image */}
        <div className="flex items-center justify-center bg-white px-1 py-1 min-h-[100px]">
          {shapeImageUrl ? (
            <img
              src={shapeImageUrl}
              alt={`Shape ${shapeType}`}
              className="max-w-full max-h-full object-contain"
              style={{ imageRendering: "pixelated" }}
            />
          ) : shapeType ? (
            <div className="flex flex-col items-center justify-center gap-0.5 text-black/40">
              <div className="w-16 h-10 border-b-2 border-black/30" />
              <span className="text-base font-black">{shapeType}</span>
            </div>
          ) : (
            <span className="text-[9px] text-black/30 italic">No shape</span>
          )}
        </div>
      </div>

      {/* === BOTTOM INFO ROW === */}
      <div className="grid grid-cols-3 border-b border-black text-[9px] shrink-0">
        <div className="border-r border-black px-1.5 py-1 space-y-px">
          <div className="flex gap-0.5"><span className="font-bold">Ref:</span><span className="font-black truncate">{reference || customer || "—"}</span></div>
          {address && <div className="truncate">{address}</div>}
          {job && <div className="flex gap-0.5"><span className="font-bold">Job:</span><span className="font-black">{job}</span></div>}
        </div>
        <div className="border-r border-black px-1.5 py-1 space-y-px">
          <div className="flex gap-0.5"><span className="font-bold">Bndl:</span><span className="font-black">{bndl || "—"}</span></div>
          <div className="flex gap-0.5"><span className="font-bold">KG:</span><span className="font-black">{weight || "—"}</span></div>
          <div className="flex gap-0.5"><span className="font-bold">Item:</span><span className="font-black">{item}</span></div>
        </div>
        <div className="px-1.5 py-1 space-y-px">
          <div className="flex gap-0.5"><span className="font-bold">Dwg:</span><span className="font-black">{dwg || "—"}</span></div>
          {job && <div className="flex gap-0.5"><span className="font-bold">Job:</span><span className="font-black">{job}</span></div>}
        </div>
      </div>

      {/* === FOOTER: Logo | Brand | Barcode === */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center px-1.5 py-1 shrink-0">
        <span className="text-sm font-black tracking-wider">R.S</span>
        <span className="text-[9px] font-bold tracking-widest uppercase text-center">REBAR.SHOP</span>
        {/* Barcode placeholder — mark value in barcode-style font */}
        <div className="flex flex-col items-center">
          <div className="text-[7px] font-mono tracking-[0.25em] border border-black px-1" style={{ fontStretch: "condensed" }}>
            {mark ? `|||${mark.replace(/./g, (c) => c + "|")}||` : "||||||"}
          </div>
          <span className="text-[6px] font-bold mt-px">{mark || ""}</span>
        </div>
      </div>
    </div>
  );
}
