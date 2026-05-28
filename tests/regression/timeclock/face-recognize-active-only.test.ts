import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("face recognition candidate filtering", () => {
  it("only includes active profiles as recognition candidates", () => {
    const source = readFileSync("supabase/functions/face-recognize/index.ts", "utf8");

    expect(source).toContain('.from("profiles")');
    expect(source).toContain('.eq("is_active", true)');
    expect(source).toContain('.in("profile_id", profileIds)');
  });
});