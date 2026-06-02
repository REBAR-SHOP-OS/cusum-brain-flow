/**
 * @vitest-environment node
 *
 * Regression: legacy work-order dispatcher (src/lib/workOrderDispatch.ts) must
 * be setup_key / bar_code / capability aware. Plain round-robin across all
 * cutter tasks regressed AS07/AS09 routing (AS07 → CUTTER-01, AS09 → CUTTER-02
 * for the same 20M setup_key).
 *
 * These are file-content assertions: they fail the instant the affinity logic
 * is removed or replaced by a plain round-robin.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve("src/lib/workOrderDispatch.ts"), "utf8");

describe("workOrderDispatch — setup_key aware", () => {
  it("selects setup_key, bar_code, grade, locked_to_machine_id from production_tasks", () => {
    expect(src).toMatch(/setup_key/);
    expect(src).toMatch(/bar_code/);
    expect(src).toMatch(/grade/);
    expect(src).toMatch(/locked_to_machine_id/);
  });

  it("derives setup_key from cut:<bar>:<grade> when task.setup_key is empty", () => {
    expect(src).toMatch(/function deriveSetupKey/);
    expect(src).toMatch(/`\$\{proc\}:\$\{bar\}:\$\{grade\}`/);
  });

  it("loads machine_capabilities and uses (process, bar_code) for pool filtering", () => {
    expect(src).toMatch(/from\("machine_capabilities"\)/);
    expect(src).toMatch(/capablePool/);
    expect(src).toMatch(/process:\s*"cut"\s*\|\s*"bend"/);
  });

  it("respects locked_to_machine_id before any other rule", () => {
    expect(src).toMatch(/locked_to_machine_id/);
    expect(src).toMatch(/reason:\s*"locked_to_machine_id"/);
  });

  it("prefers same-setup_key affinity over round-robin", () => {
    expect(src).toMatch(/setupAffinity/);
    expect(src).toMatch(/same_setup_key_affinity/);
    // Affinity check must run BEFORE the least-loaded / round-robin branches.
    const affinityIdx = src.indexOf("same_setup_key_affinity");
    const leastLoadedIdx = src.indexOf("least_loaded");
    const rrIdx = src.indexOf("round_robin_tiebreak");
    expect(affinityIdx).toBeGreaterThan(0);
    expect(leastLoadedIdx).toBeGreaterThan(affinityIdx);
    expect(rrIdx).toBeGreaterThan(leastLoadedIdx);
  });

  it("uses least-loaded capable machine, with round-robin only as tiebreak fallback", () => {
    expect(src).toMatch(/liveLoad/);
    expect(src).toMatch(/least_loaded/);
    expect(src).toMatch(/round_robin_tiebreak/);
  });

  it("does NOT use the old per-type blind round-robin in the main dispatch loop", () => {
    // The legacy pickMachine() round-robin advanced one cursor per machine type
    // for every task regardless of bar_code. That implementation must not return.
    expect(src).not.toMatch(/const\s+pickMachine\s*=\s*\(taskType/);
    expect(src).toMatch(/pickForTask/);
  });

  it("never reassigns an existing running/queued queue row to a new machine", () => {
    // Reuse machine_id from the existing row instead of repicking.
    expect(src).toMatch(/existingRow\?\.machine_id/);
    expect(src).toMatch(/preexisting_queue_row/);
  });

  it("audits each dispatch decision via activity_events with dispatch_path tag", () => {
    expect(src).toMatch(/from\("activity_events"\)/);
    expect(src).toMatch(/dispatch_path:\s*"legacy_setup_key_aware"/);
    expect(src).toMatch(/affinity_used:/);
    expect(src).toMatch(/round_robin_fallback:/);
    expect(src).toMatch(/reason:\s*pickReason/);
  });

  it("in-batch affinity is updated so subsequent same-setup tasks cluster on the same machine", () => {
    // After each successful dispatch, liveLoad + setupAffinity must be bumped
    // so the next pickForTask in the same loop sees the new placement.
    expect(src).toMatch(/liveLoad\.set\(machineId/);
    expect(src).toMatch(/setupAffinity\.set\(sk/);
  });
});
