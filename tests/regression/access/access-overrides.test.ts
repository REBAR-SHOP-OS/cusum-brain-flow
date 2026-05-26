// @vitest-environment node
/**
 * REGRESSION: useUserAccessOverrides must exist as the single source of
 * truth for per-user navigation grants. New components must NOT roll their
 * own override checks.
 *
 * Related: mem://security/access-and-navigation-overrides
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const HOOK_PATH = resolve(__dirname, "../../../src/hooks/useUserAccessOverrides.ts");

describe("access: useUserAccessOverrides hook", () => {
  it("hook file exists", () => {
    expect(existsSync(HOOK_PATH)).toBe(true);
  });

  it("hook exports a function/hook named useUserAccessOverrides", () => {
    const src = readFileSync(HOOK_PATH, "utf-8");
    expect(src).toMatch(/export\s+(?:function|const)\s+useUserAccessOverrides/);
  });
});