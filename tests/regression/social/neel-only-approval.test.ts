// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();

describe("HARD RULE: only neel@rebar.shop may approve social posts", () => {
  it("PostReviewPanel.tsx does NOT allow sattar or radin to approve", () => {
    const src = readFileSync(
      join(root, "src/components/social/PostReviewPanel.tsx"),
      "utf8",
    );
    // The approve gate block must not contain other allowlisted approver emails.
    const approveGateRegion = src.split("Neel Approval Gate")[1] ?? "";
    expect(approveGateRegion).not.toMatch(/sattar@rebar\.shop/);
    expect(approveGateRegion).not.toMatch(/radin@rebar\.shop/);
    expect(approveGateRegion).toMatch(/neel@rebar\.shop/);
  });

  it("ApprovalsPanel.tsx gates the Approve button by canApprove === neel", () => {
    const src = readFileSync(
      join(root, "src/components/social/ApprovalsPanel.tsx"),
      "utf8",
    );
    expect(src).toMatch(/canApprove\s*=\s*currentUserEmail\s*===\s*["']neel@rebar\.shop["']/);
    expect(src).toMatch(/disabled=\{[^}]*!canApprove[^}]*\}/);
  });

  it("DB trigger enforce_neel_only_approval is present in migrations", () => {
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const out = execSync(
      "grep -rl enforce_neel_only_approval supabase/migrations || true",
      { encoding: "utf8" },
    );
    expect(out.trim().length).toBeGreaterThan(0);
  });
});
