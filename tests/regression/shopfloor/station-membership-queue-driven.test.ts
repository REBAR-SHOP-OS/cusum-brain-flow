/**
 * @vitest-environment node
 *
 * Regression: Station Detail page membership must be driven by
 * machine_queue_items.machine_id — NOT by machine_capabilities alone.
 *
 * Background: AS07/AS09 were assigned to CUTTER-02 via machine_queue_items
 * but the station page (useStationData) filtered cut_plan_items by
 * machine_capabilities + cut_plans.status IN ('draft','queued','running'),
 * so an `in_production` plan was hidden and capability-based listing leaked
 * items across capable machines.
 *
 * These are file-content assertions that fail the moment station membership
 * regresses to a capability-driven or capped-status query.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve("src/hooks/useStationData.ts"), "utf8");

describe("useStationData — station membership is queue-driven", () => {
  it("reads machine_queue_items filtered by the route machine_id", () => {
    expect(src).toMatch(/from\(["']machine_queue_items["']\)/);
    expect(src).toMatch(/\.eq\(["']machine_id["'],\s*machineId!?\)/);
  });

  it("only considers queued/running machine_queue_items", () => {
    expect(src).toMatch(/\.in\(["']status["'],\s*\[\s*["']queued["']\s*,\s*["']running["']\s*\]\)/);
  });

  it("joins production_tasks via task_id to get cut_plan_item_id", () => {
    expect(src).toMatch(/from\(["']production_tasks["']\)/);
    expect(src).toMatch(/cut_plan_item_id/);
  });

  it("loads cut_plan_items by id IN (...) from the queue join, not by bar_code capability", () => {
    // Ensure we use .in('id', cpiIds) — not .in('bar_code', allowedBarCodes) as the membership gate
    expect(src).toMatch(/\.in\(["']id["'],\s*cpiIds\)/);
    expect(src).not.toMatch(/\.in\(["']bar_code["'],\s*allowedBarCodes\)/);
  });

  it("allows cut_plans.status = in_production so queued/running items are not hidden", () => {
    expect(src).toMatch(/in_production/);
    expect(src).toMatch(/\.in\(\s*["']cut_plans\.status["'],\s*\[[^\]]*["']in_production["'][^\]]*\]/);
  });

  it("does not gate membership on hardcoded CUTTER-01/CUTTER-02 bar-size rules", () => {
    expect(src).not.toMatch(/ALLOWED_ON_CUTTER_01/);
    expect(src).not.toMatch(/BLOCKED_ON_CUTTER_02/);
  });

  it("emits debug logs for membership audit", () => {
    expect(src).toMatch(/\[useStationData\] route machineId/);
    expect(src).toMatch(/machine_queue_items count/);
    expect(src).toMatch(/joined production_tasks count/);
    expect(src).toMatch(/joined cut_plan_items count/);
    expect(src).toMatch(/final rendered item count/);
  });

  it("subscribes to machine_queue_items + production_tasks realtime changes", () => {
    expect(src).toMatch(/table:\s*["']machine_queue_items["']/);
    expect(src).toMatch(/table:\s*["']production_tasks["']/);
  });
});
