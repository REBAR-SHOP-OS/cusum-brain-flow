import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useExtractRows } from "@/hooks/useExtractSessions";
import { useShapeSchematics } from "@/hooks/useShapeSchematics";
import logoCoin from "@/assets/logo-coin.png";

/* ── Weight calc ── */
const MASS_KG_PER_M: Record<string, number> = {
  "10M": 0.785, "15M": 1.570, "20M": 2.355, "25M": 3.925,
  "30M": 5.495, "35M": 7.850, "45M": 11.775, "55M": 19.625,
};
function getWeight(size: string | null, lengthMm: number | null, qty: number | null): string {
  if (!size || !lengthMm) return "";
  const mass = MASS_KG_PER_M[size.toUpperCase()] || 0;
  if (!mass) return "";
  return ((lengthMm / 1000) * mass * (qty || 1)).toFixed(2);
}

/* ── Unit formatting ── */
function fmtMmToFtIn(mm: number): string {
  const totalIn = mm / 25.4;
  const ft = Math.floor(totalIn / 12);
  const rawIn = totalIn % 12;
  const eighths = Math.round(rawIn * 8);
  const wholeIn = Math.floor(eighths / 8);
  const rem = eighths % 8;
  const frac: Record<number, string> = { 0: "", 1: "⅛", 2: "¼", 3: "⅜", 4: "½", 5: "⅝", 6: "¾", 7: "⅞" };
  const f = frac[rem] || "";
  if (ft === 0) return `${wholeIn}${f}"`;
  if (wholeIn === 0 && !f) return `${ft}'-0"`;
  return `${ft}'-${wholeIn}${f}"`;
}
function fmtVal(v: number | null, us: string): string {
  if (v == null || v === 0) return "—";
  return us === "imperial" ? fmtMmToFtIn(Math.round(v)) : String(Math.round(v));
}
function fmtDim(v: number | null | undefined, us: string): string {
  if (v == null || v === 0) return "";
  return us === "imperial" ? fmtMmToFtIn(Math.round(v)) : String(Math.round(v));
}

const DIM_LEFT = ["A", "B", "C", "D", "E", "F"] as const;
const DIM_RIGHT = ["G", "H", "J", "K", "O", "R"] as const;
const DIM_COLS = [...DIM_LEFT, ...DIM_RIGHT] as const;

