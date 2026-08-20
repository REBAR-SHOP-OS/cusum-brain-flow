// Regression: AI Extract showed duplicated rows on /office after a successful
// upload when extract-manifest was retried by the client (extractService.ts
// uses retries: 1). Each retry re-inserted all rows, producing N×2 rows in
// extract_rows that the UI faithfully rendered.
//
// Two safeguards must stay in place:
//   1. extract-manifest must upsert on (session_id, row_index) so a retry is
//      idempotent rather than additive.
//   2. A DB unique index on (session_id, row_index) backs the upsert and
//      hard-stops any other code path from ever creating two rows with the
//      same logical key.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const edgeFn = readFileSync(
  resolve(__dirname, "../../../supabase/functions/extract-manifest/index.ts"),
  "utf8",
);

describe("extract-manifest is idempotent on retry", () => {
  it("upserts extract_rows on (session_id,row_index) instead of plain insert", () => {
    expect(edgeFn).not.toMatch(/from\("extract_rows"\)\s*\.insert\(batch\)/);
    expect(edgeFn).toMatch(
      /from\("extract_rows"\)\s*\.upsert\(batch,\s*\{\s*onConflict:\s*"session_id,row_index"/,
    );
  });
});

describe("DB unique index protects against double-inserted extract rows", () => {
  it("ships a migration creating the (session_id,row_index) unique index", () => {
    const migrationsDir = resolve(__dirname, "../../../supabase/migrations");
    const files = readdirSync(migrationsDir);
    const found = files.some((f) => {
      if (!f.endsWith(".sql")) return false;
      const sql = readFileSync(resolve(migrationsDir, f), "utf8");
      return /extract_rows_session_row_unique/.test(sql)
        && /UNIQUE\s+INDEX/i.test(sql)
        && /\(session_id,\s*row_index\)/.test(sql);
    });
    expect(found).toBe(true);
  });
});
