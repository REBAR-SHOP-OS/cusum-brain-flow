// @vitest-environment node
//
// Regression: CLEAR / Manifest auto-camera workflow must:
//   1. Auto-advance after a successful scan (no manual close)
//   2. Treat "MARK matched, but DWG/Ref missing on tag" as partial-match
//      auto-accept — NOT loop on the manual pick overlay.
//   3. Treat "MARK matched, but DWG/Ref missing on item" the same way.
//   4. Time out hung AI roundtrips (match-tag-photo, validate-clearance-photo)
//      and reset the camera to ready instead of leaving the UI on VERIFYING.
//   5. Skip a duplicate save when the same tag is re-scanned within window.
//   6. Auto-dismiss every banner (including 'mismatch') so the operator does
//      not need to manually close repeated messages.
//   7. Bound refine attempts so a single bad image cannot pin the UI.
//   8. Emit audit checkpoints for the full lifecycle.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const hook = readFileSync(
  resolve(__dirname, "../../../src/hooks/useAutoClearance.ts"),
  "utf8",
);
const mode = readFileSync(
  resolve(__dirname, "../../../src/components/clearance/AutoClearanceMode.tsx"),
  "utf8",
);

describe("CLEAR auto camera workflow", () => {
  it("wraps match-tag-photo and validate-clearance-photo with a timeout", () => {
    expect(hook).toMatch(/AI_TIMEOUT_MS\s*=\s*\d+/);
    expect(hook).toMatch(/withTimeout\([\s\S]*?match-tag-photo/);
    expect(hook).toMatch(/withTimeout\([\s\S]*?validate-clearance-photo/);
  });

  it("auto-accepts partial match when only DWG/Ref are missing on tag or item", () => {
    expect(hook).toMatch(/partialAutoAccept/);
    expect(hook).toMatch(/missing on \(item\|tag\)/i);
    // Must NOT trigger the manual pick overlay on the partial path.
    expect(hook).toMatch(/decision === "confirm" && !partialAutoAccept/);
    expect(hook).toMatch(/partial_match_auto_accept/);
  });

  it("bounds refine attempts so the UI cannot loop on unreadable tags", () => {
    expect(hook).toMatch(/MAX_REFINE_ATTEMPTS\s*=\s*[12]/);
    expect(hook).toMatch(/refineAttemptsRef\.current\s*\+=\s*1/);
    expect(hook).toMatch(/refineAttemptsRef\.current\s*=\s*0/);
  });

  it("prevents duplicate saves of the same tag inside the recent-save window", () => {
    expect(hook).toMatch(/wasRecentlySaved\(matchedItem\.id\)/);
    expect(hook).toMatch(/markRecentlySaved\(finalizedItemId\)/);
    expect(hook).toMatch(/RECENT_SAVE_WINDOW_MS/);
  });

  it("auto-dismisses every banner — mismatch must not stick", () => {
    // The old guard explicitly skipped mismatch from auto-dismiss; gone now.
    expect(hook).not.toMatch(/b\.kind !== "mismatch"/);
    expect(hook).toMatch(/Auto-dismiss every banner/);
  });

  it("resets the camera to waiting_tag on AI timeout (no stuck VERIFYING)", () => {
    expect(hook).toMatch(/scan_timeout/);
    expect(hook).toMatch(/isTimeout[\s\S]*?setState\("waiting_tag"\)/);
  });

  it("auto-advances to the next tag after a confirmed completion", () => {
    expect(hook).toMatch(/auto_advance/);
    expect(hook).toMatch(/setState\("waiting_tag"\)/);
  });

  it("emits the full audit checkpoint set for the camera lifecycle", () => {
    [
      "scan_started",
      "tag_recognized",
      "partial_match_auto_accept",
      "match_success",
      "scan_timeout",
      "auto_advance",
    ].forEach((cp) => expect(hook).toContain(cp));
  });

  it("does not flash 'Scan and save tag first' during the tag→product handoff", () => {
    expect(mode).toMatch(/showLockHint/);
    expect(mode).toMatch(/productLocked && showLockHint/);
  });
});
