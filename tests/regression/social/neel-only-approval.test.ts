// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();

describe("HARD RULE: only neel@rebar.shop and sattar@rebar.shop may approve social posts", () => {
  it("PostReviewPanel.tsx allows neel and sattar, blocks others", () => {
    const src = readFileSync(
      join(root, "src/components/social/PostReviewPanel.tsx"),
      "utf8",
    );
    const approveGateRegion = src.split("Neel Approval Gate")[1] ?? "";
    expect(approveGateRegion).toMatch(/neel@rebar\.shop/);
    expect(approveGateRegion).toMatch(/sattar@rebar\.shop/);
    expect(approveGateRegion).not.toMatch(/radin@rebar\.shop/);
    expect(approveGateRegion).not.toMatch(/zahra@rebar\.shop/);
  });

  it("ApprovalsPanel.tsx gates Approve button to neel+sattar allowlist", () => {
    const src = readFileSync(
      join(root, "src/components/social/ApprovalsPanel.tsx"),
      "utf8",
    );
    expect(src).toMatch(/APPROVERS\s*=\s*\[\s*["']neel@rebar\.shop["']\s*,\s*["']sattar@rebar\.shop["']\s*\]/);
    expect(src).toMatch(/canApprove\s*=\s*APPROVERS\.includes/);
    expect(src).toMatch(/disabled=\{[^}]*!canApprove[^}]*\}/);
    expect(src).not.toMatch(/radin@rebar\.shop/);
    expect(src).not.toMatch(/zahra@rebar\.shop/);
  });

  it("DB trigger enforce_neel_only_approval present and allows sattar", () => {
    const out = execSync(
      "grep -rl enforce_neel_only_approval supabase/migrations || true",
      { encoding: "utf8" },
    );
    expect(out.trim().length).toBeGreaterThan(0);
    const files = out.trim().split("\n");
    const combined = files.map((f) => readFileSync(f, "utf8")).join("\n");
    expect(combined).toMatch(/sattar@rebar\.shop/);
  });
});
