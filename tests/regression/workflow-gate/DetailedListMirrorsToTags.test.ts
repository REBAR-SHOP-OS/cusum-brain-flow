// @vitest-environment node
// Regression: edits in the Detailed List (cut_plan_items) must be mirrored
// back to the linked extract_rows row so the Tags & Export view shows the
// updated numbers even after a project enters workstation.
//
// Pins the migration contract:
//   - AFTER UPDATE trigger on cut_plan_items
//   - resolves session via cut_plans → barlists.extract_session_id
//   - matches extract_rows by session_id + previous mark + previous bar size
//   - mirrors qty/length/mark/bar/shape/dwg/dims
//   - clears source_total_length_text and source_dims_json
//   - SECURITY DEFINER + SET search_path = public
//   - writes an audit event of type extract_row_mirrored_from_cut_plan
//   - no-op (no error) when no matching extract_row exists

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

function loadMirrorMigration(): string {
  const dir = resolve(process.cwd(), "supabase/migrations");
  const matches = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => ({ f, body: readFileSync(resolve(dir, f), "utf8") }))
    .filter(({ body }) => body.includes("mirror_cut_plan_item_to_extract_row"))
    .sort((a, b) => a.f.localeCompare(b.f));
  if (matches.length === 0) {
    throw new Error(
      "No migration found containing mirror_cut_plan_item_to_extract_row. " +
        "Expected the Detailed-List → Tags mirror migration to be present.",
    );
  }
  return matches[matches.length - 1].body;
}

describe("Detailed List → Tags mirror — trigger contract", () => {
  const sql = loadMirrorMigration();

  it("declares the mirror function with SECURITY DEFINER and pinned search_path", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.mirror_cut_plan_item_to_extract_row/);
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path = public/);
  });

  it("resolves session via cut_plans → barlists.extract_session_id", () => {
    expect(sql).toMatch(/FROM public\.cut_plans cp/);
    expect(sql).toMatch(/JOIN public\.barlists b ON b\.id = cp\.barlist_id/);
    expect(sql).toMatch(/b\.extract_session_id/);
  });

  it("matches the extract row by OLD mark + OLD bar size in the same session", () => {
    expect(sql).toMatch(/FROM public\.extract_rows/);
    expect(sql).toMatch(/session_id = v_session_id/);
    expect(sql).toMatch(/mark = OLD\.mark_number/);
    expect(sql).toMatch(/COALESCE\(bar_size_mapped, bar_size\) = OLD\.bar_code/);
  });

  it("mirrors qty, length, mark, bar size, shape, dwg and all dimension columns", () => {
    expect(sql).toMatch(/mark\s*=\s*NEW\.mark_number/);
    expect(sql).toMatch(/quantity\s*=\s*NEW\.total_pieces/);
    expect(sql).toMatch(/total_length_mm\s*=\s*NEW\.cut_length_mm/);
    expect(sql).toMatch(/bar_size_mapped\s*=\s*NEW\.bar_code/);
    expect(sql).toMatch(/shape_code_mapped\s*=\s*COALESCE\(NEW\.asa_shape_code/);
    expect(sql).toMatch(/dwg\s*=\s*COALESCE\(NEW\.drawing_ref/);
    for (const d of ["a", "b", "c", "d", "e", "f", "g", "h", "j", "k", "o", "r"]) {
      expect(sql).toMatch(new RegExp(`dim_${d}\\s*=\\s*NULLIF`));
    }
  });

  it("clears stale source-of-truth text so the renderer recomputes", () => {
    expect(sql).toMatch(/source_total_length_text\s*=\s*NULL/);
    expect(sql).toMatch(/source_dims_json\s*=\s*NULL/);
  });

  it("returns early (no error) when no matching extract row exists", () => {
    // The guard for an unmatched extract row uses `v_row_id IS NULL THEN RETURN NEW`.
    expect(sql).toMatch(/IF v_row_id IS NULL THEN[\s\S]*?RETURN NEW;[\s\S]*?END IF;/);
    // And the same shape for a missing session link.
    expect(sql).toMatch(/IF v_session_id IS NULL THEN[\s\S]*?RETURN NEW;[\s\S]*?END IF;/);
  });

  it("writes an audit event with the canonical event_type", () => {
    expect(sql).toMatch(/INSERT INTO public\.activity_events/);
    expect(sql).toMatch(/'extract_row_mirrored_from_cut_plan'/);
    expect(sql).toMatch(/'fields_changed'/);
  });

  it("registers an AFTER UPDATE row trigger gated on the mirrored columns", () => {
    expect(sql).toMatch(/CREATE TRIGGER trg_mirror_cut_plan_item_to_extract_row/);
    expect(sql).toMatch(/AFTER UPDATE ON public\.cut_plan_items/);
    expect(sql).toMatch(/FOR EACH ROW/);
    expect(sql).toMatch(/OLD\.mark_number\s+IS DISTINCT FROM NEW\.mark_number/);
    expect(sql).toMatch(/OLD\.total_pieces\s+IS DISTINCT FROM NEW\.total_pieces/);
    expect(sql).toMatch(/OLD\.cut_length_mm\s+IS DISTINCT FROM NEW\.cut_length_mm/);
    expect(sql).toMatch(/OLD\.bend_dimensions\s+IS DISTINCT FROM NEW\.bend_dimensions/);
    expect(sql).toMatch(/OLD\.bar_code\s+IS DISTINCT FROM NEW\.bar_code/);
  });
});
