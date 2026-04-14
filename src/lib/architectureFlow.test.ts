// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ARCHITECTURE_LAYOUT, applyArchitectureLayout, matchesArchitectureQuery } from "@/lib/architectureFlow";
import type { ArchitectureLayoutItem } from "@/lib/architectureFlow";

describe("applyArchitectureLayout (horizontal)", () => {
  it("places later layers further to the right (increasing X)", () => {
    const items: ArchitectureLayoutItem[] = [
      { id: "ext-1", layer: "external" },
      { id: "ai-1", layer: "ai" },
    ];
    const result = applyArchitectureLayout(items);
    const ext = result.find((i) => i.id === "ext-1")!;
    const ai = result.find((i) => i.id === "ai-1")!;

    expect(ai.position.x).toBeGreaterThan(ext.position.x);
  });

  it("stacks nodes vertically within a layer column", () => {
    const items: ArchitectureLayoutItem[] = [
      { id: "a-0", layer: "ai" },
      { id: "a-1", layer: "ai" },
      { id: "a-2", layer: "ai" },
    ];
    const result = applyArchitectureLayout(items);
    const y0 = result.find((i) => i.id === "a-0")!.position.y;
    const y1 = result.find((i) => i.id === "a-1")!.position.y;
    const y2 = result.find((i) => i.id === "a-2")!.position.y;

    expect(y1).toBeGreaterThan(y0);
    expect(y2).toBeGreaterThan(y1);
    // All same X
    expect(result[0].position.x).toBe(result[1].position.x);
  });

  it("wraps overflow into additional sub-columns with increasing X", () => {
    const items: ArchitectureLayoutItem[] = Array.from({ length: 15 }, (_, i) => ({
      id: `ai-${i}`,
      layer: "ai" as const,
    }));
    const result = applyArchitectureLayout(items);
    const first = result.find((i) => i.id === "ai-0")!;
    const wrapped = result.find((i) => i.id === "ai-14")!;

    expect(wrapped.position.x).toBeGreaterThan(first.position.x);
  });

  it("resolves layer from data.layer fallback (React Flow format)", () => {
    const items: ArchitectureLayoutItem[] = [
      { id: "top-level", layer: "entry" },
      { id: "nested", data: { layer: "entry" } },
    ];
    const result = applyArchitectureLayout(items);
    const topLevel = result.find((i) => i.id === "top-level")!;
    const nested = result.find((i) => i.id === "nested")!;

    expect(nested.position.x).toBe(topLevel.position.x);
  });
});

describe("matchesArchitectureQuery", () => {
  it("returns true for empty query", () => {
    expect(matchesArchitectureQuery("Vizzy", "AI Agent", "")).toBe(true);
  });

  it("matches on label", () => {
    expect(matchesArchitectureQuery("Vizzy", "AI Agent", "vizzy")).toBe(true);
  });

  it("matches on hint", () => {
    expect(matchesArchitectureQuery("Vizzy", "AI Agent", "agent")).toBe(true);
  });

  it("returns false on no match", () => {
    expect(matchesArchitectureQuery("Vizzy", "AI Agent", "stripe")).toBe(false);
  });
});
