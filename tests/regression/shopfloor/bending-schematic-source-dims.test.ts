// Regression: BendingSchematic must render the raw source string (e.g. 3'-9")
// from source_dims when provided, so the bender station matches the printed tag.
// Falls back to numeric inches + unit label only when sourceDims is missing.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../../src/components/shopfloor/BendingSchematic.tsx"),
  "utf8",
);

describe("BendingSchematic source-dim passthrough", () => {
  it("declares the sourceDims prop", () => {
    expect(src).toMatch(/sourceDims\?\s*:\s*Record<string,\s*string>\s*\|\s*null/);
  });

  it("prefers raw source string when present and suppresses unit suffix", () => {
    // raw value used verbatim
    expect(src).toMatch(/hasRaw\s*\?\s*raw\s*:\s*value/);
    // unit label only when no raw string
    expect(src).toMatch(/!hasRaw\s*&&\s*unitLabel/);
  });
});

describe("useStationData passes source_dims_json through", () => {
  const hookSrc = readFileSync(
    resolve(__dirname, "../../../src/hooks/useStationData.ts"),
    "utf8",
  );
  it("maps source_dims_json -> source_dims in both bender and cutter branches", () => {
    const matches = hookSrc.match(/source_dims:\s*\(\(item as any\)\.source_dims_json/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("BenderStationView wires sourceDims into BendingSchematic", () => {
  const viewSrc = readFileSync(
    resolve(__dirname, "../../../src/components/shopfloor/BenderStationView.tsx"),
    "utf8",
  );
  it("passes sourceDims={currentItem.source_dims}", () => {
    expect(viewSrc).toMatch(/<BendingSchematic[^>]*sourceDims=\{currentItem\.source_dims\}/);
  });
});
