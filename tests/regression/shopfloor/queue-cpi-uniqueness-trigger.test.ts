/**
 * @vitest-environment node
 *
 * Regression: there must be a BEFORE INSERT/UPDATE trigger on
 * machine_queue_items that blocks more than one active (queued|running)
 * queue row per production_tasks.cut_plan_item_id. This prevents duplicate
 * tags from appearing on station pages.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

function loadMigrations(): string {
  const dir = resolve("supabase/migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => readFileSync(resolve(dir, f), "utf8"))
    .join("\n\n");
}

const migrations = loadMigrations();

describe("machine_queue_items — duplicate-active guard", () => {
  it("defines enforce_unique_active_queue_per_cpi() as SECURITY DEFINER with public search_path", () => {
    expect(migrations).toMatch(/CREATE OR REPLACE FUNCTION public\.enforce_unique_active_queue_per_cpi/);
    expect(migrations).toMatch(/SECURITY DEFINER/);
    expect(migrations).toMatch(/SET search_path\s*=\s*public/);
  });

  it("creates BEFORE INSERT OR UPDATE trigger on machine_queue_items", () => {
    expect(migrations).toMatch(/CREATE TRIGGER trg_enforce_unique_active_queue_per_cpi/);
    expect(migrations).toMatch(/BEFORE INSERT OR UPDATE[\s\S]+ON public\.machine_queue_items/);
  });

  it("short-circuits when NEW.status NOT IN (queued, running)", () => {
    expect(migrations).toMatch(/IF NEW\.status NOT IN\s*\(\s*'queued'\s*,\s*'running'\s*\)/);
  });

  it("checks against production_tasks.cut_plan_item_id and raises 23505", () => {
    expect(migrations).toMatch(/production_tasks/);
    expect(migrations).toMatch(/cut_plan_item_id/);
    expect(migrations).toMatch(/ERRCODE\s*=\s*'23505'/);
  });
});
