const DIM_COLS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "O", "R"] as const;

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
  const now = new Date();
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // Build active dims in chunks of 4
  const activeDims = DIM_COLS.filter((d) => dims[d] != null && dims[d] !== 0);
  const dimChunks: string[][] = [];
  for (let i = 0; i < activeDims.length; i += 4) {
    const chunk = activeDims.slice(i, i + 4);
    dimChunks.push(chunk);
  }

  const lengthUnit = us === "imperial" ? "ft" : "mm";
  const weightLabel = weight ? `${weight} kg` : "—";

  return (
    <div
      className="rebar-tag border-2 border-black bg-white text-black overflow-hidden font-mono flex flex-col justify-between print:break-inside-avoid print:page-break-inside-avoid print:break-after-page"
      style={{ width: "4in", height: "6in", boxSizing: "border-box" }}
    >
      {/* === TIMESTAMP HEADER === */}
      <div className="flex justify-between items-center px-2 py-1 border-b-2 border-black text-[9px] font-bold shrink-0">
        <span>REBAR.SHOP OS</span>
        <span>{timestamp}</span>
      </div>

      {/* === 3-COL HEADER: MARK / SIZE / GRADE === */}
      <div className="grid grid-cols-3 border-b-2 border-black shrink-0">
        <div className="border-r-2 border-black px-2 py-1.5 text-center">
          <div className="text-[9px] font-bold tracking-wider uppercase">MARK</div>
          <div className="text-2xl font-black leading-tight truncate">{mark || "—"}</div>
        </div>
        <div className="border-r-2 border-black px-2 py-1.5 text-center">
          <div className="text-[9px] font-bold tracking-wider uppercase">SIZE</div>
          <div className="text-2xl font-black leading-tight">{size || "—"}</div>
        </div>
        <div className="px-2 py-1.5 text-center">
          <div className="text-[9px] font-bold tracking-wider uppercase">GRADE</div>
          <div className="text-2xl font-black leading-tight">{grade || "—"}</div>
        </div>
      </div>

      {/* === QTY + LENGTH ROW === */}
      <div className="grid grid-cols-2 border-b-2 border-black shrink-0">
        <div className="border-r-2 border-black px-2 py-1.5">
          <div className="text-[10px] font-bold uppercase">QTY:</div>
          <div className="text-xl font-black leading-tight">{qty ?? "—"}</div>
        </div>
        <div className="px-2 py-1.5">
          <div className="text-[10px] font-bold uppercase">LENGTH ({lengthUnit}):</div>
          <div className="text-xl font-black leading-tight">{formatVal(length, us)}</div>
        </div>
      </div>

      {/* === WEIGHT ROW === */}
      <div className="border-b-2 border-black px-2 py-1.5 shrink-0">
        <div className="text-[10px] font-bold uppercase">WEIGHT:</div>
        <div className="text-xl font-black leading-tight">{weightLabel}</div>
      </div>

      {/* === DIMS SECTION === */}
      <div className="border-b-2 border-black px-2 py-1.5 shrink-0">
        <div className="text-[10px] font-bold uppercase mb-0.5">DIMS:</div>
        {dimChunks.length > 0 ? (
          dimChunks.map((chunk, idx) => (
            <div key={idx} className="text-sm font-black leading-snug">
              {chunk.map((d) => `${d}:${formatVal(dims[d] ?? null, us)}`).join("  ")}
            </div>
          ))
        ) : (
          <div className="text-sm text-black/40 italic">—</div>
        )}
      </div>

      {/* === BARCODE AREA === */}
      <div className="border-b-2 border-black py-2 flex flex-col items-center shrink-0">
        <div
          className="text-[8px] font-mono tracking-[0.25em] border border-black px-2 py-0.5"
          style={{ fontStretch: "condensed" }}
        >
          {mark ? `|||${mark.replace(/./g, (c) => c + "|")}||` : "||||||"}
        </div>
        <span className="text-[9px] font-bold mt-0.5">{mark || ""}</span>
      </div>

      {/* === DWG / ITEM ROW === */}
      <div className="border-b border-black px-2 py-1 shrink-0">
        <div className="text-[11px] font-black">
          DWG: {dwg || "—"} &nbsp;&nbsp; ITEM: {item}
        </div>
      </div>

      {/* === REF ROW === */}
      <div className="border-b-2 border-black px-2 py-1 shrink-0">
        <div className="text-[11px] font-black">
          REF: {reference || customer || "—"}
        </div>
      </div>

      {/* === FOOTER === */}
      <div className="flex justify-between items-center px-2 py-1 text-[9px] font-bold shrink-0">
        <span>REBAR.SHOP OS</span>
        <span>{timestamp}</span>
      </div>
    </div>
  );
}
