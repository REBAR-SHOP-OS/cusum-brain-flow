// @vitest-environment node
/**
 * REGRESSION: PDF rebar schedules must map cells to columns by HEADER
 * X-position, not by guessed reading order. The original failure: dense
 * RebarCAD PDFs sent straight to a vision model put values from columns
 * E/F/G into A/B/C and shifted later dim values across the wrong letters.
 *
 * Also enforces: the "I" column is always skipped — H, J, K must keep
 * their values intact.
 *
 * Related:
 *  - mem://domain/rebar/dimension-standards
 *  - mem://features/office/import-unit-detection
 *  - supabase/functions/_shared/pdfTableExtractor.ts
 */
import { describe, it, expect } from "vitest";
import { __test__ } from "../../../supabase/functions/_shared/pdfTableExtractor.ts";

const { groupRows, detectHeader, rowToCells, cellToItem } = __test__;

// Synthesize PDF-like text items: { str, x, y, width }
// Y is the same per row (PDF user space), X grows left→right.
function mk(str: string, x: number, y: number, width = 10) {
  return { str, x, y, width };
}

describe("pdf table extractor: header-anchored column mapping", () => {
  it("maps cells under their column headers and never shifts past the skipped I", () => {
    // Header row at y=100 with the canonical schedule columns.
    // Column X positions are arbitrary but increasing; I is included so we
    // verify it is NOT treated as a dim column (rebar standard skips I).
    const headerY = 100;
    const headers = [
      mk("DWG",     0,  headerY),
      mk("#",       40, headerY),
      mk("GRADE",   60, headerY),
      mk("MARK",    100,headerY),
      mk("QTY",     150,headerY),
      mk("SIZE",    180,headerY),
      mk("TYPE",    220,headerY),
      mk("LENGTH",  260,headerY),
      mk("A",       310,headerY),
      mk("B",       340,headerY),
      mk("C",       370,headerY),
      mk("D",       400,headerY),
      mk("E",       430,headerY),
      mk("F",       460,headerY),
      mk("G",       490,headerY),
      mk("H",       520,headerY),
      mk("I",       550,headerY), // present in header but must NOT become a dim cell
      mk("J",       580,headerY),
      mk("K",       610,headerY),
    ];

    // Data row at y=80 — straight bar: only LENGTH + A populated; later cols empty.
    const row1 = [
      mk("SD17",   0,  80),
      mk("9",      40, 80),
      mk("400W",   60, 80),
      mk("CS01",   100,80),
      mk("2",      150,80),
      mk("15M",    180,80),
      mk("STR",    220,80),
      mk(`35'-0"`, 260,80),
      mk(`35'-0"`, 310,80),
      mk(`35'-0"`, 340,80),
    ];

    // Data row at y=60 — bent bar that has values at H, J, K (skips I).
    // If the extractor accidentally consumes I, J/K would shift one column.
    const row2 = [
      mk("SD18",   0,  60),
      mk("6",      40, 60),
      mk("400W",   60, 60),
      mk("C1508",  100,60),
      mk("5",      150,60),
      mk("15M",    180,60),
      mk("2",      220,60),
      mk(`4'-9"`,  260,60),
      mk(`0'-10"`, 310,60),
      // skip B..G empty
      mk("99",     520,60), // H
      mk("88",     580,60), // J (NOT I)
      mk("77",     610,60), // K
    ];

    const rows = groupRows([...headers, ...row1, ...row2]);
    const hdr = detectHeader(rows);
    expect(hdr).not.toBeNull();
    const cols = hdr!.cols;
    // I must NOT be one of the mapped columns
    expect(cols.find((c) => c.key === "I")).toBeUndefined();

    // Row 1 — straight bar
    const r1 = cellToItem(rowToCells(rows[hdr!.headerIdx + 1], cols));
    expect(r1.mark).toBe("CS01");
    expect(r1.size).toBe("15M");
    expect(r1.quantity).toBe(2);
    expect(r1.total_length).toBe(`35'-0"`);
    expect(r1.A).toBe(`35'-0"`);
    expect(r1.B).toBe(`35'-0"`);
    expect(r1.C).toBeNull();
    expect(r1.E).toBeNull(); // crucial: E/F/G must stay empty
    expect(r1.F).toBeNull();
    expect(r1.G).toBeNull();

    // Row 2 — bent bar with H/J/K populated, I correctly skipped
    const r2 = cellToItem(rowToCells(rows[hdr!.headerIdx + 2], cols));
    expect(r2.mark).toBe("C1508");
    expect(r2.A).toBe(`0'-10"`);
    expect(r2.H).toBe("99");
    expect(r2.I).toBeNull();
    expect(r2.J).toBe("88");
    expect(r2.K).toBe("77");
  });
});
