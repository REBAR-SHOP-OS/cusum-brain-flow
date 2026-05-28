// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("face recognition candidate filtering", () => {
  const source = readFileSync("supabase/functions/face-recognize/index.ts", "utf8");

  it("scopes enrollments by is_active and (when present) company_id", () => {
    // Mirrors REBAR OS Core: enrollments are the source of truth, scoped by company.
    expect(source).toContain('.from("face_enrollments")');
    expect(source).toContain('.eq("is_active", true)');
    expect(source).toContain('.eq("company_id", companyId)');
  });

  it("does NOT filter profiles by is_active (that flag means 'clocked in' here)", () => {
    // Filtering profiles by is_active=true would exclude every employee not currently
    // clocked in — i.e. everyone trying to punch in. Keep this guard in place.
    expect(source).not.toMatch(/\.from\("profiles"\)[\s\S]{0,200}\.eq\("is_active",\s*true\)/);
  });
});
