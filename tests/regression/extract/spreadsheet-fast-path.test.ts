import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const extractManifest = readFileSync(
  join(repoRoot, "supabase/functions/extract-manifest/index.ts"),
  "utf8",
);

describe("spreadsheet extraction fast path", () => {
  it("parses recognizable spreadsheet schedules deterministically before AI", () => {
    expect(extractManifest).toMatch(/function\s+extractRebarRowsFromWorkbook/);
    expect(extractManifest).toMatch(/const\s+deterministicSheet\s*=\s*extractRebarRowsFromWorkbook\(workbook,\s*manifestContext\)/);
    expect(extractManifest).toMatch(/deterministicSpreadsheetItems\s*=\s*deterministicSheet\.items/);
  });

  it("skips the AI branch when deterministic spreadsheet rows are available", () => {
    const payloadBranch = extractManifest.match(/if\s*\(deterministicSpreadsheetItems\)[\s\S]{0,1800}?\}\s*else if\s*\(deterministicPdfItems\)/);
    expect(payloadBranch, "deterministic spreadsheet payload branch missing").not.toBeNull();
    expect(payloadBranch![0]).toMatch(/_source:\s*"deterministic_spreadsheet"/);
    expect(payloadBranch![0]).not.toMatch(/callAI\(/);
  });

  it("only builds the CSV AI prompt when deterministic parsing fails", () => {
    const spreadsheetBranch = extractManifest.match(/if\s*\(isSpreadsheet\)[\s\S]{0,2200}?\}\s*else if\s*\(isImage \|\| isPdf\)/);
    expect(spreadsheetBranch, "spreadsheet branch missing").not.toBeNull();
    expect(spreadsheetBranch![0]).toMatch(/falling back to AI/);
    expect(spreadsheetBranch![0]).toMatch(/XLSX\.utils\.sheet_to_csv/);
    expect(spreadsheetBranch![0]).toMatch(/if\s*\(deterministicSheet\.items\.length > 0\)/);
  });

  it("saves extracted rows in larger batches with throttled progress writes", () => {
    expect(extractManifest).toMatch(/const\s+BATCH_SIZE\s*=\s*250/);
    expect(extractManifest).toMatch(/lastProgressPct/);
    expect(extractManifest).toMatch(/pct >= lastProgressPct \+ 5/);
  });
});
