/**
 * @vitest-environment node
 *
 * Regression: cutter routing is enforced by machine_capabilities data
 * (CUTTER-01 = 10M/15M, CUTTER-02 = 20M+), NOT by hardcoded machine ids
 * inside src/lib/workOrderDispatch.ts. The dispatcher must keep using
 * capablePool(process, bar_code) so the rule is data-driven.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dispatcher = readFileSync(resolve("src/lib/workOrderDispatch.ts"), "utf8");

describe("workOrderDispatch — capability-matrix driven", () => {
  it("still routes via machine_capabilities (capablePool)", () => {
    expect(dispatcher).toMatch(/from\("machine_capabilities"\)/);
    expect(dispatcher).toMatch(/capablePool/);
  });

  it("does not hardcode CUTTER-01 / CUTTER-02 ids or names", () => {
    expect(dispatcher).not.toMatch(/CUTTER-01/);
    expect(dispatcher).not.toMatch(/CUTTER-02/);
    expect(dispatcher).not.toMatch(/e2dfa6e1-8a49-48eb-82a8-2be40e20d4b3/);
    expect(dispatcher).not.toMatch(/b0000000-0000-0000-0000-000000000002/);
  });

  it("preserves setup_key affinity ordering (affinity → least_loaded → round_robin)", () => {
    const affinityIdx = dispatcher.indexOf("same_setup_key_affinity");
    const leastLoadedIdx = dispatcher.indexOf("least_loaded");
    const rrIdx = dispatcher.indexOf("round_robin_tiebreak");
    expect(affinityIdx).toBeGreaterThan(0);
    expect(leastLoadedIdx).toBeGreaterThan(affinityIdx);
    expect(rrIdx).toBeGreaterThan(leastLoadedIdx);
  });
});
