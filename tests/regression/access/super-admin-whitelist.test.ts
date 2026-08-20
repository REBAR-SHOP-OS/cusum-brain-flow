// @vitest-environment node
/**
 * REGRESSION: Super-admin access is whitelist-only. Any new module that
 * checks super-admin status must go through `useSuperAdmin` (which reads
 * `ACCESS_POLICIES.superAdmins`). Hardcoded email lists in components are
 * forbidden.
 *
 * Related: mem://security/user-role-architecture,
 *          mem://security/universal-access-and-vizzy-gate
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ACCESS_POLICIES } from "@/lib/accessPolicies";

describe("access: super-admin whitelist", () => {
  it("whitelist is non-empty", () => {
    expect(Array.isArray(ACCESS_POLICIES.superAdmins)).toBe(true);
    expect(ACCESS_POLICIES.superAdmins.length).toBeGreaterThan(0);
  });

  it("whitelist contains only string emails", () => {
    for (const e of ACCESS_POLICIES.superAdmins) {
      expect(typeof e).toBe("string");
      expect(e).toMatch(/@/);
    }
  });

  it("useSuperAdmin hook reads from ACCESS_POLICIES.superAdmins", () => {
    const src = readFileSync(
      resolve(__dirname, "../../../src/hooks/useSuperAdmin.ts"),
      "utf-8",
    );
    expect(src).toMatch(/ACCESS_POLICIES\.superAdmins/);
    expect(src).toMatch(/\.includes\(/);
  });
});