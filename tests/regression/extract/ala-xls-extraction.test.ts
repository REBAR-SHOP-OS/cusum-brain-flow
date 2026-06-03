// @vitest-environment node
/**
 * REGRESSION: AI Extract / `01-ALA.xls` (RebarCAD bar list)
 *
 * The original bug looked like Ai Extract was stuck on /office, but the real
 * root causes were:
 *
 *   1. Duplicate row insert collisions on
 *      `extract_rows_session_row_unique` whenever the client retried
 *      extract-manifest (extractService runs with `retries: 1`).
 *   2. The stale-row DELETE that runs before insert was swallowed instead
 *      of being treated as fatal, so a partial cleanup would feed straight
 *      into the unique-key violation above.
 *   3. The `useExtractRows` hook's polling/refresh could race and overwrite
 *      already-loaded rows with an empty result, leaving the UI stuck on
 *      "Loading extracted rows…" forever.
 *
 * These tests pin the fix so the bug cannot silently come back.
 *
 * Related:
 *  - mem://rules/bugfix-definition-of-done
 *  - .lovable/plan.md (root cause analysis for ALA.xls)
 *  - supabase/functions/extract-manifest/index.ts
 *  - src/hooks/useExtractSessions.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";

const ROOT = resolve(__dirname, "../../..");
const EDGE_FN = readFileSync(
  resolve(ROOT, "supabase/functions/extract-manifest/index.ts"),
  "utf8",
);
const HOOK = readFileSync(
  resolve(ROOT, "src/hooks/useExtractSessions.ts"),
  "utf8",
);
const FIXTURE = resolve(__dirname, "fixtures/01-ALA.xls");

// ─── Fixture sanity ────────────────────────────────────────────────────────
// The fixture must be the real RebarCAD-shaped bar list so the row count
// the user reported (68) is meaningful. If someone replaces it with a
// different file the test fails loudly.
describe("01-ALA.xls fixture is the original RebarCAD bar list", () => {
  it("ships the .xls fixture in the regression tree", () => {
    expect(existsSync(FIXTURE)).toBe(true);
  });

  it("parses as an .xls workbook with a RebarCAD schedule header", () => {
    const wb = XLSX.readFile(FIXTURE);
    expect(wb.SheetNames.length).toBeGreaterThan(0);
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(
      wb.Sheets[wb.SheetNames[0]],
      { header: 1, defval: null },
    );
    const hdrIdx = aoa.findIndex((r) =>
      (r as unknown[]).some((c) => String(c ?? "").trim().toLowerCase() === "mark")
    );
    expect(hdrIdx).toBeGreaterThanOrEqual(0);
    const hdr = (aoa[hdrIdx] as unknown[]).map((c) =>
      String(c ?? "").trim().toLowerCase()
    );
    // RebarCAD canonical header tokens
    for (const tok of ["item", "size", "length", "mark", "type", "a", "b"]) {
      expect(hdr).toContain(tok);
    }
  });

  it("contains exactly 68 valid bar-list rows", () => {
    const wb = XLSX.readFile(FIXTURE);
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(
      wb.Sheets[wb.SheetNames[0]],
      { header: 1, defval: null },
    );
    const hdrIdx = aoa.findIndex((r) =>
      (r as unknown[]).some((c) => String(c ?? "").trim().toLowerCase() === "mark")
    );
    // A valid bar-list row has a numeric Item (col 0) and a non-empty Mark (col 7).
    let count = 0;
    for (let i = hdrIdx + 1; i < aoa.length; i++) {
      const r = (aoa[i] ?? []) as unknown[];
      const item = r[0];
      const mark = r[7];
      if (typeof item === "number" && mark != null && String(mark).trim() !== "") {
        count++;
      }
    }
    expect(count).toBe(68);
  });
});

// ─── Edge function: duplicate-row safety on retry ─────────────────────────
describe("extract-manifest is idempotent on retry / re-upload", () => {
  it("upserts extract_rows on (session_id,row_index), never plain insert", () => {
    // A plain .insert(batch) on a retried run will collide on the unique
    // index. Force upsert with the correct conflict target.
    expect(EDGE_FN).not.toMatch(/from\(\s*["']extract_rows["']\s*\)\s*\.insert\(/);
    expect(EDGE_FN).toMatch(
      /from\(\s*["']extract_rows["']\s*\)\s*\.upsert\([^)]*onConflict:\s*["']session_id,row_index["']/,
    );
  });

  it("on upsert conflict, deletes the affected row_index range and retries once", () => {
    // The self-healing branch must exist: delete the batch's row_index
    // range, then re-upsert exactly once. Without this the user sees the
    // raw duplicate-key error and the session fails.
    const upsertBlock = EDGE_FN.match(
      /Upsert batch[\s\S]{0,1200}?retrying after targeted delete[\s\S]{0,2000}/,
    );
    expect(upsertBlock, "self-healing retry block missing").not.toBeNull();
    const block = upsertBlock![0];
    expect(block).toMatch(/\.delete\(\)/);
    expect(block).toMatch(/\.upsert\(batch,\s*\{\s*onConflict:\s*["']session_id,row_index["']/);
  });

  it("treats the pre-extract stale-row DELETE as fatal (no silent swallow)", () => {
    // The original bug: cleanup error was logged and execution continued,
    // which guaranteed the next upsert would hit the unique index. The
    // cleanup must throw, not warn-and-continue.
    const cleanup = EDGE_FN.match(
      /Clear any rows left over[\s\S]{0,800}/,
    );
    expect(cleanup, "pre-extract cleanup block missing").not.toBeNull();
    const block = cleanup![0];
    expect(block).toMatch(/from\(\s*["']extract_rows["']\s*\)\s*\.delete\(\)/);
    // Must throw on clearErr — not just console.error and move on.
    expect(block).toMatch(/throw new Error\([^)]*stale rows/i);
  });
});

// ─── DB-level safety net ──────────────────────────────────────────────────
describe("DB unique index backs the upsert", () => {
  it("ships a migration creating extract_rows_session_row_unique on (session_id,row_index)", () => {
    const dir = resolve(ROOT, "supabase/migrations");
    const found = readdirSync(dir).some((f) => {
      if (!f.endsWith(".sql")) return false;
      const sql = readFileSync(resolve(dir, f), "utf8");
      return /extract_rows_session_row_unique/.test(sql)
        && /UNIQUE\s+INDEX/i.test(sql)
        && /\(\s*session_id\s*,\s*row_index\s*\)/.test(sql);
    });
    expect(found).toBe(true);
  });
});

// ─── Hook: no row blanking, no stuck loading ──────────────────────────────
describe("useExtractRows polling/refresh guards", () => {
  it("never overwrites already-loaded rows with an empty refetch result", () => {
    // The guard must check rowsRef before assigning [] back into state,
    // otherwise a racing refresh blanks the UI and re-triggers Loading…
    expect(HOOK).toMatch(/rowsRef/);
    expect(HOOK).toMatch(
      /data\.length\s*>\s*0\s*\|\|\s*rowsRef\.current\.length\s*===\s*0/,
    );
  });

  it("ends loading + hasFetched as soon as the retry poll lands rows", () => {
    // Without this, the page stays on "Loading extracted rows…" even after
    // the background poll has the data.
    const pollBlock = HOOK.match(/const\s+poll\s*=\s*async[\s\S]{0,1500}/);
    expect(pollBlock, "retry poll block missing").not.toBeNull();
    const block = pollBlock![0];
    expect(block).toMatch(/setRows\(retryData\)/);
    expect(block).toMatch(/setHasFetched\(true\)/);
    expect(block).toMatch(/setLoading\(false\)/);
  });

  it("guards against stale session writes when the user switches sessions", () => {
    // Without sessionRef, an in-flight poll from a previous session can
    // write rows into the new session's state.
    expect(HOOK).toMatch(/sessionRef/);
    expect(HOOK).toMatch(/sessionRef\.current\s*!==\s*sessionId/);
  });

  it("re-uploading the same file starts a fresh session (refresh clears rows when sessionId is null)", () => {
    // Each upload creates a new extract_sessions row; switching to it must
    // reset local rows so we cannot bleed previous-session data into the
    // new session's view. Scope to the useExtractRows hook block.
    const hookBlock = HOOK.split(/export function useExtractRows/)[1] ?? "";
    expect(hookBlock.length).toBeGreaterThan(0);
    expect(hookBlock).toMatch(/if\s*\(!sessionId\)\s*\{[\s\S]{0,200}setRows\(\[\]\)/);
  });
});
