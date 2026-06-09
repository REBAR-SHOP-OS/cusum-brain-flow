import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Regression: when a cut_plan_item reaches phase='complete', a loading_checklist
 * row must be auto-created so cleared items appear in Loading without a manual
 * "Release to Loading" step. Enforced by trigger
 * trg_auto_release_complete_to_loading on public.cut_plan_items.
 */
describe("auto-release complete -> loading trigger", () => {
  it("migration installs trigger + function + backfill", () => {
    const dir = "supabase/migrations";
    const files = readdirSync(dir);
    const hit = files
      .map((f) => readFileSync(join(dir, f), "utf8"))
      .find(
        (sql) =>
          sql.includes("auto_release_complete_to_loading") &&
          sql.includes("trg_auto_release_complete_to_loading") &&
          sql.includes("INSERT INTO public.loading_checklist"),
      );
    expect(hit, "auto-release migration missing").toBeTruthy();
  });
});
