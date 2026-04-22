import { describe, it, expect } from "vitest";
import { computeForemanDecision, type ForemanContext } from "./foremanBrain";
import type { StationItem } from "@/hooks/useStationData";

function makeItem(over: Partial<StationItem> = {}): StationItem {
  return {
    id: "item-1",
    cut_plan_id: "plan-1",
    bar_code: "15M",
    qty_bars: 10,
    cut_length_mm: 1524,
    pieces_per_bar: 7,
    notes: null,
    mark_number: "A1501",
    drawing_ref: null,
    bend_type: "straight",
    asa_shape_code: null,
    total_pieces: 100,
    completed_pieces: 0,
    bend_completed_pieces: 0,
    needs_fix: false,
    bend_dimensions: null,
    source_total_length_text: null,
    work_order_id: null,
    phase: "cutting",
    plan_name: "Plan 1",
    project_name: "Test Project",
    project_id: "proj-1",
    customer_name: "Test Customer",
    project_status: "active",
    optimization_mode: null,
    ...over,
  };
}

function makeCtx(item: StationItem): ForemanContext {
  return {
    module: "cut",
    machineId: "m1",
    machineName: "Cutter 1",
    machineModel: "Test",
    machineStatus: "running",
    machineType: "cutter",
    currentItem: item,
    items: [item],
    lots: [],
    floorStock: [],
    wipBatches: [],
    maxBars: 10,
    selectedStockLength: 12000,
    currentIndex: 0,
    canWrite: true,
    manualFloorStockConfirmed: true,
  };
}

describe("foremanBrain — length unit display", () => {
  it("uses inches text when source_total_length_text is in inches", () => {
    const item = makeItem({ cut_length_mm: 60, source_total_length_text: '60"' });
    const decision = computeForemanDecision(makeCtx(item));

    expect(decision.instructions.length).toBeGreaterThanOrEqual(1);
    expect(decision.instructions[0].emphasis).toBe('60"');
    expect(decision.recommendation).toContain('cut at 60"');
    expect(decision.recommendation).not.toContain("60 mm");
  });

  it("uses ft-in text when source_total_length_text is in ft-in", () => {
    const item = makeItem({ cut_length_mm: 762, source_total_length_text: `2'-6"` });
    const decision = computeForemanDecision(makeCtx(item));

    expect(decision.instructions.length).toBeGreaterThanOrEqual(1);
    expect(decision.instructions[0].emphasis).toBe(`2'-6"`);
    expect(decision.recommendation).toContain(`cut at 2'-6"`);
  });

  it("falls back to '<cut_length_mm> mm' when source_total_length_text is null", () => {
    const item = makeItem({ cut_length_mm: 750, source_total_length_text: null });
    const decision = computeForemanDecision(makeCtx(item));

    expect(decision.instructions.length).toBeGreaterThanOrEqual(1);
    expect(decision.instructions[0].emphasis).toBe("750 mm");
    expect(decision.recommendation).toContain("cut at 750 mm");
  });
});