/* ── Inline print-only tag ── */
function PrintTag({
  mark, size, grade, qty, length, weight, shapeType, dwg, item,
  customer, reference, address, dims, shapeImageUrl, us,
}: {
  mark: string; size: string; grade: string; qty: number | null;
  length: number | null; weight: string; shapeType: string;
  dwg: string; item: number; customer: string; reference: string;
  address: string; dims: Record<string, number | null>;
  shapeImageUrl?: string | null; us: string;
}) {
  const now = new Date();
  const ts = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="print-tag">
      {/* Timestamp */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 8px", fontSize: 9, fontWeight: 700, borderBottom: "1px solid #000" }}>
        <span>{ts}</span><span>REBAR SHOP OS</span>
      </div>

      {/* Mark / Size / Grade */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "2px solid #000" }}>
        {[["Mark", mark], ["Size", size], ["Grade", grade]].map(([label, val], i) => (
          <div key={label} style={{ textAlign: "center", padding: "8px 8px 6px", borderRight: i < 2 ? "2px solid #000" : "none" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1 }}>{val || "—"}</div>
          </div>
        ))}
      </div>

      {/* Qty / Length / Weight */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "2px solid #000" }}>
        <div style={{ textAlign: "center", padding: "8px 8px 6px", borderRight: "2px solid #000" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>Qty</div>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1 }}>{qty ?? "—"}</div>
        </div>
        <div style={{ textAlign: "center", padding: "8px 8px 6px", borderRight: "2px solid #000" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
            Length {us === "imperial" ? "(ft-in)" : "(mm)"}
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1 }}>{fmtVal(length, us)}</div>
        </div>
        <div style={{ textAlign: "center", padding: "8px 8px 6px" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>Weight</div>
          <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1 }}>{weight || "—"}</div>
        </div>
      </div>

      {/* Shape code + Dims */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", borderBottom: "2px solid #000" }}>
        <div style={{ borderRight: "2px solid #000", padding: "8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #000", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 900 }}>{shapeType || "S"}</span>
          </div>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>Shape</span>
        </div>
        <div style={{ padding: "6px 8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
          {DIM_LEFT.map((d) => (
            <div key={d} style={{ fontSize: 12, gridColumn: 1, display: "flex", gap: 4 }}>
              <span style={{ fontWeight: 700, width: 14 }}>{d}:</span>
              <span style={{ fontWeight: 900 }}>{fmtDim(dims[d], us)}</span>
            </div>
          ))}
          {DIM_RIGHT.map((d) => (
            <div key={d} style={{ fontSize: 12, gridColumn: 2, display: "flex", gap: 4 }}>
              <span style={{ fontWeight: 700, width: 14 }}>{d}:</span>
              <span style={{ fontWeight: 900 }}>{fmtDim(dims[d], us)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Shape image */}
      <div style={{ flex: 1, minHeight: 0, borderBottom: "2px solid #000", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px", background: "#fff" }}>
        {shapeImageUrl ? (
          <img src={shapeImageUrl} alt={`Shape ${shapeType}`} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", imageRendering: "pixelated" }} />
        ) : shapeType ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 96, height: 56, borderBottom: "2px solid rgba(0,0,0,0.3)", margin: "0 auto" }} />
            <span style={{ fontSize: 20, fontWeight: 900 }}>{shapeType}</span>
          </div>
        ) : (
          <span style={{ fontSize: 11, color: "rgba(0,0,0,0.3)", fontStyle: "italic" }}>No shape</span>
        )}
      </div>

      {/* Ref / Dwg / Item */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #000", fontSize: 12 }}>
        <div style={{ borderRight: "1px solid #000", padding: "6px 8px" }}>
          <div style={{ display: "flex", gap: 4 }}>
            <span style={{ fontWeight: 700 }}>Ref:</span>
            <span style={{ fontWeight: 900, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reference || customer || "—"}</span>
          </div>
          {address && <div style={{ fontSize: 9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{address}</div>}
        </div>
        <div style={{ padding: "6px 8px" }}>
          <div style={{ display: "flex", gap: 4 }}><span style={{ fontWeight: 700 }}>Dwg:</span><span style={{ fontWeight: 900 }}>{dwg || "—"}</span></div>
          <div style={{ display: "flex", gap: 4 }}><span style={{ fontWeight: 700 }}>Item:</span><span style={{ fontWeight: 900 }}>{item}</span></div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "6px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: 2 }}>R.S</span>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>REBAR.SHOP</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Print-only page — zero app layout
   ═══════════════════════════════════════════ */
export default function PrintTags() {
  const [params] = useSearchParams();
  const sessionId = params.get("sessionId");
  const unitSystem = params.get("unit") || "metric";
  const sortMode = params.get("sort") || "standard";

  const { rows, loading } = useExtractRows(sessionId);
  const { getShapeImageUrl } = useShapeSchematics();

  const sortedRows = useMemo(() => {
    if (sortMode === "standard") return rows;
    return [...rows].sort((a, b) => {
      const sA = a.bar_size_mapped || a.bar_size || "";
      const sB = b.bar_size_mapped || b.bar_size || "";
      if (sA !== sB) return sA.localeCompare(sB);
      return (a.total_length_mm || 0) - (b.total_length_mm || 0);
    });
  }, [rows, sortMode]);

  useEffect(() => {
    if (!loading && sortedRows.length > 0) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [loading, sortedRows.length]);

  if (!sessionId) return <div style={{ padding: 40, fontFamily: "monospace" }}>Missing sessionId parameter.</div>;
  if (loading) return <div style={{ padding: 40, fontFamily: "monospace" }}>Loading tags...</div>;

  return (
    <>
      {/* Scoped print styles — lives only in this route */}
      <style>{`
        @page { size: 4in 6in; margin: 0; }
        html, body, #root {
          display: block !important;
          width: 4in !important;
          height: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
          background: #fff !important;
        }
        .print-tags-page {
          width: 4in;
          margin: 0 auto;
          padding: 0;
          background: #fff;
          font-family: 'JetBrains Mono', 'Courier New', monospace;
          color: #000;
        }
        .print-tag {
          display: flex;
          flex-direction: column;
          width: 4in;
          height: 6in;
          margin: 0 auto;
          padding: 0;
          border: 2px solid #000;
          background: #fff;
          color: #000;
          box-sizing: border-box;
          overflow: hidden;
          page-break-after: always;
          break-after: page;
          page-break-inside: avoid;
        }
        .print-tag img {
          image-rendering: pixelated;
        }
        @media print {
          * { overflow: visible !important; }
          ::-webkit-scrollbar { display: none !important; }
          nav, header, aside, [data-sidebar], [role="navigation"] {
            display: none !important;
          }
          .print-tag {
            position: static !important;
            float: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
        @media screen {
          .print-tag { margin-bottom: 24px; border-radius: 4px; }
        }
      `}</style>

      <div className="print-tags-page">
        {sortedRows.map((row) => {
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
            <PrintTag
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
              us={unitSystem}
            />
          );
        })}
      </div>
    </>
  );
}
