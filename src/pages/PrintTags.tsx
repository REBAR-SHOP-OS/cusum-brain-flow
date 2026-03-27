import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useExtractRows } from "@/hooks/useExtractSessions";
import { useShapeSchematics } from "@/hooks/useShapeSchematics";
import { RebarTagCard } from "@/components/office/RebarTagCard";

const MASS_KG_PER_M: Record<string, number> = {
  "10M": 0.785, "15M": 1.570, "20M": 2.355, "25M": 3.925,
  "30M": 5.495, "35M": 7.850, "45M": 11.775, "55M": 19.625,
};

const DIM_COLS = ["A","B","C","D","E","F","G","H","J","K","O","R"] as const;

function getWeight(size: string | null, lengthMm: number | null, qty: number | null): string {
  if (!size || !lengthMm) return "";
  const mass = MASS_KG_PER_M[size.toUpperCase()] || 0;
  if (!mass) return "";
  return ((lengthMm / 1000) * mass * (qty || 1)).toFixed(2);
}

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
      const sizeA = a.bar_size_mapped || a.bar_size || "";
      const sizeB = b.bar_size_mapped || b.bar_size || "";
      if (sizeA !== sizeB) return sizeA.localeCompare(sizeB);
      return (a.total_length_mm || 0) - (b.total_length_mm || 0);
    });
  }, [rows, sortMode]);

  // Auto-print once loaded
  useEffect(() => {
    if (!loading && sortedRows.length > 0) {
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [loading, sortedRows.length]);

  if (!sessionId) {
    return <div style={{ padding: 40, fontFamily: "monospace" }}>Missing sessionId parameter.</div>;
  }

  if (loading) {
    return <div style={{ padding: 40, fontFamily: "monospace" }}>Loading tags...</div>;
  }

  return (
    <div
      style={{
        width: "4in",
        margin: "0 auto",
        padding: 0,
        background: "#fff",
      }}
    >
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
            address={row.address || ""}
            dims={dims}
            shapeImageUrl={getShapeImageUrl(shapeType)}
            unitSystem={unitSystem}
          />
        );
      })}
    </div>
  );
}
