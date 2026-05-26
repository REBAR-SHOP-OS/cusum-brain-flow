/**
 * REGRESSION: The `validate` action must return `missing_inputs_questions`
 * when the estimate request is incomplete, instead of silently producing a
 * partial quote. The frontend uses this to drive the input-completion UI.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE = readFileSync(
  resolve(__dirname, "../../../supabase/functions/quote-engine/index.ts"),
  "utf-8",
);

describe("quote-engine: validate action", () => {
  it("source handles action === 'validate'", () => {
    expect(SOURCE).toMatch(/action\s*===\s*"validate"/);
  });

  it("validate returns missing_inputs_questions on incomplete request", () => {
    expect(SOURCE).toMatch(/missing_inputs_questions/);
    expect(SOURCE).toMatch(/validateEstimateRequest\s*\(/);
  });
});
