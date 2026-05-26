// @vitest-environment node
/**
 * REGRESSION: Quote engine must reject quotes that resolve to $0 grand_total
 * despite having line items. The guard block in `quote-engine/index.ts`
 * returns HTTP 422 with `pricing_status: "failed"` so the frontend surfaces
 * the failure instead of silently saving a $0 "draft" quote.
 *
 * If a future refactor deletes the guard, this test fails.
 *
 * Related: mem://features/sales/blitz-agent-capabilities (zero-price recovery)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE = readFileSync(
  resolve(__dirname, "../../../supabase/functions/quote-engine/index.ts"),
  "utf-8",
);

describe("quote-engine: $0 grand_total guard", () => {
  it("source contains the $0 QUOTE GUARD block", () => {
    expect(SOURCE).toMatch(/\$0 QUOTE GUARD/);
  });

  it("guard returns HTTP 422 on grand_total <= 0 with line items", () => {
    expect(SOURCE).toMatch(/grand_total\s*<=\s*0/);
    expect(SOURCE).toMatch(/status:\s*422/);
    expect(SOURCE).toMatch(/grand_total_zero/);
  });

  it("guard reports pricing_status: failed", () => {
    expect(SOURCE).toMatch(/pricing_status:\s*"failed"/);
  });
});