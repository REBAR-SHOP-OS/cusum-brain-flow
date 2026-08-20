// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("face recognition candidate filtering", () => {
  const source = readFileSync("supabase/functions/face-recognize/index.ts", "utf8");

  it("uses active enrollments but scopes company through linked profiles", () => {
    // Enrollments are the source of truth, but this app's face_enrollments table has no company_id.
    expect(source).toContain('.from("face_enrollments")');
    expect(source).toContain('.eq("is_active", true)');
    expect(source).not.toContain('.select("id, profile_id, photo_url, company_id")');
    expect(source).not.toMatch(/enrollQuery[\s\S]{0,200}\.eq\("company_id",\s*companyId\)/);
    expect(source).toMatch(/profileQuery[\s\S]{0,300}\.eq\("company_id",\s*companyId\)/);
  });

  it("does NOT filter profiles by is_active (that flag means 'clocked in' here)", () => {
    // Filtering profiles by is_active=true would exclude every employee not currently
    // clocked in — i.e. everyone trying to punch in. Keep this guard in place.
    expect(source).not.toMatch(/\.from\("profiles"\)[\s\S]{0,200}\.eq\("is_active",\s*true\)/);
  });
});
