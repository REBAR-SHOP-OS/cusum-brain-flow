import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useExtractRows } from "@/hooks/useExtractSessions";
import { useShapeSchematics } from "@/hooks/useShapeSchematics";
import { RebarTagCard, DIM_COLS, getWeight } from "@/components/office/RebarTagCard";
import { supabase } from "@/integrations/supabase/client";
import { sessionUnitToDisplay } from "@/lib/unitSystem";

/* ═══════════════════════════════════════════
   Print-only page — zero app layout
   ═══════════════════════════════════════════ */
export default function PrintTags() {
  const [params] = useSearchParams();
  const sessionId = params.get("sessionId");
  const unitSystem = sessionUnitToDisplay(params.get("unit"));
  const sortMode = params.get("sort") || "standard";

  const { rows, loading } = useExtractRows(sessionId);
  const { getShapeImageUrl } = useShapeSchematics();
  const [sessionAddress, setSessionAddress] = useState("");
  const [projectAddress, setProjectAddress] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    supabase.from("extract_sessions").select("site_address").eq("id", sessionId).maybeSingle()
      .then(({ data }) => { if (data?.site_address) setSessionAddress(data.site_address); });
    // Fallback: get project address via barlist link
    supabase.from("barlists").select("project:projects(site_address)")
      .eq("extract_session_id", sessionId).limit(1).maybeSingle()
      .then(({ data }) => {
        const addr = (data as any)?.project?.site_address;
        if (addr) setProjectAddress(addr);
      });
  }, [sessionId]);

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
        .rebar-tag {
          page-break-after: always;
          break-after: page;
          page-break-inside: avoid;
        }
        .rebar-tag img {
          image-rendering: pixelated;
        }
        @media print {
          * { overflow: visible !important; }
          ::-webkit-scrollbar { display: none !important; }
          nav, header, aside, [data-sidebar], [role="navigation"] {
            display: none !important;
          }
          .rebar-tag {
            position: static !important;
            float: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
        }
        @media screen {
          .rebar-tag { margin-bottom: 24px; border-radius: 4px; }
        }
      `}</style>

      <div className="print-tags-page">
        {sortedRows.map((row) => {
          const size = row.bar_size_mapped || row.bar_size || "";
          const shapeType = row.shape_code_mapped || row.shape_type || "STRAIGHT";
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
              address={row.address || sessionAddress || projectAddress || ""}
              dims={dims}
              shapeImageUrl={getShapeImageUrl(shapeType)}
              unitSystem={unitSystem}
            />
          );
        })}
      </div>
    </>
  );
}
